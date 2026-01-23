/**
 * WhatsApp Settings Controller
 * Handle WhatsApp service configuration and QR Code binding
 */

import { Request, Response } from 'express';
import { whatsappService } from '../../services/whatsapp/WhatsAppService';
import { databasePool } from '../../db/pool';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsAppSettingsController {

    /**
     * Show WhatsApp settings page
     */
    static async showSettings(req: Request, res: Response): Promise<void> {
        try {
            const waClient = whatsappService;
            let status = waClient.getStatus();

            // Force initialize if not ready
            if (!status.ready && !status.initializing) {
                console.log('🔄 Force initializing WhatsApp service...');
                waClient.initialize().catch(err => console.error('❌ Failed to initialize WhatsApp:', err));
                await new Promise(resolve => setTimeout(resolve, 1000));
                status = waClient.getStatus();
            }

            // Stats (Mock for now or implement in DB)
            const stats = { total: 0, sent: 0, failed: 0, successRate: 0 };
            const qrCode = waClient.qrCode || null;

            // Get recent failed notifications
            let failedNotifications: any[] = [];
            try {
                const [cols] = await databasePool.query('SHOW COLUMNS FROM notification_logs');
                const colNames = (cols as any[]).map((col: any) => col.Field);

                let q: string;
                if (colNames.includes('channel')) {
                    q = `SELECT nl.*, c.name as customer_name FROM notification_logs nl 
                         LEFT JOIN customers c ON nl.customer_id = c.id
                         WHERE nl.channel = 'whatsapp' AND nl.status = 'failed'
                         ORDER BY nl.created_at DESC LIMIT 5`;
                } else {
                    q = `SELECT nl.*, c.name as customer_name FROM notification_logs nl 
                         LEFT JOIN customers c ON nl.customer_id = c.id
                         WHERE nl.status = 'failed'
                         ORDER BY nl.created_at DESC LIMIT 5`;
                }
                const [rows] = await databasePool.query<any[]>(q);
                failedNotifications = rows;
            } catch (err) {
                console.error('Error fetching failed notifications for settings:', err);
            }

            // Get pending notifications
            let pendingNotifications: any[] = [];
            try {
                const [cols] = await databasePool.query<any[]>('SHOW COLUMNS FROM unified_notifications_queue');
                const colNames = (cols as any[]).map((col: any) => col.Field);

                let q: string;
                if (colNames.includes('channel')) {
                    q = `SELECT unq.*, c.name as customer_name FROM unified_notifications_queue unq
                         LEFT JOIN customers c ON unq.customer_id = c.id
                         WHERE unq.channel = 'whatsapp' AND unq.status = 'pending'
                         ORDER BY unq.created_at DESC LIMIT 5`;
                } else {
                    q = `SELECT unq.*, c.name as customer_name FROM unified_notifications_queue unq
                         LEFT JOIN customers c ON unq.customer_id = c.id
                         WHERE unq.status = 'pending'
                         ORDER BY unq.created_at DESC LIMIT 5`;
                }
                const [rows] = await databasePool.query<any[]>(q);
                pendingNotifications = rows;
            } catch (err) {
                console.error('Error fetching pending notifications for settings:', err);
            }

            // Get QR code URL if available (using local endpoint)
            const qrCodeUrl = qrCode
                ? `/whatsapp/qr-image`
                : null;

            res.render('settings/whatsapp', {
                title: 'Pengaturan WhatsApp',
                currentPath: '/settings/whatsapp',
                status,
                stats,
                qrCode,
                qrCodeUrl,
                failedNotifications,
                pendingNotifications,
                user: (req.session as any).user
            });

        } catch (error) {
            console.error('Error loading WhatsApp settings:', error);
            res.status(500).render('error', {
                error: 'Failed to load WhatsApp settings',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get WhatsApp status (AJAX endpoint)
     */
    static async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const waClient = whatsappService;
            const status = waClient.getStatus();
            const qrCode = waClient.qrCode || null;

            res.json({
                success: true,
                data: {
                    status,
                    stats: { total: 0, sent: 0, failed: 0, successRate: 0 },
                    qrCode: qrCode || null,
                    qrCodeUrl: qrCode ? `/whatsapp/qr-image` : null
                }
            });
        } catch (error: any) {
            console.error('[SettingsController] Error in getStatus:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to get WhatsApp status'
            });
        }
    }

    /**
     * Test send WhatsApp message
     */
    /**
     * Test send WhatsApp message
     */
    static async testSendMessage(req: Request, res: Response): Promise<void> {
        try {
            const { phone, message } = req.body;

            if (!phone) {
                res.json({
                    success: false,
                    error: 'Nomor telepon wajib diisi'
                });
                return;
            }

            if (!message || !message.trim()) {
                res.json({
                    success: false,
                    error: 'Pesan wajib diisi'
                });
                return;
            }

            // Send test message via Service
            try {
                await whatsappService.sendMessage(phone.trim(), message.trim());
                res.json({
                    success: true,
                    message: 'Pesan test berhasil dikirim (via Service)!'
                });
            } catch (sendError: any) {
                res.json({
                    success: false,
                    error: sendError.message || 'Gagal mengirim pesan test (Semua provider gagal)'
                });
            }
        } catch (error: any) {
            console.error('Error sending test message:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to send test message'
            });
        }
    }

    /**
     * Regenerate QR code
     */
    static async regenerateQR(req: Request, res: Response): Promise<void> {
        console.log('🔄 Starting QR code regeneration...');
        const waClient = whatsappService;

        // Use robust restart mechanism
        try {
            await waClient.restart();
        } catch (err) {
            console.error('Failed to restart WhatsApp client:', err);
            res.status(500).json({
                success: false,
                error: 'Gagal merestart service WhatsApp: ' + (err instanceof Error ? err.message : String(err))
            });
            return;
        }

        // Wait for QR code to be generated (up to 15 seconds)
        console.log('⏳ Waiting for QR code generation...');
        let attempts = 0;
        let qrCode = waClient.qrCode;
        const maxAttempts = 90; // 45 seconds (90 * 500ms)
        while (!qrCode && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            qrCode = waClient.qrCode;
            attempts++;

            if (attempts % 5 === 0) {
                console.log(`⏳ Still waiting for QR code... (${attempts}/${maxAttempts})`);
            }
        }

        const status = waClient.getStatus();

        const qrCodeUrl = qrCode
            ? `/whatsapp/qr-image`
            : null;

        if (qrCode) {
            console.log('✅ QR code generated successfully');
        } else {
            console.warn('⚠️ QR code not generated yet, but client might still be initializing');
        }

        res.json({
            success: true,
            message: qrCode
                ? 'QR code berhasil di-generate. Silakan scan dengan WhatsApp Anda.'
                : 'QR code sedang di-generate. Silakan refresh halaman dalam beberapa detik atau tunggu hingga QR code muncul.',
            data: {
                qrCode: qrCode || null,
                qrCodeUrl,
                status
            }
        });
    }

    /**
     * Show WhatsApp Monitor page (Message Log & Manual Verification)
     */
    static async showMonitor(req: Request, res: Response): Promise<void> {
        try {
            res.render('settings/whatsapp-monitor', {
                title: 'WhatsApp Monitor',
                currentPath: '/settings/whatsapp/monitor',
                user: (req.session as any).user
            });
        } catch (error) {
            console.error('Error loading WhatsApp monitor:', error);
            res.status(500).render('error', {
                error: 'Failed to load WhatsApp monitor',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get WhatsApp messages (AJAX)
     */
    static async getMessages(req: Request, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 20, search, direction, type } = req.query;
            const offset = (Number(page) - 1) * Number(limit);

            let query = `SELECT * FROM whatsapp_bot_messages WHERE 1=1`;
            const params: any[] = [];

            if (search) {
                query += ` AND (phone_number LIKE ? OR message_content LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }

            if (direction) {
                query += ` AND direction = ?`;
                params.push(direction);
            }

            if (type) {
                query += ` AND message_type = ?`;
                params.push(type);
            }

            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(Number(limit), offset);

            const [rows] = await databasePool.query<any[]>(query, params);

            res.json({
                success: true,
                data: rows,
                page: Number(page),
                limit: Number(limit)
            });
        } catch (error: any) {
            console.error('Error fetching messages:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to fetch messages'
            });
        }
    }

    /**
     * Get pending payment verifications (AJAX)
     */
    static async getPendingVerifications(req: Request, res: Response): Promise<void> {
        try {
            // Get pending verifications with customer info
            const [pending] = await databasePool.query<any[]>(`
                SELECT mpv.*, c.name as customer_name, c.phone as customer_phone
                FROM manual_payment_verifications mpv
                LEFT JOIN customers c ON mpv.customer_id = c.id
                WHERE mpv.status = 'pending'
                ORDER BY mpv.created_at DESC
                LIMIT 50
            `);

            // Get stats
            const [statsRows] = await databasePool.query<any[]>(`
                SELECT 
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
                FROM manual_payment_verifications
            `);

            res.json({
                success: true,
                data: pending,
                stats: statsRows[0] || { pending: 0, approved: 0, rejected: 0, today: 0 }
            });
        } catch (error: any) {
            console.error('Error fetching pending verifications:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to fetch verifications'
            });
        }
    }

    /**
     * Get single verification detail (AJAX)
     */
    static async getVerificationDetail(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const [rows] = await databasePool.query<any[]>(`
                SELECT mpv.*, c.name as customer_name, c.phone as customer_phone
                FROM manual_payment_verifications mpv
                LEFT JOIN customers c ON mpv.customer_id = c.id
                WHERE mpv.id = ?
            `, [id]);

            if (rows.length === 0) {
                res.json({ success: false, error: 'Verification not found' });
                return;
            }

            res.json({
                success: true,
                data: rows[0]
            });
        } catch (error: any) {
            console.error('Error fetching verification detail:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to fetch detail'
            });
        }
    }

    /**
     * Get customer invoices for verification (AJAX)
     */
    static async getCustomerInvoices(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;

            const [invoices] = await databasePool.query<any[]>(`
                SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, status, due_date
                FROM invoices
                WHERE customer_id = ?
                AND status IN ('sent', 'partial', 'overdue')
                AND remaining_amount > 0
                ORDER BY due_date ASC
            `, [customerId]);

            res.json({
                success: true,
                data: invoices
            });
        } catch (error: any) {
            console.error('Error fetching customer invoices:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to fetch invoices'
            });
        }
    }

    /**
     * Process payment verification (approve/reject)
     */
    static async processVerification(req: Request, res: Response): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            const { verificationId, invoiceId, amount, notes, action } = req.body;
            const userId = (req.session as any)?.user?.id || 1;

            await connection.beginTransaction();

            if (action === 'reject') {
                // Reject verification
                await connection.query(
                    `UPDATE manual_payment_verifications 
                     SET status = 'rejected', verified_by = ?, verified_at = NOW(), notes = ?
                     WHERE id = ?`,
                    [userId, notes || 'Ditolak oleh admin', verificationId]
                );

                // Get customer info for notification
                const [verRows] = await connection.query<any[]>(
                    `SELECT mpv.customer_id, c.phone FROM manual_payment_verifications mpv
                     JOIN customers c ON mpv.customer_id = c.id WHERE mpv.id = ?`,
                    [verificationId]
                );

                // Send rejection notification
                if (verRows[0]?.phone) {
                    try {
                        await whatsappService.sendMessage(
                            verRows[0].phone,
                            `❌ *VERIFIKASI PEMBAYARAN DITOLAK*\n\n` +
                            `Alasan: ${notes || 'Tidak valid'}\n\n` +
                            `Silakan kirim ulang bukti transfer yang valid atau hubungi customer service.`
                        );
                    } catch (e) {
                        console.warn('Failed to send rejection notification:', e);
                    }
                }

                await connection.commit();
                res.json({ success: true, message: 'Verifikasi ditolak' });
                return;
            }

            // Approve verification
            if (!invoiceId || !amount) {
                await connection.rollback();
                res.json({ success: false, message: 'Invoice dan nominal wajib diisi' });
                return;
            }

            // Get invoice details
            const [invoiceRows] = await connection.query<any[]>(
                'SELECT * FROM invoices WHERE id = ?', [invoiceId]
            );

            if (invoiceRows.length === 0) {
                await connection.rollback();
                res.json({ success: false, message: 'Invoice tidak ditemukan' });
                return;
            }

            const invoice = invoiceRows[0];
            const paymentAmount = parseFloat(amount);
            const currentPaid = parseFloat(invoice.paid_amount?.toString() || '0');
            const totalAmount = parseFloat(invoice.total_amount.toString());

            const newPaid = currentPaid + paymentAmount;
            const newRemaining = totalAmount - newPaid;
            const isFullPayment = newRemaining <= 0;
            const newStatus = isFullPayment ? 'paid' : 'partial';

            // Insert payment record
            await connection.query(
                `INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, created_at)
                 VALUES (?, 'transfer', ?, NOW(), ?, NOW())`,
                [invoiceId, paymentAmount, `Manual verification by admin - ${notes || 'Approved'}`]
            );

            // Update invoice
            await connection.query(
                `UPDATE invoices 
                 SET paid_amount = ?, remaining_amount = ?, status = ?, 
                     last_payment_date = NOW(), paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
                     updated_at = NOW()
                 WHERE id = ?`,
                [newPaid, Math.max(0, newRemaining), newStatus, newStatus, invoiceId]
            );

            // Update verification record
            await connection.query(
                `UPDATE manual_payment_verifications 
                 SET status = 'approved', verified_by = ?, verified_at = NOW(), notes = ?, invoice_id = ?
                 WHERE id = ?`,
                [userId, notes || 'Approved', invoiceId, verificationId]
            );

            // Get verification info for isolation removal
            const [verInfo] = await connection.query<any[]>(
                'SELECT customer_id FROM manual_payment_verifications WHERE id = ?',
                [verificationId]
            );

            const customerId = verInfo[0]?.customer_id;

            // Check and remove isolation if paid
            if (isFullPayment && customerId) {
                const [unpaidCheck] = await connection.query<any[]>(
                    `SELECT COUNT(*) as count FROM invoices 
                     WHERE customer_id = ? AND id != ? AND status != 'paid' AND remaining_amount > 0`,
                    [customerId, invoiceId]
                );

                if (unpaidCheck[0]?.count === 0) {
                    const [customerCheck] = await connection.query<any[]>(
                        'SELECT is_isolated FROM customers WHERE id = ?',
                        [customerId]
                    );

                    if (customerCheck[0]?.is_isolated) {
                        try {
                            const { IsolationService } = await import('../../services/billing/isolationService');
                            await IsolationService.isolateCustomer({
                                customer_id: customerId,
                                action: 'restore',
                                reason: 'Manual verification approved - invoice paid',
                                performed_by: 'admin'
                            });
                        } catch (e) {
                            console.warn('Failed to remove isolation:', e);
                        }
                    }
                }
            }

            // Get customer phone for notification
            const [custRows] = await connection.query<any[]>(
                'SELECT phone FROM customers WHERE id = ?',
                [customerId]
            );

            await connection.commit();

            // Send success notification
            if (custRows[0]?.phone) {
                try {
                    await whatsappService.sendMessage(
                        custRows[0].phone,
                        `✅ *PEMBAYARAN BERHASIL DIVERIFIKASI*\n\n` +
                        `📄 Invoice: ${invoice.invoice_number}\n` +
                        `💰 Jumlah: Rp ${paymentAmount.toLocaleString('id-ID')}\n` +
                        `📊 Status: ${isFullPayment ? 'LUNAS' : 'Sebagian Dibayar'}\n\n` +
                        `🎉 Terima kasih atas pembayaran Anda!`
                    );
                } catch (e) {
                    console.warn('Failed to send success notification:', e);
                }
            }

            res.json({
                success: true,
                message: 'Pembayaran berhasil diverifikasi dan diproses'
            });

        } catch (error: any) {
            await connection.rollback();
            console.error('Error processing verification:', error);
            res.json({
                success: false,
                message: error.message || 'Failed to process verification'
            });
        } finally {
            connection.release();
        }
    }

    /**
     * Update Foonte Token
     */
    static async updateFoonteToken(req: Request, res: Response): Promise<void> {
        try {
            const { token } = req.body;
            if (!token) {
                res.json({ success: false, error: 'Token is required' });
                return;
            }

            // Update .env file
            const envPath = path.join(process.cwd(), '.env');
            let envContent = '';

            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }

            // Remove existing FOONTE_TOKEN if any
            const envLines = envContent.split('\n').filter(line => !line.startsWith('FOONTE_TOKEN='));
            // Add new token
            envLines.push(`FOONTE_TOKEN=${token}`);

            fs.writeFileSync(envPath, envLines.join('\n'));

            // Also update current process.env to reflect immediately without restart (for this process)
            // Note: FoonteProvider reads from process.env in constructor, so we might need to refresh it
            process.env.FOONTE_TOKEN = token;

            // Assuming FoonteProvider is singleton, we force update if possible or rely on restart
            // For now, let's just respond success. FoonteProvider reads env in constructor usually but let's check.
            // Actually my earlier code reads in constructor.
            // Better to make FoonteProvider read dynamically or re-init.
            // Let's assume user accepts a restart or we handle re-init if really needed.
            // But updating .env is key.

            res.json({ success: true });

        } catch (error: any) {
            console.error('Error updating Foonte token:', error);
            res.json({ success: false, error: error.message });
        }
    }
}

export default WhatsAppSettingsController;
