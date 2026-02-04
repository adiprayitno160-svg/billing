import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import QRCode from 'qrcode';
import { isAuthenticated } from '../middlewares/authMiddleware';
import { BroadcastController } from '../controllers/whatsapp/BroadcastController';
import fs from 'fs';
import path from 'path';

const router = Router();

// Apply auth middleware to page routes (not API routes)
router.use((req, res, next) => {
    // Skip auth for API endpoints only
    if (req.path.startsWith('/status') ||
        req.path.startsWith('/qr') ||
        req.path.startsWith('/send') ||
        req.path.startsWith('/history') ||
        req.path.startsWith('/stats')) {
        return next();
    }
    // Apply auth for page routes
    return isAuthenticated(req, res, next);
});

/**
 * QRIS functionality
 */
router.get('/qris', isAuthenticated, (req, res) => {
    res.render('whatsapp/qris', { title: 'Kirim QRIS', layout: 'layouts/main' });
});

router.post('/send-qris', isAuthenticated, async (req, res) => {
    try {
        const { phone, qrisType } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: 'Nomor HP diperlukan' });

        const waClient = whatsappService;

        // Path to QRIS image (can be static or dynamic)
        // For demonstration, let's assume there's a static QRIS in public/assets
        const qrisPath = path.join(process.cwd(), 'public', 'assets', qrisType === 'dynamic' ? 'qris_dynamic.png' : 'qris_static.png');

        if (!fs.existsSync(qrisPath)) {
            return res.status(404).json({ success: false, error: 'File QRIS tidak ditemukan' });
        }

        const result = await waClient.sendImage(phone, qrisPath, 'Silakan scan QRIS berikut untuk pembayaran.');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Broadcast functionality
 */
router.get('/broadcast', isAuthenticated, (req, res) => {
    res.render('whatsapp/broadcast', { title: 'Broadcast Massal', layout: 'layouts/main' });
});

router.get('/api/broadcast/customers', isAuthenticated, BroadcastController.getCustomers);
router.post('/api/broadcast/send', isAuthenticated, BroadcastController.sendBroadcast);

/**
 * GET /whatsapp/status
 * Get WhatsApp service status
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const waClient = whatsappService;
        const status = waClient.getStatus();
        const stats = {
            sent: status.messagesSent,
            received: status.messagesReceived,
            total: status.messagesSent + status.messagesReceived,
            successRate: 100
        };

        const qrCode = status.qr;

        res.json({
            success: true,
            data: {
                ...status,
                stats,
                qrCode: qrCode || null,
                qrCodeUrl: qrCode ? `/whatsapp/qr-image` : null
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get WhatsApp status'
        });
    }
});

/**
 * GET /whatsapp/qr
 * Get QR code for WhatsApp authentication (JSON)
 */
router.get('/qr', async (req: Request, res: Response) => {
    try {
        const waClient = whatsappService;
        const status = waClient.getStatus();
        const qrCode = status.qr;

        if (!qrCode) {
            return res.json({
                success: false,
                message: status.ready ? 'WhatsApp sudah terhubung, tidak perlu QR code' : 'QR code belum tersedia. Tunggu beberapa saat atau regenerate QR code.',
                status
            });
        }

        res.json({
            success: true,
            data: {
                qrCode,
                qrCodeUrl: `/whatsapp/qr-image`,
                status
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get QR code'
        });
    }
});

/**
 * GET /whatsapp/qr-image
 * Get QR code as image (PNG)
 */
router.get('/qr-image', async (req: Request, res: Response) => {
    try {
        const waClient = whatsappService;
        const status = waClient.getStatus();
        const qrCode = status.qr;
        console.log(`[Route] /qr-image - Has QR: ${!!qrCode}`);

        if (!qrCode) {
            return res.status(404).json({
                success: false,
                error: 'QR code tidak tersedia'
            });
        }

        // Generate QR code as PNG buffer
        const qrCodeBuffer = await QRCode.toBuffer(qrCode, {
            type: 'png',
            width: 400,
            margin: 3,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        });

        // Set headers to prevent caching
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Add timestamp to prevent browser caching
        const timestamp = Date.now();
        res.setHeader('Last-Modified', new Date(timestamp).toUTCString());

        res.send(qrCodeBuffer);
    } catch (error: any) {
        console.error('Error generating QR code image:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate QR code image'
        });
    }
});

/**
 * POST /whatsapp/clear-session
 * Clear WhatsApp session to force new QR code generation
 */
router.post('/clear-session', async (req: Request, res: Response) => {
    try {
        console.log('🗑️ Clearing WhatsApp session...');
        const waClient = whatsappService;

        // Restart to generate new QR
        await waClient.logout();

        res.json({
            success: true,
            message: 'Session berhasil dihapus. Silakan tunggu QR code baru.',
            data: {
                status: waClient.getStatus()
            }
        });
    } catch (error: any) {
        console.error('Error clearing session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear session'
        });
    }
});

