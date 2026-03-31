// src/routes/invoice.ts
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware';
import { InvoicePdfService } from '../services/invoice/InvoicePdfService';
import { InvoiceDataService } from '../services/invoice/InvoiceDataService';
import { logger } from '../services/logger';
import { join } from 'path';
import ejs from 'ejs';

const router = Router();

// API: Check existing invoices for period
router.get('/check-period', isAuthenticated, async (req: Request, res: Response) => {
    try {
        const period = req.query.period as string;
        if (!period) {
            res.status(400).json({ success: false, error: 'Period is required' });
            return;
        }

        const { databasePool } = require('../db/pool');
        const [rows] = await databasePool.query('SELECT customer_id FROM invoices WHERE period = ?', [period]);
        res.json(rows);
    } catch (e: any) {
        logger.error(`❌ Invoice check error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ------------------- Thermal Print (58mm) -------------------
router.get('/:id/print', isAuthenticated, async (req: Request, res: Response) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await InvoiceDataService.getInvoice(invoiceId);
        const templatePath = join(process.cwd(), 'views', 'invoice', 'template-thermal.ejs');
        const html = await ejs.renderFile(templatePath, { invoice }, { async: true });
        // Send raw HTML; client can use window.print() with CSS @media print width 58mm
        res.send(html);
    } catch (e: any) {
        logger.error(`❌ Thermal print error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ------------------- PDF (A4) -------------------
router.get('/:id/pdf', isAuthenticated, async (req: Request, res: Response) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const pdf = await InvoicePdfService.generatePdf(invoiceId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceId}.pdf`);
        res.send(pdf);
    } catch (e: any) {
        logger.error(`❌ PDF generation error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
