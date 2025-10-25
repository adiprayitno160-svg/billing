import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import QRCode from 'qrcode';

export interface PrintData {
    invoice_id: number;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    invoice_number: string;
    period: string;
    due_date: string;
    items: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }>;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    payment_url?: string;
}

export class PrintingService {
    private static printer: ThermalPrinter | null = null;

    /**
     * Initialize printer
     */
    static async initializePrinter(printerName: string = 'POS-58'): Promise<void> {
        try {
            this.printer = new ThermalPrinter({
                type: PrinterTypes.EPSON,
                interface: `printer:${printerName}`,
                characterSet: CharacterSet.PC852_LATIN2,
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
        } catch (error) {
            console.error('Failed to initialize printer:', error);
            throw error;
        }
    }

    /**
     * Print single invoice
     */
    static async printInvoice(printData: PrintData): Promise<boolean> {
        if (!this.printer) {
            await this.initializePrinter();
        }

        try {
            const printer = this.printer!;
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
                    const qrCodeDataURL = await QRCode.toDataURL(printData.payment_url, {
                        width: 200,
                        margin: 1
                    });
                    
                    printer.alignCenter();
                    printer.println("SCAN UNTUK BAYAR:");
                    // Note: Thermal printer might not support QR code directly
                    // You might need to use a different approach or library
                    printer.println(printData.payment_url);
                } catch (error) {
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

        } catch (error) {
            console.error('Print failed:', error);
            return false;
        }
    }

    /**
     * Print batch invoices by ODC
     */
    static async printBatchByOdc(odcId: number, period: string): Promise<{printed: number, failed: number}> {
        const { databasePool } = await import('../../db/pool');
        
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

        for (const invoice of result as any[]) {
            try {
                // Get invoice items
                const itemsQuery = `
                    SELECT description, quantity, unit_price, total_price
                    FROM invoice_items 
                    WHERE invoice_id = ?
                `;
                
                const [itemsResult] = await databasePool.execute(itemsQuery, [(invoice as any).id]);
                
                const printData: PrintData = {
                    invoice_id: (invoice as any).id,
                    customer_name: (invoice as any).customer_name,
                    customer_phone: (invoice as any).phone,
                    customer_address: (invoice as any).address,
                    invoice_number: (invoice as any).invoice_number,
                    period: (invoice as any).period,
                    due_date: (invoice as any).due_date || new Date().toISOString().split('T')[0],
                    items: (itemsResult as any),
                    subtotal: parseFloat((invoice as any).subtotal || 0),
                    discount_amount: parseFloat((invoice as any).discount_amount || 0),
                    total_amount: parseFloat((invoice as any).total_amount || 0),
                    paid_amount: parseFloat((invoice as any).paid_amount || 0),
                    remaining_amount: parseFloat((invoice as any).remaining_amount)
                };

                const success = await this.printInvoice(printData);
                if (success) {
                    printed++;
                } else {
                    failed++;
                }

                // Small delay between prints
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Failed to print invoice ${(invoice as any).id}:`, error);
                failed++;
            }
        }

        return { printed, failed };
    }

    /**
     * Test printer connection
     */
    static async testPrinter(printerName: string = 'POS-58'): Promise<boolean> {
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

        } catch (error) {
            console.error('Printer test failed:', error);
            return false;
        }
    }

    /**
     * Get printer status
     */
    static async getPrinterStatus(): Promise<{connected: boolean, error?: string}> {
        try {
            if (!this.printer) {
                await this.initializePrinter();
            }

            const isConnected = await this.printer!.isPrinterConnected();
            return { connected: isConnected };

        } catch (error) {
            return { 
                connected: false, 
                error: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error) 
            };
        }
    }

    /**
     * Generate PDF fallback (if printer not available)
     */
    static async generatePdfInvoice(printData: PrintData): Promise<Buffer> {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4' });
        
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        
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
