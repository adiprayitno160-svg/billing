"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePdfService = void 0;
// src/services/invoice/InvoicePdfService.ts
const puppeteer_1 = __importDefault(require("puppeteer"));
const logger_1 = require("../../services/logger");
const InvoiceDataService_1 = require("./InvoiceDataService");
const path_1 = require("path");
const ejs_1 = __importDefault(require("ejs"));
class InvoicePdfService {
    /**
     * Generate PDF (A4) for given invoice id.
     * Returns Buffer containing PDF data.
     */
    static async generatePdf(invoiceId) {
        const invoice = await InvoiceDataService_1.InvoiceDataService.getInvoice(invoiceId);
        // Render EJS template to HTML (A4 layout)
        const templatePath = (0, path_1.join)(process.cwd(), 'views', 'invoice', 'template-a4.ejs');
        const html = await ejs_1.default.renderFile(templatePath, { invoice }, { async: true });
        const browser = await puppeteer_1.default.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        logger_1.logger.info(`✅ PDF (A4) generated for invoice ${invoiceId}`);
        return Buffer.from(pdfBuffer);
    }
    /**
     * Generate PDF and save to filesystem.
     * Returns absolute path to the generated PDF file.
     */
    static async generateInvoicePdf(invoiceId) {
        // 1. Generate Buffer
        const buffer = await this.generatePdf(invoiceId);
        // 2. Prepare Directory
        const invoicesDir = (0, path_1.join)(process.cwd(), 'public', 'invoices');
        if (!require('fs').existsSync(invoicesDir)) {
            require('fs').mkdirSync(invoicesDir, { recursive: true });
        }
        // 3. Save File
        const filename = `invoice-${invoiceId}.pdf`;
        const filePath = (0, path_1.join)(invoicesDir, filename);
        require('fs').writeFileSync(filePath, buffer);
        return filePath;
    }
}
exports.InvoicePdfService = InvoicePdfService;
