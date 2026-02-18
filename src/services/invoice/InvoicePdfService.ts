// src/services/invoice/InvoicePdfService.ts
import puppeteer from 'puppeteer';
import { logger } from '../../services/logger';
import { InvoiceDataService } from './InvoiceDataService';
import { join } from 'path';
import ejs from 'ejs';

export class InvoicePdfService {
    /**
     * Generate PDF (A4) for given invoice id.
     * Returns Buffer containing PDF data.
     */
    static async generatePdf(invoiceId: number): Promise<Buffer> {
        console.log(`[InvoicePdf] Fetching data for invoice ${invoiceId}...`);
        const invoice = await InvoiceDataService.getInvoice(invoiceId);

        // Render EJS template to HTML (A4 layout)
        console.log(`[InvoicePdf] Rendering template...`);
        const templatePath = join(process.cwd(), 'views', 'invoice', 'template-a4.ejs');
        const html = await ejs.renderFile(templatePath, { invoice }, { async: true });

        console.log(`[InvoicePdf] Launching browser...`);
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        try {
            console.log(`[InvoicePdf] Opening new page...`);
            const page = await browser.newPage();

            console.log(`[InvoicePdf] Setting content...`);
            await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

            console.log(`[InvoicePdf] Generating PDF...`);
            const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

            console.log(`[InvoicePdf] PDF generated, closing browser...`);
            await browser.close();

            logger.info(`✅ PDF (A4) generated for invoice ${invoiceId}`);
            return Buffer.from(pdfBuffer);
        } catch (err) {
            console.error(`[InvoicePdf] Error during page operations:`, err);
            await browser.close();
            throw err;
        }
    }
    /**
     * Generate PDF and save to filesystem.
     * Returns absolute path to the generated PDF file.
     */
    static async generateInvoicePdf(invoiceId: number): Promise<string> {
        // 1. Generate Buffer
        const buffer = await this.generatePdf(invoiceId);

        // 2. Prepare Directory
        const invoicesDir = join(process.cwd(), 'public', 'invoices');
        if (!require('fs').existsSync(invoicesDir)) {
            require('fs').mkdirSync(invoicesDir, { recursive: true });
        }

        // 3. Save File
        const filename = `invoice-${invoiceId}.pdf`;
        const filePath = join(invoicesDir, filename);

        require('fs').writeFileSync(filePath, buffer);

        return filePath;
    }
}
