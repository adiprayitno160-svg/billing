"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePdfService = void 0;
// src/services/invoice/InvoicePdfService.ts
const puppeteer_1 = __importDefault(require("puppeteer"));
const InvoiceDataService_1 = require("./InvoiceDataService");
const path_1 = require("path");
const ejs_1 = __importDefault(require("ejs"));
const fs_1 = __importDefault(require("fs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
class InvoicePdfService {
    /**
     * Generate PDF (A4) for given invoice id.
     * Returns Buffer containing PDF data.
     *
     * NOTE: We use a Hybrid Approach (Screenshot -> PDFKit) because
     * Chromium's native 'printToPDF' is unstable on some Windows environments
     * and frequently throws 'Target closed' protocol errors.
     */
    static async generatePdf(invoiceId, retryCount = 0) {
        const MAX_RETRIES = 2;
        let browser = null;
        try {
            console.log(`[InvoicePdf] Fetching data for invoice ${invoiceId}...`);
            const invoice = await InvoiceDataService_1.InvoiceDataService.getInvoice(invoiceId);
            if (!invoice) {
                throw new Error(`Invoice #${invoiceId} not found in database`);
            }
            // Render EJS template to HTML
            const templatePath = (0, path_1.join)(process.cwd(), 'views', 'invoice', 'template-a4.ejs');
            if (!fs_1.default.existsSync(templatePath)) {
                throw new Error(`Invoice PDF template not found at: ${templatePath}`);
            }
            const html = await ejs_1.default.renderFile(templatePath, { invoice }, { async: true });
            console.log(`[InvoicePdf] Launching browser for screenshot-based PDF...`);
            browser = await puppeteer_1.default.launch({
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
                const chunks = [];
                // Use A4 size for PDF
                const doc = new pdfkit_1.default({ size: 'A4', margin: 0 });
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', err => reject(err));
                // Add image to cover the page
                // We use width: 595 (A4 width in points) to fit properly
                doc.image(screenshotBuffer, 0, 0, { width: 595 });
                doc.end();
            });
        }
        catch (err) {
            console.error(`[InvoicePdf] ❌ Error generating PDF for invoice ${invoiceId}:`, err.message);
            if (browser) {
                try {
                    await browser.close();
                }
                catch (e) { }
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
    static async generateInvoicePdf(invoiceId) {
        const buffer = await this.generatePdf(invoiceId);
        const invoicesDir = (0, path_1.join)(process.cwd(), 'public', 'invoices');
        if (!fs_1.default.existsSync(invoicesDir)) {
            fs_1.default.mkdirSync(invoicesDir, { recursive: true });
        }
        const filename = `invoice-${invoiceId}.pdf`;
        const filePath = (0, path_1.join)(invoicesDir, filename);
        fs_1.default.writeFileSync(filePath, buffer);
        if (!fs_1.default.existsSync(filePath) || fs_1.default.statSync(filePath).size === 0) {
            throw new Error(`Failed to write PDF file to ${filePath}`);
        }
        console.log(`[InvoicePdf] ✅ Hybrid PDF saved to ${filePath} (${fs_1.default.statSync(filePath).size} bytes)`);
        return filePath;
    }
}
exports.InvoicePdfService = InvoicePdfService;
//# sourceMappingURL=InvoicePdfService.js.map