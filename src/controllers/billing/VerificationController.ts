
import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { whatsappService } from '../../services/whatsapp';

export class VerificationController {
    /**
     * Show verification list page
     */
    static async index(req: Request, res: Response): Promise<void> {
        try {
            res.render('billing/verification', {
                title: 'Verifikasi Pembayaran',
                currentPath: '/billing/verification',
                user: (req.session as any).user
            });
        } catch (error) {
            console.error('Error loading verification page:', error);
            res.status(500).render('error', {
                error: 'Failed to load verification page',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get pending verifications (AJAX)
     */
    static async getList(req: Request, res: Response): Promise<void> {
        try {
            const { status = 'pending', page = 1, limit = 20 } = req.query;
            const offset = (Number(page) - 1) * Number(limit);

            const [rows] = await databasePool.query<any[]>(`
                SELECT mpv.*, c.name as customer_name, c.phone as customer_phone
                FROM manual_payment_verifications mpv
                LEFT JOIN customers c ON mpv.customer_id = c.id
                WHERE mpv.status = ?
                ORDER BY mpv.created_at DESC
                LIMIT ? OFFSET ?
            `, [status, Number(limit), offset]);

            // Get total count
            const [countRows] = await databasePool.query<any[]>(`
                SELECT COUNT(*) as total FROM manual_payment_verifications WHERE status = ?
            `, [status]);

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
                data: rows,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: countRows[0].total
                },
                stats: statsRows[0] || { pending: 0, approved: 0, rejected: 0, today: 0 }
            });
        } catch (error: any) {
            console.error('Error fetching verifications:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to fetch verifications'
            });
        }
    }

    /**
     * Get single verification detail (AJAX)
     */
    static async getDetail(req: Request, res: Response): Promise<void> {
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
            console.error('Error fetching detail:', error);
            res.json({
                success: false,
                error: error.message
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
     * Process verification
     */
    static async process(req: Request, res: Response): Promise<void> {
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
                        const { whatsappService } = await import('../../services/whatsapp');
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
                // Check if any other unpaid invoices exist
                const [unpaidCheck] = await connection.query<any[]>(
                    `SELECT COUNT(*) as count FROM invoices 
                     WHERE customer_id = ? AND id != ? AND status != 'paid' AND remaining_amount > 0`,
                    [customerId, invoiceId]
                );

                if (unpaidCheck[0]?.count === 0) {
                    // Check if isolated
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

            // Send Success Notification
            const [custRows] = await connection.query<any[]>(
                'SELECT phone FROM customers WHERE id = ?',
                [customerId]
            );

            await connection.commit();

            // Send success notification with receipt
            if (custRows[0]?.phone) {
                try {
                    // Generate receipt reference number
                    const receiptRef = `RCP-${Date.now().toString().slice(-8)}`;
                    const now = new Date();
                    const paymentDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                    const paymentTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                    // Get customer name
                    const [custNameRows] = await databasePool.query<any[]>(
                        'SELECT name FROM customers WHERE id = ?', [customerId]
                    );
                    const customerName = custNameRows[0]?.name || 'Pelanggan';

                    const { whatsappService } = await import('../../services/whatsapp');
                    await whatsappService.sendMessage(
                        custRows[0].phone,
                        `✅ *BUKTI PEMBAYARAN*\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `📋 *REF: ${receiptRef}*\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `👤 Pelanggan: *${customerName}*\n` +
                        `📄 No. Invoice: ${invoice.invoice_number}\n` +
                        `💰 Jumlah Bayar: *Rp ${paymentAmount.toLocaleString('id-ID')}*\n` +
                        `📊 Status: *${isFullPayment ? '✅ LUNAS' : '⚠️ Sebagian Dibayar'}*\n\n` +
                        `📅 Tanggal: ${paymentDate}\n` +
                        `🕐 Waktu: ${paymentTime} WIB\n\n` +
                        (isFullPayment ?
                            `🎉 Terima kasih atas pembayaran Anda!\nLayanan internet Anda tetap aktif.\n\n` :
                            `⚠️ Masih ada sisa tagihan: *Rp ${Math.max(0, newRemaining).toLocaleString('id-ID')}*\nSilakan lakukan pelunasan.\n\n`
                        ) +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `Simpan pesan ini sebagai bukti pembayaran.`
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
}
