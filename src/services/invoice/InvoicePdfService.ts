// src/services/invoice/InvoicePdfService.ts
import puppeteer from 'puppeteer';
import { logger } from '../../services/logger';
import { InvoiceDataService } from './InvoiceDataService';
import { join } from 'path';
import ejs from 'ejs';
import fs from 'fs';
import PDFDocument from 'pdfkit';

export class InvoicePdfService {
    /**
     * Generate PDF (A4) for given invoice id.
     * Returns Buffer containing PDF data.
     * 
     * NOTE: We use a Hybrid Approach (Screenshot -> PDFKit) because 
     * Chromium's native 'printToPDF' is unstable on some Windows environments 
     * and frequently throws 'Target closed' protocol errors.
     */
    static async generatePdf(invoiceId: number, retryCount: number = 0): Promise<Buffer> {
        const MAX_RETRIES = 2;
        let browser: any = null;

        try {
            console.log(`[InvoicePdf] Fetching data for invoice ${invoiceId}...`);
            const invoice = await InvoiceDataService.getInvoice(invoiceId);

            if (!invoice) {
                throw new Error(`Invoice #${invoiceId} not found in database`);
            }

            // Render EJS template to HTML
            const templatePath = join(process.cwd(), 'views', 'invoice', 'template-a4.ejs');
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Invoice PDF template not found at: ${templatePath}`);
            }

            const html = await ejs.renderFile(templatePath, { invoice }, { async: true });

            console.log(`[InvoicePdf] Launching browser for screenshot-based PDF...`);
            browser = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                headless: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote'
                ],
                timeout: 30000
            });

            const page = await browser.newPage();
            
            // Set viewport to A4-ish ratio at high DPI for sharpness
            // A4 is roughly 794x1123 at 96dpi. We use 2x scale.
            await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });

            console.log(`[InvoicePdf] Rendering content...`);
            await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

            console.log(`[InvoicePdf] Capturing high-quality screenshot...`);
            const screenshotBuffer = await page.screenshot({ 
                fullPage: true, 
                type: 'png'
            });

            await browser.close();
            browser = null;

            console.log(`[InvoicePdf] Wrapping screenshot in PDF via PDFKit...`);
            
            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                // Use A4 size for PDF
                const doc = new PDFDocument({ size: 'A4', margin: 0 });

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', err => reject(err));

                // Add image to cover the page
                // We use width: 595 (A4 width in points) to fit properly
                doc.image(screenshotBuffer, 0, 0, { width: 595 });
                
                doc.end();
            });

        } catch (err: any) {
            console.error(`[InvoicePdf] ❌ Error generating PDF for invoice ${invoiceId}:`, err.message);
            
            if (browser) {
                try { await browser.close(); } catch (e) { }
                browser = null;
            }

            if (retryCount < MAX_RETRIES) {
                console.log(`[InvoicePdf] Retrying... (attempt ${retryCount + 2})`);
                await new Promise(r => setTimeout(r, 2000));
                return this.generatePdf(invoiceId, retryCount + 1);
            }

            throw err;
        }
    }

    /**
     * Generate PDF and save to filesystem.
     * Returns absolute path to the generated PDF file.
     */
    static async generateInvoicePdf(invoiceId: number): Promise<string> {
        const buffer = await this.generatePdf(invoiceId);

        const invoicesDir = join(process.cwd(), 'public', 'invoices');
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
        }

        const filename = `invoice-${invoiceId}.pdf`;
        const filePath = join(invoicesDir, filename);

        fs.writeFileSync(filePath, buffer);

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error(`Failed to write PDF file to ${filePath}`);
        }

        console.log(`[InvoicePdf] ✅ Hybrid PDF saved to ${filePath} (${fs.statSync(filePath).size} bytes)`);
        return filePath;
    }
}