/**
 * POST /whatsapp/regenerate-qr
 * Regenerate QR code (will clear session if needed)
 */
router.post('/regenerate-qr', async (req: Request, res: Response) => {
    try {
        console.log('🔄 Regenerating QR code...');
        const waClient = whatsappService;

        // Re-initialize to trigger new QR
        await waClient.restart();

        // Wait longer for QR code to be generated (up to 10 seconds)
        let attempts = 0;
        let qrCode = waClient.getStatus().qr;
        while (!qrCode && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));
            qrCode = waClient.getStatus().qr;
            attempts++;
        }

        const status = waClient.getStatus();

        res.json({
            success: true,
            message: qrCode
                ? 'QR code berhasil di-generate. Silakan scan dengan WhatsApp Anda.'
                : 'QR code sedang di-generate. Silakan refresh halaman dalam beberapa detik.',
            data: {
                qrCode: qrCode || null,
                qrCodeUrl: qrCode ? `/whatsapp/qr-image` : null,
                status
            }
        });
    } catch (error: any) {
        console.error('Error regenerating QR code:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to regenerate QR code'
        });
    }
});

/**
 * POST /whatsapp/send
 * Send WhatsApp message
 */
router.post('/send', async (req: Request, res: Response) => {
    try {
        const { phone, message, customerId, template } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone and message are required'
            });
        }

        const waClient = whatsappService;
        const result = await waClient.sendMessage(phone, message);

        if (result.success) {
            res.json({
                success: true,
                data: { messageId: result.messageId || 'unknown' }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send message'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send WhatsApp message'
        });
    }
});

/**
 * POST /whatsapp/test-send-pdf
 * Send test PDF message
 */
router.post('/test-send-pdf', async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });

        const waClient = whatsappService;
        // Search for any PDF in the project to use as a test
        const testPdfPath = path.join(process.cwd(), 'temp_test.pdf');

        // Create a dummy PDF if not exists
        if (!fs.existsSync(testPdfPath)) {
            fs.writeFileSync(testPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [ 3 0 R ] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 612 792 ] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (WhatsApp Test PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000212 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n307\n%%EOF');
        }

        const result = await waClient.sendDocument(phone, testPdfPath, 'Test_Document.pdf', 'Ini adalah berkas PDF percobaan.');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /whatsapp/send-bulk
 * Send bulk WhatsApp messages
 */
router.post('/send-bulk', async (req: Request, res: Response) => {
    try {
        const { recipients, delayMs } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required'
            });
        }

        const waClient = whatsappService;
        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
            try {
                const result = await waClient.sendMessage(recipient.phone, recipient.message);
                if (result.success) {
                    sent++;
                } else {
                    failed++;
                }
                if (delayMs) await new Promise(r => setTimeout(r, delayMs));
            } catch (e) {
                failed++;
            }
        }

        const result = { sent, failed, total: recipients.length };

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send bulk messages'
        });
    }
});

