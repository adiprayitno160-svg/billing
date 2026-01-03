/**
 * Prepaid Admin Controller
 * Manages prepaid payment requests, vouchers, and reports
 */

import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { VoucherService } from '../../services/billing/VoucherService';
import { ReferralService } from '../../services/billing/ReferralService';

export class PrepaidAdminController {
    /**
     * Show prepaid payment monitoring dashboard
     */
    static async paymentMonitoring(req: Request, res: Response): Promise<void> {
        try {
            const status = req.query.status as string || 'all';
            const page = parseInt(req.query.page as string) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;

            let statusFilter = '';
            if (status && status !== 'all') {
                statusFilter = `AND pr.status = ${databasePool.escape(status)}`;
            }

            // Get payment requests
            const [paymentRequests] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    pr.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.customer_code,
                    pkg.name as package_name,
                    pm.name as payment_method_name,
                    v.code as voucher_code,
                    v.name as voucher_name
                FROM payment_requests pr
                LEFT JOIN customers c ON pr.customer_id = c.id
                LEFT JOIN prepaid_packages pkg ON pr.package_id = pkg.id
                LEFT JOIN payment_methods pm ON pr.payment_method_id = pm.id
                LEFT JOIN vouchers v ON pr.voucher_id = v.id
                WHERE 1=1 ${statusFilter}
                ORDER BY pr.created_at DESC
                LIMIT ? OFFSET ?`,
                [limit, offset]
            );

            // Get counts
            const [counts] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
                FROM payment_requests`
            );

            const stats = counts[0] || { total: 0, pending: 0, verified: 0, expired: 0 };

            res.render('prepaid/payment-monitoring', {
                title: 'Prepaid Payment Monitoring',
                paymentRequests,
                stats,
                currentStatus: status,
                currentPage: page,
                totalPages: Math.ceil(stats.total / limit),
                user: req.user
            });
        } catch (error) {
            console.error('Error in payment monitoring:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * View payment request detail
     */
    static async viewPaymentRequest(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const [requests] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    pr.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.customer_code,
                    c.expiry_date as current_expiry,
                    pkg.name as package_name,
                    pkg.duration_days as package_duration,
                    pm.name as payment_method_name,
                    v.code as voucher_code,
                    v.discount_amount as voucher_discount_amount
                FROM payment_requests pr
                LEFT JOIN customers c ON pr.customer_id = c.id
                LEFT JOIN prepaid_packages pkg ON pr.package_id = pkg.id
                LEFT JOIN payment_methods pm ON pr.payment_method_id = pm.id
                LEFT JOIN vouchers v ON pr.voucher_id = v.id
                WHERE pr.id = ?`,
                [id]
            );

            if (requests.length === 0) {
                res.status(404).send('Payment request not found');
                return;
            }

            res.json({ success: true, data: requests[0] });
        } catch (error) {
            console.error('Error viewing payment request:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Manual approve payment
     */
    static async approvePayment(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = (req.user as any)?.id;

            // Import PrepaidService
            const { PrepaidService } = await import('../../services/billing/PrepaidService');

            const result = await PrepaidService.confirmPayment(
                parseInt(id),
                userId,
                'manual_approval'
            );

            res.json(result);
        } catch (error) {
            console.error('Error approving payment:', error);
            res.status(500).json({
                success: false,
                message: (error as Error).message || 'Failed to approve payment'
            });
        }
    }

    /**
     * Reject payment request
     */
    static async rejectPayment(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await databasePool.query(
                `UPDATE payment_requests 
                SET status = 'rejected', rejection_reason = ? 
                WHERE id = ?`,
                [reason || 'Manual rejection', id]
            );

            res.json({ success: true, message: 'Payment request rejected' });
        } catch (error) {
            console.error('Error rejecting payment:', error);
            res.status(500).json({ success: false, message: 'Failed to reject payment' });
        }
    }

    /**
     * Prepaid reports / analytics
     */
    static async reports(req: Request, res: Response): Promise<void> {
        try {
            const period = req.query.period as string || 'today';

            let dateFilter = 'DATE(created_at) = CURDATE()';
            if (period === 'week') {
                dateFilter = 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
            } else if (period === 'month') {
                dateFilter = 'MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())';
            }

            // Revenue stats
            const [revenueStats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total_transactions,
                    SUM(total_amount - voucher_discount) as total_revenue,
                    AVG(total_amount - voucher_discount) as avg_transaction,
                    COUNT(DISTINCT customer_id) as unique_customers,
                    SUM(voucher_discount) as total_discounts
                FROM payment_requests
                WHERE status = 'verified' AND ${dateFilter}`
            );

            // Package distribution
            const [packageStats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    pkg.name as package_name,
                    COUNT(*) as count,
                    SUM(pr.total_amount - pr.voucher_discount) as revenue
                FROM payment_requests pr
                LEFT JOIN prepaid_packages pkg ON pr.package_id = pkg.id
                WHERE pr.status = 'verified' AND ${dateFilter}
                GROUP BY pkg.id, pkg.name
                ORDER BY count DESC`
            );

            // Daily trend (last 30 days)
            const [dailyTrend] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as transactions,
                    SUM(total_amount - voucher_discount) as revenue
                FROM payment_requests
                WHERE status = 'verified'
                AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date ASC`
            );

            // Top vouchers
            const [voucherStats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    v.code,
                    v.name,
                    COUNT(*) as usage_count,
                    SUM(pr.voucher_discount) as total_discount
                FROM payment_requests pr
                JOIN vouchers v ON pr.voucher_id = v.id
                WHERE pr.status = 'verified' AND ${dateFilter}
                GROUP BY v.id
                ORDER BY usage_count DESC
                LIMIT 10`
            );

            res.render('prepaid/reports', {
                title: 'Prepaid Reports & Analytics',
                period,
                revenueStats: revenueStats[0] || {},
                packageStats,
                dailyTrend,
                voucherStats,
                user: req.user
            });
        } catch (error) {
            console.error('Error loading reports:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Voucher Management - List
     */
    static async listVouchers(req: Request, res: Response): Promise<void> {
        try {
            const [vouchers] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    v.*,
                    u.name as created_by_name,
                    COUNT(vu.id) as total_usage,
                    SUM(vu.discount_amount) as total_discount_given
                FROM vouchers v
                LEFT JOIN users u ON v.created_by = u.id
                LEFT JOIN voucher_usage vu ON v.id = vu.voucher_id
                GROUP BY v.id
                ORDER BY v.created_at DESC`
            );

            res.render('prepaid/vouchers', {
                title: 'Voucher Management',
                vouchers,
                user: req.user
            });
        } catch (error) {
            console.error('Error listing vouchers:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Create voucher
     */
    static async createVoucher(req: Request, res: Response): Promise<void> {
        try {
            const voucherData = {
                ...req.body,
                created_by: (req.user as any)?.id
            };

            const voucherId = await VoucherService.createVoucher(voucherData);

            res.json({
                success: true,
                message: 'Voucher created successfully',
                voucherId
            });
        } catch (error) {
            console.error('Error creating voucher:', error);
            res.status(500).json({
                success: false,
                message: (error as Error).message || 'Failed to create voucher'
            });
        }
    }

    /**
     * Update voucher
     */
    static async updateVoucher(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const success = await VoucherService.updateVoucher(parseInt(id), req.body);

            res.json({
                success,
                message: success ? 'Voucher updated successfully' : 'Failed to update voucher'
            });
        } catch (error) {
            console.error('Error updating voucher:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Delete voucher
     */
    static async deleteVoucher(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const success = await VoucherService.deleteVoucher(parseInt(id));

            res.json({
                success,
                message: success ? 'Voucher deleted successfully' : 'Failed to delete voucher'
            });
        } catch (error) {
            console.error('Error deleting voucher:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Referral tracking
     */
    static async referralTracking(req: Request, res: Response): Promise<void> {
        try {
            const [referrals] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    cr.*,
                    c1.name as referrer_name,
                    c1.phone as referrer_phone,
                    c1.customer_code as referrer_code,
                    c2.name as referred_name,
                    c2.phone as referred_phone,
                    c2.customer_code as referred_code
                FROM customer_referrals cr
                LEFT JOIN customers c1 ON cr.referrer_id = c1.id
                LEFT JOIN customers c2 ON cr.referred_id = c2.id
                ORDER BY cr.created_at DESC
                LIMIT 100`
            );

            // Stats
            const [stats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total_referrals,
                    SUM(CASE WHEN status = 'rewarded' THEN 1 ELSE 0 END) as successful_referrals,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_referrals,
                    SUM(CASE WHEN status = 'rewarded' THEN referrer_reward_days ELSE 0 END) as total_days_given
                FROM customer_referrals`
            );

            res.render('prepaid/referrals', {
                title: 'Referral Tracking',
                referrals,
                stats: stats[0] || {},
                user: req.user
            });
        } catch (error) {
            console.error('Error loading referral tracking:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
