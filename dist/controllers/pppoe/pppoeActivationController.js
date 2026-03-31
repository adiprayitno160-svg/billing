"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pppoeActivationController = exports.PPPoEActivationController = void 0;
const pool_1 = require("../../db/pool");
const pppoeActivationService_1 = require("../../services/pppoe/pppoeActivationService");
class PPPoEActivationController {
    /**
     * Get list of inactive PPPoE subscriptions that can be activated
     */
    async getInactiveSubscriptions(req, res) {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            let query = `
                SELECT 
                    s.id as subscription_id,
                    s.customer_id,
                    s.package_id,
                    s.package_name,
                    s.price,
                    s.start_date,
                    s.status,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone,
                    c.email,
                    c.address,
                    c.pppoe_username,
                    c.pppoe_password,
                    pp.max_limit_upload,
                    pp.max_limit_download,
                    pp.duration_days,
                    i.id as unpaid_invoice_id,
                    i.invoice_number as unpaid_invoice_number,
                    i.total_amount as unpaid_invoice_total
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                JOIN pppoe_packages pp ON s.package_id = pp.id
                LEFT JOIN invoices i ON i.id = (
                    SELECT id FROM invoices 
                    WHERE subscription_id = s.id AND status != 'paid' 
                    ORDER BY id DESC LIMIT 1
                )
                WHERE s.status = 'inactive'
                AND c.connection_type = 'pppoe'
            `;
            const queryParams = [];
            if (search) {
                query += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?)`;
                const searchPattern = `%${search}%`;
                queryParams.push(searchPattern, searchPattern, searchPattern);
            }
            query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
            queryParams.push(Number(limit), offset);
            const [subscriptions] = await pool_1.databasePool.query(query, queryParams);
            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                JOIN pppoe_packages pp ON s.package_id = pp.id
                WHERE s.status = 'inactive'
                AND c.connection_type = 'pppoe'
            `;
            const countParams = [];
            if (search) {
                countQuery += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?)`;
                const searchPattern = `%${search}%`;
                countParams.push(searchPattern, searchPattern, searchPattern);
            }
            const [countResult] = await pool_1.databasePool.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;
            res.json({
                success: true,
                data: subscriptions,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                }
            });
        }
        catch (error) {
            console.error('Error getting inactive subscriptions:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Activate PPPoE subscription
     */
    async activateSubscription(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { activationDate } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'User tidak terautentikasi'
                });
                return;
            }
            const result = await pppoeActivationService_1.pppoeActivationService.activateSubscription(Number(subscriptionId), userId, activationDate);
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        }
        catch (error) {
            console.error('Error activating subscription:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Deactivate PPPoE subscription
     */
    async deactivateSubscription(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'User tidak terautentikasi'
                });
                return;
            }
            if (!reason || reason.trim() === '') {
                res.status(400).json({
                    success: false,
                    message: 'Alasan harus diisi'
                });
                return;
            }
            const result = await pppoeActivationService_1.pppoeActivationService.deactivateSubscription(Number(subscriptionId), userId, reason.trim());
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        }
        catch (error) {
            console.error('Error deactivating subscription:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Send activation invoice to customer
     */
    async sendActivationInvoice(req, res) {
        try {
            const { subscriptionId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'User tidak terautentikasi'
                });
                return;
            }
            const result = await pppoeActivationService_1.pppoeActivationService.sendActivationInvoice(Number(subscriptionId), userId);
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    invoiceId: result.invoiceId
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        }
        catch (error) {
            console.error('Error sending activation invoice:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Get activation logs for a customer
     */
    async getActivationLogs(req, res) {
        try {
            const { customerId } = req.params;
            const { limit = 20 } = req.query;
            const [logs] = await pool_1.databasePool.query(`SELECT al.*, u.full_name as performed_by_name
                 FROM activation_logs al
                 LEFT JOIN users u ON al.performed_by = u.id
                 WHERE al.customer_id = ?
                 ORDER BY al.created_at DESC
                 LIMIT ?`, [customerId, Number(limit)]);
            res.json({
                success: true,
                data: logs
            });
        }
        catch (error) {
            console.error('Error getting activation logs:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Get subscription details
     */
    async getSubscriptionDetails(req, res) {
        try {
            const { subscriptionId } = req.params;
            const [subscriptionRows] = await pool_1.databasePool.query(`SELECT 
                    s.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone,
                    c.email,
                    c.address,
                    c.pppoe_username,
                    c.pppoe_password,
                    pp.name as package_name,
                    pp.max_limit_upload,
                    pp.max_limit_download,
                    pp.price as package_price
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                JOIN pppoe_packages pp ON s.package_id = pp.id
                WHERE s.id = ?`, [subscriptionId]);
            const subscription = subscriptionRows[0];
            if (!subscription) {
                res.status(404).json({
                    success: false,
                    message: 'Subscription tidak ditemukan'
                });
                return;
            }
            res.json({
                success: true,
                data: subscription
            });
        }
        catch (error) {
            console.error('Error getting subscription details:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Get all subscriptions with filtering and pagination
     */
    async getAllSubscriptions(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = '' } = req.query;
            let query = `
                SELECT 
                    s.id as subscription_id,
                    s.customer_id,
                    s.package_id,
                    s.package_name,
                    s.price,
                    s.start_date,
                    s.status,
                    s.activation_date,
                    s.next_block_date,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone,
                    c.email,
                    c.address,
                    c.pppoe_username,
                    c.pppoe_password
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE c.connection_type = 'pppoe'
            `;
            const queryParams = [];
            if (status) {
                query += ` AND s.status = ?`;
                queryParams.push(status);
            }
            if (search) {
                query += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?)`;
                const searchPattern = `%${search}%`;
                queryParams.push(searchPattern, searchPattern, searchPattern);
            }
            query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
            queryParams.push(Number(limit), (Number(page) - 1) * Number(limit));
            const [subscriptions] = await pool_1.databasePool.query(query, queryParams);
            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE c.connection_type = 'pppoe'
            `;
            const countParams = [];
            if (status) {
                countQuery += ` AND s.status = ?`;
                countParams.push(status);
            }
            if (search) {
                countQuery += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?)`;
                const searchPattern = `%${search}%`;
                countParams.push(searchPattern, searchPattern, searchPattern);
            }
            const [countResult] = await pool_1.databasePool.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;
            res.json({
                success: true,
                data: subscriptions,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                }
            });
        }
        catch (error) {
            console.error('Error getting all subscriptions:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
    /**
     * Run the auto-blocking process manually
     */
    async runAutoBlocking(req, res) {
        try {
            console.log('[PPPoEActivationController] Manually triggering auto-blocking process');
            const result = await pppoeActivationService_1.pppoeActivationService.processAutoBlocking();
            res.json({
                success: true,
                message: 'Proses pemblokiran otomatis berhasil dijalankan',
                result
            });
        }
        catch (error) {
            console.error('Error running manual auto-blocking:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan saat menjalankan pemblokiran otomatis'
            });
        }
    }
    /**
     * Get statistics for the activation dashboard
     */
    async getStatistics(req, res) {
        try {
            // Get total statistics
            const [totalStats] = await pool_1.databasePool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN s.status = 'inactive' THEN 1 ELSE 0 END) as inactive,
                    SUM(CASE WHEN s.status = 'suspended' THEN 1 ELSE 0 END) as suspended
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE c.connection_type = 'pppoe'
            `);
            // Get blocked today count
            const [blockedTodayResult] = await pool_1.databasePool.query(`
                SELECT COUNT(*) as blocked_today
                FROM activation_logs
                WHERE action = 'DEACTIVATE_SUBSCRIPTION' 
                AND DATE(created_at) = CURDATE()
            `);
            const stats = totalStats[0] || {};
            const blockedToday = blockedTodayResult[0]?.blocked_today || 0;
            res.json({
                success: true,
                stats: {
                    total: parseInt(stats.total) || 0,
                    active: parseInt(stats.active) || 0,
                    inactive: parseInt(stats.inactive) || 0,
                    suspended: parseInt(stats.suspended) || 0,
                    blockedToday: parseInt(blockedToday) || 0
                }
            });
        }
        catch (error) {
            console.error('Error getting statistics:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
            });
        }
    }
}
exports.PPPoEActivationController = PPPoEActivationController;
exports.pppoeActivationController = new PPPoEActivationController();
//# sourceMappingURL=pppoeActivationController.js.map