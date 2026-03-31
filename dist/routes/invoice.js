"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/invoice.ts
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const InvoicePdfService_1 = require("../services/invoice/InvoicePdfService");
const InvoiceDataService_1 = require("../services/invoice/InvoiceDataService");
const logger_1 = require("../services/logger");
const path_1 = require("path");
const ejs_1 = __importDefault(require("ejs"));
const router = (0, express_1.Router)();
// API: Check existing invoices for period
router.get('/check-period', authMiddleware_1.isAuthenticated, async (req, res) => {
    try {
        const period = req.query.period;
        if (!period) {
            res.status(400).json({ success: false, error: 'Period is required' });
            return;
        }
        const { databasePool } = require('../db/pool');
        const [rows] = await databasePool.query('SELECT customer_id FROM invoices WHERE period = ?', [period]);
        res.json(rows);
    }
    catch (e) {
        logger_1.logger.error(`❌ Invoice check error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ------------------- Thermal Print (58mm) -------------------
router.get('/:id/print', authMiddleware_1.isAuthenticated, async (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await InvoiceDataService_1.InvoiceDataService.getInvoice(invoiceId);
        const templatePath = (0, path_1.join)(process.cwd(), 'views', 'invoice', 'template-thermal.ejs');
        const html = await ejs_1.default.renderFile(templatePath, { invoice }, { async: true });
        // Send raw HTML; client can use window.print() with CSS @media print width 58mm
        res.send(html);
    }
    catch (e) {
        logger_1.logger.error(`❌ Thermal print error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ------------------- PDF (A4) -------------------
router.get('/:id/pdf', authMiddleware_1.isAuthenticated, async (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const pdf = await InvoicePdfService_1.InvoicePdfService.generatePdf(invoiceId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceId}.pdf`);
        res.send(pdf);
    }
    catch (e) {
        logger_1.logger.error(`❌ PDF generation error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=invoice.js.map