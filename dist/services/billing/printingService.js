"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintingService = void 0;
const node_thermal_printer_1 = require("node-thermal-printer");
const qrcode_1 = __importDefault(require("qrcode"));
class PrintingService {
    /**
     * Initialize printer
     */
    static async initializePrinter(printerName = 'POS-58') {
        try {
            this.printer = new node_thermal_printer_1.ThermalPrinter({
                type: node_thermal_printer_1.PrinterTypes.EPSON,
                interface: `printer:${printerName}`,
                characterSet: node_thermal_printer_1.CharacterSet.PC852_LATIN2,
                removeSpecialCharacters: false,
                lineCharacter: "=",
                options: {
                    timeout: 3000,
                }
            });
            const isConnected = await this.printer.isPrinterConnected();
            if (!isConnected) {
                throw new Error('Printer not connected');
            }
        }
        catch (error) {
            console.error('Failed to initialize printer:', error);
            throw error;
        }
    }
    /**
     * Print single invoice
     */
    static async printInvoice(printData) {
        if (!this.printer) {
            await this.initializePrinter();
        }
        try {
            const printer = this.printer;
            printer.clear();
            // Header
            printer.alignCenter();
            printer.setTextSize(1, 1);
            printer.bold(true);
            printer.println("================================");
            printer.println("        INVOICE TAGIHAN");
            printer.println("================================");
            printer.bold(false);
            printer.newLine();
            // Invoice info
            printer.alignLeft();
            printer.setTextSize(0, 0);
            printer.println(`No. Invoice: ${printData.invoice_number}`);
            printer.println(`Periode    : ${printData.period}`);
            printer.println(`Jatuh Tempo: ${printData.due_date}`);
            printer.newLine();
            // Customer info
            printer.println("PELANGGAN:");
            printer.println(`Nama  : ${printData.customer_name}`);
            printer.println(`Telp  : ${printData.customer_phone}`);
            printer.println(`Alamat: ${printData.customer_address}`);
            printer.newLine();
            // Items
            printer.println("DETAIL TAGIHAN:");
            printer.println("--------------------------------");
            for (const item of printData.items) {
                printer.println(item.description);
                printer.println(`  ${item.quantity} x Rp ${item.unit_price.toLocaleString('id-ID')} = Rp ${item.total_price.toLocaleString('id-ID')}`);
            }
            printer.println("--------------------------------");
            // Totals
            printer.alignRight();
            printer.println(`Subtotal    : Rp ${printData.subtotal.toLocaleString('id-ID')}`);
            if (printData.discount_amount > 0) {
                printer.println(`Diskon      : Rp ${printData.discount_amount.toLocaleString('id-ID')}`);
            }
            printer.bold(true);
            printer.println(`TOTAL       : Rp ${printData.total_amount.toLocaleString('id-ID')}`);
            printer.bold(false);
            if (printData.paid_amount > 0) {
                printer.println(`Dibayar     : Rp ${printData.paid_amount.toLocaleString('id-ID')}`);
                printer.println(`Sisa        : Rp ${printData.remaining_amount.toLocaleString('id-ID')}`);
            }
            printer.newLine();
            // Payment QR Code (if payment URL provided)
            if (printData.payment_url) {
                try {
                    const qrCodeDataURL = await qrcode_1.default.toDataURL(printData.payment_url, {
                        width: 200,
                        margin: 1
                    });
                    printer.alignCenter();
                    printer.println("SCAN UNTUK BAYAR:");
                    // Note: Thermal printer might not support QR code directly
                    // You might need to use a different approach or library
                    printer.println(printData.payment_url);
                }
                catch (error) {
                    console.error('Failed to generate QR code:', error);
                }
            }
            // Footer
            printer.newLine();
            printer.alignCenter();
            printer.println("Terima kasih atas kepercayaan Anda");
            printer.println("Hubungi kami jika ada pertanyaan");
            printer.newLine();
            printer.newLine();
            printer.newLine();
            // Cut paper
            printer.cut();
            // Execute print
            await printer.execute();
            return true;
        }
        catch (error) {
            console.error('Print failed:', error);
            return false;
        }
    }
    /**
     * Print batch invoices by ODC
     */
    static async printBatchByOdc(odcId, period) {
        const { databasePool } = await Promise.resolve().then(() => __importStar(require('../../db/pool')));
        // Get invoices for ODC and period
        const query = `
            SELECT i.*, c.name as customer_name, c.phone, c.address,
                   odc.name as odc_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            WHERE c.odc_id = ? AND i.period = ?
            ORDER BY c.name
        `;
        const [result] = await databasePool.execute(query, [odcId, period]);
        let printed = 0;
        let failed = 0;
        // Batch fetch all invoice items at once to avoid N+1 query problem
        const invoiceIds = result.map(inv => inv.id);
        let itemsMap = new Map();
        if (invoiceIds.length > 0) {
            const itemsQuery = `
                SELECT invoice_id, description, quantity, unit_price, total_price
                FROM invoice_items 
                WHERE invoice_id IN (?)
            `;
            const [itemsResult] = await databasePool.execute(itemsQuery, [invoiceIds]);
            // Group items by invoice_id
            for (const item of itemsResult) {
                if (!itemsMap.has(item.invoice_id)) {
                    itemsMap.set(item.invoice_id, []);
                }
                itemsMap.get(item.invoice_id).push(item);
            }
        }
        for (const invoice of result) {
            try {
                // Get invoice items from pre-fetched map
                const itemsResult = itemsMap.get(invoice.id) || [];
                const printData = {
                    invoice_id: invoice.id,
                    customer_name: invoice.customer_name,
                    customer_phone: invoice.phone,
                    customer_address: invoice.address,
                    invoice_number: invoice.invoice_number,
                    period: invoice.period,
                    due_date: invoice.due_date || new Date().toISOString().split('T')[0],
                    items: itemsResult,
                    subtotal: parseFloat(invoice.subtotal || 0),
                    discount_amount: parseFloat(invoice.discount_amount || 0),
                    total_amount: parseFloat(invoice.total_amount || 0),
                    paid_amount: parseFloat(invoice.paid_amount || 0),
                    remaining_amount: parseFloat(invoice.remaining_amount)
                };
                const success = await this.printInvoice(printData);
                if (success) {
                    printed++;
                }
                else {
                    failed++;
                }
                // Small delay between prints
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                console.error(`Failed to print invoice ${invoice.id}:`, error);
                failed++;
            }
        }
        return { printed, failed };
    }
    /**
     * Test printer connection
     */
    static async testPrinter(printerName = 'POS-58') {
        try {
            await this.initializePrinter(printerName);
            if (!this.printer) {
                return false;
            }
            const printer = this.printer;
            printer.clear();
            printer.alignCenter();
            printer.bold(true);
            printer.println("TEST PRINTER");
            printer.bold(false);
            printer.println("Printer berfungsi dengan baik");
            printer.newLine();
            printer.newLine();
            printer.cut();
            await printer.execute();
            return true;
        }
        catch (error) {
            console.error('Printer test failed:', error);
            return false;
        }
    }
    /**
     * Get printer status
     */
    static async getPrinterStatus() {
        try {
            if (!this.printer) {
                await this.initializePrinter();
            }
            const isConnected = await this.printer.isPrinterConnected();
            return { connected: isConnected };
        }
        catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)
            };
        }
    }
    /**
     * Generate PDF fallback (if printer not available)
     */
    static async generatePdfInvoice(printData) {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        return new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            // PDF content
            doc.fontSize(16).text('INVOICE TAGIHAN', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`No. Invoice: ${printData.invoice_number}`);
            doc.text(`Periode: ${printData.period}`);
            doc.text(`Jatuh Tempo: ${printData.due_date}`);
            doc.moveDown();
            doc.text('PELANGGAN:');
            doc.text(`Nama: ${printData.customer_name}`);
            doc.text(`Telp: ${printData.customer_phone}`);
            doc.text(`Alamat: ${printData.customer_address}`);
            doc.moveDown();
            doc.text('DETAIL TAGIHAN:');
            for (const item of printData.items) {
                doc.text(`${item.description} - ${item.quantity} x Rp ${item.unit_price.toLocaleString('id-ID')} = Rp ${item.total_price.toLocaleString('id-ID')}`);
            }
            doc.moveDown();
            doc.text(`Total: Rp ${printData.total_amount.toLocaleString('id-ID')}`);
            doc.end();
        });
    }
}
exports.PrintingService = PrintingService;
PrintingService.printer = null;
//# sourceMappingURL=printingService.js.map