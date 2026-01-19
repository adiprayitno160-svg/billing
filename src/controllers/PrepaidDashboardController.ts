import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Prepaid Dashboard Controller
 * Handles UI for prepaid customer management
 */
export class PrepaidDashboardController {

    /**
     * Show prepaid customers list page
     */
    static async listPrepaidCustomers(req: Request, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();

            try {
                // Get all prepaid customers with their expiry status
                const [customers] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        c.id,
                        c.customer_code,
                        c.name,
                        c.phone,
                        c.pppoe_username,
                        c.expiry_date,
                        c.is_isolated,
                        c.status,
                        pp.name as package_name,
                        pr.name as profile_name,
                        CASE 
                            WHEN c.expiry_date IS NULL THEN 'no_expiry'
                            WHEN c.expiry_date <= NOW() THEN 'expired'
                            WHEN c.expiry_date <= DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 'expiring_soon'
                            ELSE 'active'
                        END as expiry_status,
                        TIMESTAMPDIFF(DAY, NOW(), c.expiry_date) as days_remaining
                    FROM customers c
                    LEFT JOIN pppoe_profiles pr ON c.pppoe_profile_id = pr.id
                    LEFT JOIN pppoe_packages pp ON pr.id = pp.profile_id
                    WHERE c.billing_mode = 'prepaid'
                    ORDER BY 
                        CASE 
                            WHEN c.expiry_date IS NULL THEN 3
                            WHEN c.expiry_date <= NOW() THEN 1
                            ELSE 2
                        END,
                        c.expiry_date ASC
                `);

                // Get statistics
                const [stats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        COUNT(*) as total_prepaid,
                        SUM(CASE WHEN expiry_date > NOW() THEN 1 ELSE 0 END) as active_count,
                        SUM(CASE WHEN expiry_date <= NOW() THEN 1 ELSE 0 END) as expired_count,
                        SUM(CASE WHEN expiry_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 1 ELSE 0 END) as expiring_soon_count
                    FROM customers
                    WHERE billing_mode = 'prepaid'
                `);

                res.render('prepaid/customers', {
                    title: 'Pelanggan Prabayar',
                    customers,
                    stats: stats[0] || {},
                    layout: 'layouts/main'
                });

            } finally {
                conn.release();
            }

        } catch (error: any) {
            console.error('Error loading prepaid customers:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat daftar pelanggan prabayar',
                error: error.message
            });
        }
    }

    /**
     * Show prepaid transactions report
     */
    static async listTransactions(req: Request, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();

            try {
                // Get transactions with customer details
                const [transactions] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        pt.id,
                        pt.created_at,
                        pt.amount,
                        pt.duration_days,
                        pt.payment_method,
                        pt.previous_expiry_date,
                        pt.new_expiry_date,
                        pt.proof_image,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone,
                        pp.name as package_name,
                        u.username as verified_by_username
                    FROM prepaid_transactions pt
                    LEFT JOIN customers c ON pt.customer_id = c.id
                    LEFT JOIN pppoe_packages pp ON pt.package_id = pp.id
                    LEFT JOIN users u ON pt.verified_by = u.id
                    ORDER BY pt.created_at DESC
                    LIMIT 100
                `);

                // Get today's statistics
                const [todayStats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        COUNT(*) as transaction_count,
                        SUM(amount) as total_revenue,
                        AVG(amount) as avg_transaction
                    FROM prepaid_transactions
                    WHERE DATE(created_at) = CURDATE()
                `);

                // Get this month's statistics
                const [monthStats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        COUNT(*) as transaction_count,
                        SUM(amount) as total_revenue,
                        AVG(amount) as avg_transaction
                    FROM prepaid_transactions
                    WHERE YEAR(created_at) = YEAR(CURDATE())
                    AND MONTH(created_at) = MONTH(CURDATE())
                `);

                res.render('prepaid/transactions', {
                    title: 'Transaksi Prabayar',
                    transactions,
                    todayStats: todayStats[0] || {},
                    monthStats: monthStats[0] || {},
                    layout: 'layouts/main'
                });

            } finally {
                conn.release();
            }

        } catch (error: any) {
            console.error('Error loading prepaid transactions:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat laporan transaksi',
                error: error.message
            });
        }
    }

    /**
     * Show pending payment requests
     */
    static async listPaymentRequests(req: Request, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();

            try {
                // Get pending and recent payment requests
                const [requests] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        pr.id,
                        pr.created_at,
                        pr.expires_at,
                        pr.status,
                        pr.base_amount,
                        pr.unique_code,
                        pr.total_amount,
                        pr.duration_days,
                        pr.paid_at,
                        pr.proof_image,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone,
                        pp.name as package_name,
                        CASE 
                            WHEN pr.status = 'pending' AND pr.expires_at > NOW() THEN 'active'
                            WHEN pr.status = 'pending' AND pr.expires_at <= NOW() THEN 'expired'
                            ELSE pr.status
                        END as display_status,
                        TIMESTAMPDIFF(MINUTE, NOW(), pr.expires_at) as minutes_remaining
                    FROM payment_requests pr
                    LEFT JOIN customers c ON pr.customer_id = c.id
                    LEFT JOIN pppoe_packages pp ON pr.package_id = pp.id
                    WHERE pr.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    ORDER BY 
                        CASE 
                            WHEN pr.status = 'pending' AND pr.expires_at > NOW() THEN 1
                            WHEN pr.status = 'pending' AND pr.expires_at <= NOW() THEN 2
                            ELSE 3
                        END,
                        pr.created_at DESC
                `);

                // Get statistics
                const [stats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        SUM(CASE WHEN status = 'pending' AND expires_at > NOW() THEN 1 ELSE 0 END) as pending_active,
                        SUM(CASE WHEN status = 'pending' AND expires_at <= NOW() THEN 1 ELSE 0 END) as pending_expired,
                        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
                    FROM payment_requests
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                `);

                res.render('prepaid/payment-requests', {
                    title: 'Payment Requests',
                    requests,
                    stats: stats[0] || {},
                    layout: 'layouts/main'
                });

            } finally {
                conn.release();
            }

        } catch (error: any) {
            console.error('Error loading payment requests:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat payment requests',
                error: error.message
            });
        }
    }

    /**
     * Show prepaid reports page
     */
    static async getReports(req: Request, res: Response): Promise<void> {
        try {
            const period = (req.query.period as string) || 'month';
            const conn = await databasePool.getConnection();

            try {
                let dateCondition = "pt.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
                if (period === 'today') dateCondition = "DATE(pt.created_at) = CURDATE()";
                else if (period === 'week') dateCondition = "pt.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";

                // Get revenue statistics
                const [revenueStatsRows] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        SUM(pt.amount) as total_revenue,
                        COUNT(pt.id) as total_transactions,
                        COUNT(DISTINCT pt.customer_id) as unique_customers,
                        0 as total_discounts
                    FROM prepaid_transactions pt
                    WHERE ${dateCondition}
                `);

                // Get package distribution
                const [packageStats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        pp.name as package_name,
                        COUNT(pt.id) as count,
                        SUM(pt.amount) as revenue
                    FROM prepaid_transactions pt
                    LEFT JOIN pppoe_packages pp ON pt.package_id = pp.id
                    WHERE ${dateCondition}
                    GROUP BY pt.package_id
                    ORDER BY count DESC
                `);

                // Get 30-day daily trend for chart
                const [dailyTrend] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        DATE(created_at) as date,
                        SUM(amount) as revenue,
                        COUNT(id) as transactions
                    FROM prepaid_transactions
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE(created_at)
                    ORDER BY date ASC
                `);

                res.render('prepaid/reports', {
                    title: 'Laporan Prabayar',
                    period,
                    revenueStats: revenueStatsRows[0] || { total_revenue: 0, total_transactions: 0, unique_customers: 0, total_discounts: 0 },
                    packageStats,
                    voucherStats: [], // Vouchers removed
                    dailyTrend,
                    currentPath: req.path,
                    layout: 'layouts/main'
                });

            } finally {
                conn.release();
            }

        } catch (error: any) {
            console.error('Error loading prepaid reports:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat laporan prabayar',
                error: error.message
            });
        }
    }
}