/**
 * POST /whatsapp/send-to-customer
 * Send WhatsApp message to customer by ID
 */
router.post('/send-to-customer', async (req: Request, res: Response) => {
    try {
        const { customerId, message, template } = req.body;

        if (!customerId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID and message are required'
            });
        }

        // Get customer phone
        const [customerRows] = await databasePool.query<RowDataPacket[]>(
            'SELECT phone, name FROM customers WHERE id = ?',
            [customerId]
        );

        if (customerRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const customer = customerRows[0];

        if (!customer || !customer.phone) {
            return res.status(400).json({
                success: false,
                error: 'Customer phone number not found'
            });
        }

        const waClient = whatsappService;
        const result = await waClient.sendMessage(customer.phone, message);

        if (result.success) {
            res.json({
                success: true,
                data: { messageId: result.messageId || 'unknown' }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send message'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send WhatsApp message'
        });
    }
});

/**
 * GET /whatsapp/history
 * Get notification history
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
        const status = req.query.status as string | undefined;

        let query = `
            SELECT wbm.*, c.name as customer_name 
            FROM whatsapp_bot_messages wbm
            LEFT JOIN customers c ON wbm.customer_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (customerId) {
            query += ' AND whatsapp_bot_messages.customer_id = ?';
            params.push(customerId);
        }

        if (status) {
            query += ' AND whatsapp_bot_messages.status = ?';
            params.push(status);
        }

        query += ' ORDER BY whatsapp_bot_messages.created_at DESC LIMIT ?';
        params.push(limit);

        const [rows] = await databasePool.query<RowDataPacket[]>(query, params);

        res.json({
            success: true,
            data: rows
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get notification history'
        });
    }
});

/**
 * GET /whatsapp/stats
 * Get notification statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>(`
            SELECT 
                SUM(CASE WHEN direction = 'outbound' AND status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                COUNT(*) as total,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as received
            FROM whatsapp_bot_messages
        `);

        // Calculate success rate based on outbound
        const stats = rows[0];
        const outboundTotal = (parseInt(stats.sent) || 0) + (parseInt(stats.failed) || 0);
        const successRate = outboundTotal > 0 ? ((parseInt(stats.sent) || 0) / outboundTotal) * 100 : 100;

        res.json({
            success: true,
            data: {
                sent: parseInt(stats.sent) || 0,
                failed: parseInt(stats.failed) || 0,
                received: parseInt(stats.received) || 0,
                total: parseInt(stats.total) || 0,
                successRate: parseFloat(successRate.toFixed(2))
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get notification statistics'
        });
    }
});

/**
 * POST /whatsapp/send-payment-notification
 * Send payment notification to customer
 */
