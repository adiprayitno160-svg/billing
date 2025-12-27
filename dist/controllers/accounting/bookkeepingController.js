"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookkeepingController = void 0;
const bookkeepingService_1 = require("../../services/accounting/bookkeepingService");
const pdfkit_1 = __importDefault(require("pdfkit"));
class BookkeepingController {
    /**
     * Halaman pembukuan
     */
    async index(req, res) {
        try {
            const { startDate, endDate, type = 'all' } = req.query;
            const data = await bookkeepingService_1.BookkeepingService.getBookkeepingData(startDate, endDate);
            res.render('accounting/bookkeeping', {
                title: 'Pembukuan',
                currentPath: '/accounting/bookkeeping',
                user: req.user,
                data: data,
                startDate: startDate || '',
                endDate: endDate || '',
                type: type,
                layout: 'layouts/main'
            });
        }
        catch (error) {
            console.error('Error loading bookkeeping:', error);
            // Get detailed error message
            let errorMessage = 'Gagal memuat data pembukuan';
            let errorDetails = '';
            if (error instanceof Error) {
                errorDetails = error.message;
                console.error('Error stack:', error.stack);
                // Check for specific database errors
                if (error.message.includes('ER_NO_SUCH_TABLE')) {
                    errorMessage = 'Tabel database tidak ditemukan. Silakan jalankan migrasi database.';
                }
                else if (error.message.includes('ER_BAD_FIELD_ERROR')) {
                    errorMessage = 'Kolom database tidak ditemukan. Database mungkin perlu diupdate.';
                }
                else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
                    errorMessage = 'Tidak dapat terhubung ke database. Periksa konfigurasi database.';
                }
                else if (error.message.includes('Access denied')) {
                    errorMessage = 'Akses database ditolak. Periksa kredensial database.';
                }
                else {
                    errorMessage = `Gagal memuat data pembukuan: ${error.message}`;
                }
            }
            res.status(500).render('error', {
                title: 'Error',
                status: 500,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            });
        }
    }
    /**
     * Export PDF untuk Piutang
     */
    async exportUnpaidPDF(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const invoices = await bookkeepingService_1.BookkeepingService.getUnpaidInvoices(startDate, endDate);
            const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="piutang-${Date.now()}.pdf"`);
            doc.pipe(res);
            // Header
            doc.fontSize(20).text('LAPORAN PIUTANG', { align: 'center' });
            doc.moveDown();
            if (startDate || endDate) {
                doc.fontSize(12).text(`Periode: ${startDate || 'Awal'} - ${endDate || 'Akhir'}`, { align: 'center' });
            }
            else {
                doc.fontSize(12).text('Semua Data', { align: 'center' });
            }
            doc.moveDown();
            doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, { align: 'right' });
            doc.moveDown(2);
            // Summary
            const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const totalRemaining = invoices.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0);
            doc.fontSize(14).text('RINGKASAN', { underline: true });
            doc.fontSize(11);
            doc.text(`Total Tagihan: Rp ${totalAmount.toLocaleString('id-ID')}`);
            doc.text(`Total Piutang: Rp ${totalRemaining.toLocaleString('id-ID')}`);
            doc.text(`Jumlah Invoice: ${invoices.length}`);
            doc.moveDown(2);
            // Table Header
            doc.fontSize(10);
            let y = doc.y;
            doc.text('No', 50, y);
            doc.text('Invoice', 80, y);
            doc.text('Pelanggan', 150, y);
            doc.text('Jatuh Tempo', 280, y);
            doc.text('Tagihan', 350, y);
            doc.text('Terbayar', 420, y);
            doc.text('Piutang', 490, y);
            doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
            doc.moveDown();
            // Table Rows
            invoices.forEach((invoice, index) => {
                if (doc.y > 750) {
                    doc.addPage();
                    y = 50;
                }
                doc.fontSize(9);
                doc.text((index + 1).toString(), 50, doc.y);
                doc.text(invoice.invoice_number || '-', 80, doc.y);
                doc.text((invoice.customer_name || '-').substring(0, 20), 150, doc.y);
                doc.text(new Date(invoice.due_date).toLocaleDateString('id-ID'), 280, doc.y);
                doc.text(parseFloat(invoice.total_amount || 0).toLocaleString('id-ID'), 350, doc.y);
                doc.text(parseFloat(invoice.paid_amount || 0).toLocaleString('id-ID'), 420, doc.y);
                doc.text(parseFloat(invoice.remaining_amount || 0).toLocaleString('id-ID'), 490, doc.y);
                doc.moveDown(0.5);
            });
            doc.end();
        }
        catch (error) {
            console.error('Error exporting unpaid PDF:', error);
            res.status(500).send('Error generating PDF');
        }
    }
    /**
     * Export PDF untuk Pembayaran
     */
    async exportPaidPDF(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const invoices = await bookkeepingService_1.BookkeepingService.getPaidInvoices(startDate, endDate);
            const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="pembayaran-${Date.now()}.pdf"`);
            doc.pipe(res);
            // Header
            doc.fontSize(20).text('LAPORAN PEMBAYARAN', { align: 'center' });
            doc.moveDown();
            if (startDate || endDate) {
                doc.fontSize(12).text(`Periode: ${startDate || 'Awal'} - ${endDate || 'Akhir'}`, { align: 'center' });
            }
            else {
                doc.fontSize(12).text('Semua Data', { align: 'center' });
            }
            doc.moveDown();
            doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, { align: 'right' });
            doc.moveDown(2);
            // Summary
            const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0);
            doc.fontSize(14).text('RINGKASAN', { underline: true });
            doc.fontSize(11);
            doc.text(`Total Tagihan: Rp ${totalAmount.toLocaleString('id-ID')}`);
            doc.text(`Total Dibayar: Rp ${totalPaid.toLocaleString('id-ID')}`);
            doc.text(`Jumlah Invoice: ${invoices.length}`);
            doc.moveDown(2);
            // Table Header
            doc.fontSize(10);
            let y = doc.y;
            doc.text('No', 50, y);
            doc.text('Invoice', 80, y);
            doc.text('Pelanggan', 150, y);
            doc.text('Tanggal Bayar', 280, y);
            doc.text('Tagihan', 350, y);
            doc.text('Dibayar', 420, y);
            doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
            doc.moveDown();
            // Table Rows
            invoices.forEach((invoice, index) => {
                if (doc.y > 750) {
                    doc.addPage();
                    y = 50;
                }
                doc.fontSize(9);
                doc.text((index + 1).toString(), 50, doc.y);
                doc.text(invoice.invoice_number || '-', 80, doc.y);
                doc.text((invoice.customer_name || '-').substring(0, 20), 150, doc.y);
                doc.text((invoice.paid_at || invoice.last_payment || invoice.last_payment_date)
                    ? new Date(invoice.paid_at || invoice.last_payment || invoice.last_payment_date).toLocaleDateString('id-ID')
                    : '-', 280, doc.y);
                doc.text(parseFloat(invoice.total_amount || 0).toLocaleString('id-ID'), 350, doc.y);
                doc.text(parseFloat(invoice.paid_amount || 0).toLocaleString('id-ID'), 420, doc.y);
                doc.moveDown(0.5);
            });
            doc.end();
        }
        catch (error) {
            console.error('Error exporting paid PDF:', error);
            res.status(500).send('Error generating PDF');
        }
    }
    /**
     * Print view untuk Piutang
     */
    async printUnpaid(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const invoices = await bookkeepingService_1.BookkeepingService.getUnpaidInvoices(startDate, endDate);
            const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const totalRemaining = invoices.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0);
            res.render('accounting/print-unpaid', {
                title: 'Cetak Piutang',
                invoices: invoices,
                totalAmount: totalAmount,
                totalRemaining: totalRemaining,
                startDate: startDate || '',
                endDate: endDate || '',
                layout: false
            });
        }
        catch (error) {
            console.error('Error printing unpaid:', error);
            res.status(500).send('Error loading print view');
        }
    }
    /**
     * Print view untuk Pembayaran
     */
    async printPaid(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const invoices = await bookkeepingService_1.BookkeepingService.getPaidInvoices(startDate, endDate);
            const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0);
            res.render('accounting/print-paid', {
                title: 'Cetak Pembayaran',
                invoices: invoices,
                totalAmount: totalAmount,
                totalPaid: totalPaid,
                startDate: startDate || '',
                endDate: endDate || '',
                layout: false
            });
        }
        catch (error) {
            console.error('Error printing paid:', error);
            res.status(500).send('Error loading print view');
        }
    }
}
exports.BookkeepingController = BookkeepingController;
//# sourceMappingURL=bookkeepingController.js.map