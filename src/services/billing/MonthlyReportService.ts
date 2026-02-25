import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { WhatsAppService } from '../whatsapp/WhatsAppService';

export class MonthlyReportService {
    /**
     * Generate and send monthly finance report
     */
    static async generateAndSendMonthlyReport(): Promise<{ success: boolean; message: string }> {
        try {
            console.log('[MonthlyReport] Starting monthly report generation...');

            // 1. Get Head of Finance phone number
            const [settings] = await pool.query<RowDataPacket[]>(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'head_finance_phone' LIMIT 1"
            );
            const headFinancePhone = settings[0]?.setting_value;

            if (!headFinancePhone) {
                console.warn('[MonthlyReport] Head of Finance phone not set. Skipping report.');
                return { success: false, message: 'Head of Finance phone not set' };
            }

            // 2. Prepare Date Range (Previous Month)
            const now = new Date();
            // Get first day of last month
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            // Get last day of last month
            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

            const startDate = firstDayLastMonth.toISOString().split('T')[0]; // yyyy-MM-dd
            const endDate = lastDayLastMonth.toISOString().split('T')[0]; // yyyy-MM-dd

            // Format month name in Indonesian
            const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(firstDayLastMonth);
            const periodKey = `${firstDayLastMonth.getFullYear()}-${String(firstDayLastMonth.getMonth() + 1).padStart(2, '0')}`;

            // 3. Fetch Paid Invoices
            const [paidInvoices] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    p.payment_date,
                    p.amount as paid_amount,
                    p.payment_method,
                    i.invoice_number,
                    i.period,
                    c.name as customer_name,
                    c.customer_code
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                WHERE p.payment_date BETWEEN ? AND ?
                ORDER BY p.payment_date ASC
            `, [startDate + ' 00:00:00', endDate + ' 23:59:59']);

            // 4. Fetch Unpaid Invoices
            const [unpaidInvoices] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    i.invoice_number,
                    i.period,
                    i.total_amount,
                    i.paid_amount,
                    (i.total_amount - i.paid_amount) as remaining_amount,
                    i.due_date,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND i.period = ?
                ORDER BY c.name ASC
            `, [periodKey]);

            // 5. Generate PDF
            const tempDir = path.join(process.cwd(), 'storage', 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const fileName = `Laporan_Keuangan_${periodKey.replace('-', '_')}.pdf`;
            const filePath = path.join(tempDir, fileName);

            await this.generatePDF(filePath, monthName, paidInvoices, unpaidInvoices);

            // 6. Send via WhatsApp
            const waService = WhatsAppService.getInstance();
            const caption = `*LAPORAN KEUANGAN BULANAN*\nPeriode: ${monthName}\n\nLaporan terlampir mencakup:\n- Daftar pembayaran masuk\n- Daftar tagihan belum lunas\n\n_Pesan otomatis dari Sistem Billing_`;

            await waService.sendDocument(headFinancePhone, filePath, fileName, caption);

            console.log(`[MonthlyReport] Report sent to ${headFinancePhone}`);

            return { success: true, message: 'Laporan berhasil dikirim' };
        } catch (error) {
            console.error('[MonthlyReport] Error:', error);
            return { success: false, message: 'Gagal membuat laporan' };
        }
    }

    private static async generatePDF(filePath: string, monthName: string, paid: any[], unpaid: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // Header
            doc.fontSize(18).text('LAPORAN KEUANGAN BULANAN', { align: 'center' });
            doc.fontSize(14).text(`Periode: ${monthName}`, { align: 'center' });
            doc.moveDown();
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
            doc.moveDown();

            // Summary
            const totalPaid = paid.reduce((sum, p) => sum + parseFloat(p.paid_amount || 0), 0);
            const totalUnpaid = unpaid.reduce((sum, u) => sum + parseFloat(u.remaining_amount || 0), 0);

            doc.fontSize(12).text('Ringkasan:', { underline: true });
            doc.text(`Total Pembayaran Masuk: Rp ${totalPaid.toLocaleString('id-ID')}`);
            doc.text(`Total Tagihan Belum Lunas: Rp ${totalUnpaid.toLocaleString('id-ID')}`);
            doc.moveDown();

            // Paid Section
            doc.fontSize(14).fillColor('green').text('DAFTAR PEMBAYARAN MASUK', { underline: true });
            doc.fillColor('black').fontSize(10);
            doc.moveDown(0.5);

            // Paid Table Header
            const paidStartY = doc.y;
            doc.text('Tgl', 30, paidStartY, { width: 60 });
            doc.text('Nama Pelanggan', 90, paidStartY, { width: 150 });
            doc.text('Invoice', 240, paidStartY, { width: 100 });
            doc.text('Metode', 340, paidStartY, { width: 80 });
            doc.text('Jumlah', 420, paidStartY, { width: 100, align: 'right' });
            doc.moveDown(0.5);
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
            doc.moveDown(0.3);

            paid.forEach(p => {
                if (doc.y > 750) doc.addPage();
                const y = doc.y;
                const pDate = new Date(p.payment_date);
                const dateStr = `${String(pDate.getDate()).padStart(2, '0')}/${String(pDate.getMonth() + 1).padStart(2, '0')}`;

                doc.text(dateStr, 30, y, { width: 60 });
                doc.text((p.customer_name || '').substring(0, 25), 90, y, { width: 150 });
                doc.text(p.invoice_number || '-', 240, y, { width: 100 });
                doc.text(p.payment_method || '-', 340, y, { width: 80 });
                doc.text(`Rp ${parseFloat(p.paid_amount || 0).toLocaleString('id-ID')}`, 420, y, { width: 100, align: 'right' });
                doc.moveDown(1.2);
            });

            doc.moveDown();

            // Unpaid Section
            if (doc.y > 700) doc.addPage();
            doc.fontSize(14).fillColor('red').text('DAFTAR TAGIHAN BELUM LUNAS', { underline: true });
            doc.fillColor('black').fontSize(10);
            doc.moveDown(0.5);

            // Unpaid Table Header
            const unpaidStartY = doc.y;
            doc.text('Pelanggan', 30, unpaidStartY, { width: 180 });
            doc.text('Invoice', 210, unpaidStartY, { width: 100 });
            doc.text('Jatuh Tempo', 310, unpaidStartY, { width: 80 });
            doc.text('Sisa Tagihan', 420, unpaidStartY, { width: 100, align: 'right' });
            doc.moveDown(0.5);
            doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke();
            doc.moveDown(0.3);

            unpaid.forEach(u => {
                if (doc.y > 750) doc.addPage();
                const y = doc.y;
                doc.text(`${u.customer_name || 'N/A'} (${u.customer_code || '-'})`.substring(0, 35), 30, y, { width: 180 });
                doc.text(u.invoice_number || '-', 210, y, { width: 100 });

                let dueDateStr = '-';
                if (u.due_date) {
                    const dDate = new Date(u.due_date);
                    dueDateStr = `${String(dDate.getDate()).padStart(2, '0')}/${String(dDate.getMonth() + 1).padStart(2, '0')}/${String(dDate.getFullYear()).substring(2)}`;
                }

                doc.text(dueDateStr, 310, y, { width: 80 });
                doc.text(`Rp ${parseFloat(u.remaining_amount || 0).toLocaleString('id-ID')}`, 420, y, { width: 100, align: 'right' });
                doc.moveDown(1.2);
            });

            // Footer
            const printDate = new Intl.DateTimeFormat('id-ID', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).format(new Date());
            doc.fontSize(8).fillColor('gray').text(`Dicetak pada: ${printDate}`, 30, 800, { align: 'center' });

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }
}
