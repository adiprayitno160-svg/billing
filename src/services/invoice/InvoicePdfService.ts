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
        const invoice = await InvoiceDataService.getInvoice(invoiceId);

        // Render EJS template to HTML (A4 layout)
        const templatePath = join(process.cwd(), 'views', 'invoice', 'template-a4.ejs');
        const html = await ejs.renderFile(templatePath, { invoice }, { async: true });

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        logger.info(`✅ PDF (A4) generated for invoice ${invoiceId}`);
        return Buffer.from(pdfBuffer);
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
