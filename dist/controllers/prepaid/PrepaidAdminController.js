"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const SpeedProfileService_1 = __importDefault(require("../../services/prepaid/SpeedProfileService"));
const AddressListService_1 = __importDefault(require("../../services/prepaid/AddressListService"));
const PrepaidSchedulerService_1 = __importDefault(require("../../services/prepaid/PrepaidSchedulerService"));
const mikrotikService_1 = require("../../services/mikrotikService");
/**
 * Controller untuk Admin Prepaid Management
 * Handle dashboard, customer management, packages, dll
 */
class PrepaidAdminController {
    /**
     * Dashboard Prepaid
     */
    async dashboard(req, res) {
        try {
            // Get statistics with fallback
            let stats = {
                total_active: 0,
                total_expired: 0,
                expiring_soon: 0,
                total_revenue_today: 0
            };
            try {
                stats = await PrepaidSchedulerService_1.default.getStatistics();
            }
            catch (statError) {
                console.warn('Stats error, using defaults:', statError);
            }
            // Get active customers (direct query, no views)
            const [activeCustomers] = await pool_1.default.query(`SELECT 
          c.*,
          pps.expiry_date,
          pp.name as package_name,
          DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM customers c
         INNER JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active'
         ORDER BY c.created_at DESC
         LIMIT 10`).catch(() => [[]]);
            // Get expiring soon (direct query, no views)
            const [expiringSoon] = await pool_1.default.query(`SELECT 
          c.*,
          pps.expiry_date,
          pp.name as package_name,
          DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM customers c
         INNER JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active'
           AND pps.expiry_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         ORDER BY pps.expiry_date ASC
         LIMIT 10`).catch(() => [[]]);
            // Get recent transactions
            const [recentTransactions] = await pool_1.default.query(`SELECT 
          i.*,
          c.name as customer_name,
          c.customer_code
         FROM invoices i
         INNER JOIN customers c ON i.customer_id = c.id
         WHERE i.invoice_number LIKE 'INV/PREP/%'
         ORDER BY i.created_at DESC
         LIMIT 10`).catch(() => [[]]);
            // Get revenue today
            const [revenueToday] = await pool_1.default.query(`SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(total_amount), 0) as revenue
         FROM invoices
         WHERE invoice_number LIKE 'INV/PREP/%'
           AND status = 'paid'
           AND DATE(created_at) = CURDATE()`).catch(() => [[{ total_transactions: 0, revenue: 0 }]]);
            // Get MikroTik information if settings exist
            let mikrotikInfo = null;
            let interfaces = [];
            let connectionStatus = { connected: false, error: null };
            try {
                const [mtSettingsRows] = await pool_1.default.query('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
                if (mtSettingsRows && mtSettingsRows.length > 0) {
                    const mtSettings = mtSettingsRows[0];
                    const config = {
                        host: mtSettings?.host || '',
                        port: mtSettings?.port || 8728,
                        username: mtSettings?.username || '',
                        password: mtSettings?.password || '',
                        use_tls: mtSettings?.use_tls ?? false
                    };
                    mikrotikInfo = await (0, mikrotikService_1.getMikrotikInfo)(config);
                    interfaces = await (0, mikrotikService_1.getInterfaces)(config);
                    connectionStatus = { connected: true, error: null };
                }
            }
            catch (error) {
                connectionStatus = { connected: false, error: error?.message || 'Gagal mengambil data MikroTik' };
                console.warn('MikroTik connection warning (non-critical):', error.message);
            }
            res.render('prepaid/admin/dashboard', {
                title: 'Dashboard Prepaid',
                layout: 'layouts/main',
                stats: stats,
                activeCustomers: activeCustomers || [],
                expiringSoon: expiringSoon || [],
                recentTransactions: recentTransactions || [],
                revenueToday: revenueToday[0] || { total_transactions: 0, revenue: 0 },
                mikrotikInfo: mikrotikInfo,
                interfaces: interfaces,
                connectionStatus: connectionStatus
            });
        }
        catch (error) {
            console.error('Prepaid dashboard error:', error);
            res.status(500).send(`Server error: ${error}`);
        }
    }
    /**
     * Customer Prepaid List
     */
    async customers(req, res) {
        try {
            const [customers] = await pool_1.default.query(`SELECT 
          c.*,
          pc.portal_id,
          pc.status as portal_status,
          pc.last_login,
          pps.id as subscription_id,
          pps.expiry_date,
          pps.status as subscription_status,
          pp.name as package_name,
          DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM customers c
         LEFT JOIN portal_customers pc ON c.id = pc.customer_id
         LEFT JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id AND pps.status = 'active'
         LEFT JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE c.billing_mode = 'prepaid'
         ORDER BY c.created_at DESC`);
            res.render('prepaid/admin/customers', {
                title: 'Customer Prepaid',
                layout: 'layouts/main',
                customers: customers
            });
        }
        catch (error) {
            console.error('Prepaid customers error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Packages Management
     */
    async packages(req, res) {
        try {
            const [packages] = await pool_1.default.query(`SELECT 
          pp.*,
          sp.name as speed_profile_name,
          sp.download_mbps,
          sp.upload_mbps,
          COUNT(pps.id) as active_subscriptions,
          SUM(CASE WHEN pps.status = 'active' THEN pps.purchase_price ELSE 0 END) as total_revenue
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         LEFT JOIN prepaid_package_subscriptions pps ON pp.id = pps.package_id
         GROUP BY pp.id
         ORDER BY pp.price ASC`);
            res.render('prepaid/admin/packages', {
                title: 'Paket Prepaid',
                layout: 'layouts/main',
                packages: packages
            });
        }
        catch (error) {
            console.error('Prepaid packages error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Speed Profiles Management
     */
    async speedProfiles(req, res) {
        try {
            const profiles = await SpeedProfileService_1.default.getAllActiveProfiles();
            res.render('prepaid/admin/speed-profiles', {
                title: 'Speed Profiles',
                layout: 'layouts/main',
                profiles: profiles
            });
        }
        catch (error) {
            console.error('Speed profiles error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Address List Management (Portal Redirect)
     */
    async addressList(req, res) {
        try {
            const customersInRedirect = await AddressListService_1.default.getCustomersInPortalRedirect();
            res.render('prepaid/admin/address-list', {
                title: 'Portal Redirect Management',
                layout: 'layouts/main',
                customers: customersInRedirect
            });
        }
        catch (error) {
            console.error('Address list error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Active Subscriptions
     */
    async subscriptions(req, res) {
        try {
            const [subscriptions] = await pool_1.default.query(`SELECT 
          pps.*,
          c.customer_code,
          c.name as customer_name,
          c.phone,
          pp.name as package_name,
          pp.price,
          sp.download_mbps,
          sp.upload_mbps,
          DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pps.status = 'active'
         ORDER BY pps.expiry_date ASC`);
            res.render('prepaid/admin/subscriptions', {
                title: 'Active Subscriptions',
                layout: 'layouts/main',
                subscriptions: subscriptions
            });
        }
        catch (error) {
            console.error('Subscriptions error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Reports
     */
    async reports(req, res) {
        try {
            // Revenue by day (last 30 days)
            const [revenueByDay] = await pool_1.default.query(`SELECT 
          DATE(created_at) as date,
          COUNT(*) as transactions,
          SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_number LIKE 'INV/PREP/%'
           AND status = 'paid'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date DESC`);
            // Package popularity
            const [packagePopularity] = await pool_1.default.query(`SELECT 
          pp.name,
          COUNT(pps.id) as purchases,
          SUM(pps.purchase_price) as revenue
         FROM prepaid_package_subscriptions pps
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         GROUP BY pp.name
         ORDER BY purchases DESC`);
            // Monthly revenue
            const [monthlyRevenue] = await pool_1.default.query(`SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as transactions,
          SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_number LIKE 'INV/PREP/%'
           AND status = 'paid'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY month DESC`);
            res.render('prepaid/admin/reports', {
                title: 'Laporan Prepaid',
                layout: 'layouts/main',
                revenueByDay: revenueByDay,
                packagePopularity: packagePopularity,
                monthlyRevenue: monthlyRevenue
            });
        }
        catch (error) {
            console.error('Reports error:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Manual trigger scheduler (for testing)
     */
    async triggerScheduler(req, res) {
        try {
            const result = await PrepaidSchedulerService_1.default.triggerExpiryCheck();
            res.json({
                success: true,
                message: 'Scheduler triggered successfully',
                result: result
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    /**
     * Add customer to portal redirect (manual)
     */
    async addToPortalRedirect(req, res) {
        try {
            const { customer_id } = req.body;
            const success = await AddressListService_1.default.addToPortalRedirect(parseInt(customer_id), 'Manual add by admin');
            if (success) {
                req.flash('success', 'Customer added to portal redirect');
            }
            else {
                req.flash('error', 'Failed to add customer');
            }
            res.redirect('/prepaid/address-list');
        }
        catch (error) {
            console.error('Add to redirect error:', error);
            req.flash('error', 'Server error');
            res.redirect('/prepaid/address-list');
        }
    }
    /**
     * Remove customer from portal redirect
     */
    async removeFromPortalRedirect(req, res) {
        try {
            const { customer_id } = req.body;
            const success = await AddressListService_1.default.removeFromPortalRedirect(parseInt(customer_id));
            if (success) {
                req.flash('success', 'Customer removed from portal redirect');
            }
            else {
                req.flash('error', 'Failed to remove customer');
            }
            res.redirect('/prepaid/address-list');
        }
        catch (error) {
            console.error('Remove from redirect error:', error);
            req.flash('error', 'Server error');
            res.redirect('/prepaid/address-list');
        }
    }
}
exports.default = new PrepaidAdminController();
//# sourceMappingURL=PrepaidAdminController.js.map