router.post('/send-payment-notification', async (req: Request, res: Response) => {
    try {
        const { customerId, invoiceId, amount, paymentMethod, paymentId, paymentType } = req.body;

        if (!customerId || !invoiceId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID and Invoice ID are required'
            });
        }

        // Get customer and invoice data
        const [customerRows] = await databasePool.query<RowDataPacket[]>(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
        );

        if (customerRows.length === 0 || !customerRows[0].phone) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found or phone number missing'
            });
        }

        const [invoiceRows] = await databasePool.query<RowDataPacket[]>(
            'SELECT * FROM invoices WHERE id = ?',
            [invoiceId]
        );

        if (invoiceRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        const customer = customerRows[0];
        const invoice = invoiceRows[0];

        if (!customer || !invoice) {
            return res.status(404).json({
                success: false,
                error: 'Customer or invoice not found'
            });
        }

        // Format message
        const { getBillingMonth } = await import('../utils/periodHelper');
        const paymentDate = new Date(); // Use current date for payment date
        const billingMonth = invoice.period ?
            getBillingMonth(invoice.period, paymentDate, invoice.due_date || null) :
            (invoice.period || '-');

        let message = '';
        const paymentMethodNames: { [key: string]: string } = {
            'cash': 'Tunai',
            'transfer': 'Transfer',
            'debit': 'Debit',
            'credit': 'Kredit',
            'qris': 'QRIS',
            'other': 'Lainnya'
        };

        if (paymentType === 'debt') {
            message = `
*HUTANG TERCATAT* 📝

Pelanggan: ${customer.name}
ID Pelanggan: ${customer.customer_code}

Detail Hutang:
📋 No. Invoice: ${invoice.invoice_number}
📅 Bulan Tagihan: ${billingMonth}
💰 Total Hutang: Rp ${invoice.remaining_amount.toLocaleString('id-ID')}
🆔 ID Pencatatan: #${paymentId}

⚠️ Pembayaran ditunda. Mohon segera melakukan pembayaran.

Terima kasih! 🙏
            `.trim();
        } else {
            const statusText = paymentType === 'full' ? 'LUNAS' : 'SEBAGIAN TERBAYAR';
            message = `
*PEMBAYARAN DITERIMA* ✅

Pelanggan: ${customer.name}
ID Pelanggan: ${customer.customer_code}

Detail Pembayaran:
📋 No. Invoice: ${invoice.invoice_number}
📅 Bulan Tagihan: ${billingMonth}
💰 Jumlah Bayar: Rp ${amount.toLocaleString('id-ID')}
💳 Metode: ${paymentMethodNames[paymentMethod] || paymentMethod}
🆔 ID Pembayaran: #${paymentId}
${paymentType === 'partial' ? `📊 Sisa Tagihan: Rp ${(invoice.remaining_amount - amount).toLocaleString('id-ID')}` : ''}

Terima kasih atas pembayaran Anda! 🙏

Status layanan Anda telah ${statusText}.
            `.trim();
        }

        const waClient = whatsappService;
        const result = await waClient.sendMessage(customer.phone, message);

        if (result.success) {
            res.json({
                success: true,
                data: { messageId: result.messageId || 'unknown' }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send message'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send payment notification'
        });
    }
});

/**
 * GET /whatsapp
 * Show WhatsApp notification management page
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const waClient = whatsappService;
        const status = waClient.getStatus();
        const qrCode = status.qr;
        const qrCodeUrl = qrCode ? `/whatsapp/qr-image` : null;

        // Get Stats
        const [statRows] = await databasePool.query<RowDataPacket[]>(`
            SELECT 
                SUM(CASE WHEN direction = 'outbound' AND status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                COUNT(*) as total,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as received
            FROM whatsapp_bot_messages
        `);

        const dbStats = statRows[0] || { sent: 0, failed: 0, total: 0, received: 0 };
        const outboundTotal = (parseInt(dbStats.sent) || 0) + (parseInt(dbStats.failed) || 0);
        const successRate = outboundTotal > 0 ? ((parseInt(dbStats.sent) || 0) / outboundTotal) * 100 : 100;

        const stats = {
            sent: parseInt(dbStats.sent) || 0,
            failed: parseInt(dbStats.failed) || 0,
            received: parseInt(dbStats.received) || 0,
            total: parseInt(dbStats.total) || 0,
            successRate: parseFloat(successRate.toFixed(2))
        };

        // Get recent notifications (History)
        const [history] = await databasePool.query<RowDataPacket[]>(`
            SELECT wbm.*, c.name as customer_name 
            FROM whatsapp_bot_messages wbm
            LEFT JOIN customers c ON wbm.customer_id = c.id
            ORDER BY wbm.created_at DESC
            LIMIT 10
        `);

        res.render('whatsapp/index', {
            title: 'WhatsApp Notifikasi',
            currentPath: '/whatsapp',
            status,
            stats,
            qrCode,
            qrCodeUrl,
            history,
            user: (req.session as any).user
        });
    } catch (error: any) {
        console.error('Error loading WhatsApp page:', error);
        res.status(500).render('error', {
            title: 'Error',
            status: 500,
            message: 'Failed to load WhatsApp page',
            error: error.message || 'Unknown error',
            user: (req.session as any).user
        });
    }
});

export default router;
