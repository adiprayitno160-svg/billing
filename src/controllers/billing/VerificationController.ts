
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

            // Optimized query: Don't select full image_data (too heavy)
            const [rows] = await databasePool.query<any[]>(`
                SELECT 
                    mpv.id, mpv.created_at, mpv.status, 
                    COALESCE(mpv.extracted_amount, mpv.expected_amount) as amount, 
                    mpv.reason as notes, 
                    0 as confidence_score, /* Default if column missing */
                    c.name as customer_name, c.phone as customer_phone,
                    CASE WHEN mpv.image_data IS NOT NULL AND mpv.image_data != '' THEN 1 ELSE 0 END as has_image
                FROM manual_payment_verifications mpv
                LEFT JOIN customers c ON mpv.customer_id = c.id
                WHERE mpv.status = ?
                ORDER BY mpv.created_at DESC
                LIMIT ? OFFSET ?
            `, [status, Number(limit), offset]);

            // Map has_image to proof_image URL
            const mappedRows = rows.map(r => ({
                ...r,
                proof_image: r.has_image ? `/billing/verification/image/${r.id}` : null
            }));

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
                data: mappedRows,
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

            const data = rows[0];

            // Map for frontend consistency
            data.notes = data.reason;
            data.amount = data.extracted_amount || data.expected_amount;

            // Transform for frontend
            if (data.image_data) {
                data.proof_image = `/billing/verification/image/${data.id}`;
                delete data.image_data; // Remove heavy data from JSON
            }

            res.json({
                success: true,
                data: data
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
     * Serve verification image raw
     */
    static async getImage(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const [rows] = await databasePool.query<any[]>(
                'SELECT image_data, image_mimetype FROM manual_payment_verifications WHERE id = ?',
                [id]
            );

            if (rows.length === 0 || !rows[0].image_data) {
                res.redirect('/images/no-image-placeholder.png'); // Fallback URL or 404
                return;
            }

            const img = rows[0];

            // Check if base64 or buffer
            let imgBuffer: Buffer;
            if (Buffer.isBuffer(img.image_data)) {
                imgBuffer = img.image_data;
            } else {
                // Assuming it's base64 string without prefix, or with prefix
                let base64 = img.image_data.toString();
                if (base64.includes('base64,')) {
                    base64 = base64.split('base64,')[1];
                }
                imgBuffer = Buffer.from(base64, 'base64');
            }

            res.setHeader('Content-Type', img.image_mimetype || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            res.send(imgBuffer);
        } catch (error) {
            console.error('Error serving verification image:', error);
            res.status(500).send('Image error');
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

            // Get invoice details with customer billing mode
            const [invoiceRows] = await connection.query<any[]>(
                'SELECT i.*, c.billing_mode FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?', [invoiceId]
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
            const remainingBeforePayment = parseFloat(invoice.remaining_amount?.toString() || (totalAmount - currentPaid).toString());

            let excessAmount = 0;
            if (paymentAmount > remainingBeforePayment) {
                excessAmount = paymentAmount - remainingBeforePayment;
            }

            const newPaid = currentPaid + paymentAmount;
            const newRemaining = Math.max(0, totalAmount - newPaid);
            const isFullPayment = newRemaining <= 2000; // Tolerance for rounding/small diff
            const newStatus = isFullPayment ? 'paid' : 'partial';

            // Handle Overpayment (Deposit to Balance) - ONLY for non-postpaid customers
            if (excessAmount > 0 && invoice.billing_mode !== 'postpaid') {
                await connection.query('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [excessAmount, invoice.customer_id]);

                await connection.query(`
                    INSERT INTO customer_balance_logs (
                        customer_id, type, amount, description, reference_id, created_at
                    ) VALUES (?, 'credit', ?, ?, ?, NOW())
                `, [invoice.customer_id, excessAmount, `Kelebihan pembayaran (verifikasi) invoice ${invoice.invoice_number}`, invoiceId.toString()]);
            }

            // Insert payment record
            const [paymentResult] = await connection.query<any>(
                `INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, created_at)
                 VALUES (?, 'transfer', ?, NOW(), ?, NOW())`,
                [invoiceId, paymentAmount, `Manual verification by admin - ${notes || 'Approved'}${(excessAmount > 0 ? (invoice.billing_mode === 'postpaid' ? ` (Kelebihan Rp ${excessAmount} - Pascabayar tidak masuk saldo)` : ` (Kelebihan Rp ${excessAmount} masuk saldo)`) : '')}`]
            );
            const paymentId = paymentResult.insertId;

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
                    // Reset PPPoE next_block_date if applicable ("Kesepakatan Final" Point 4 & 6)
                    import('../../services/pppoe/pppoeActivationService').then(({ pppoeActivationService }) => {
                        pppoeActivationService.resetNextBlockDate(customerId).catch(err =>
                            console.error('Background PPPoE reset error:', err)
                        );
                    }).catch(e => console.error('Error importing PPPoE service:', e));

                    // Use standardized restore logic
                    import('../../services/billing/isolationService').then(({ IsolationService }) => {
                        IsolationService.restoreIfQualified(customerId, connection).catch(e =>
                            console.warn('Background isolation removal failed in verification:', e)
                        );
                    }).catch(e => console.error('Error importing Isolation service:', e));
                }
            }

            await connection.commit();

            // Send Success Notification using UnifiedNotificationService
            if (paymentId) {
                try {
                    const { UnifiedNotificationService } = await import('../../services/notification/UnifiedNotificationService');
                    // Fire and forget, don't await to keep UI responsive
                    UnifiedNotificationService.notifyPaymentReceived(paymentId).catch(e =>
                        console.error('Background notification error in verification:', e)
                    );
                } catch (e) {
                    console.warn('Failed to initiate unified notification:', e);
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
