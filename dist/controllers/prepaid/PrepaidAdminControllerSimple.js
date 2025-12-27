"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
/**
 * Simplified Controller untuk Admin Prepaid Management
 * Minimal dependencies, error handling
 */
class PrepaidAdminControllerSimple {
    /**
     * Dashboard Prepaid
     */
    async dashboard(req, res) {
        try {
            // Simple stats with fallback
            const stats = {
                active_customers: 0,
                expired_customers: 0,
                expiring_soon: 0,
                total_revenue_today: 0
            };
            res.render('prepaid/admin/dashboard', {
                title: 'Dashboard Prepaid',
                layout: 'layouts/main',
                stats: stats,
                activeCustomers: [],
                expiringSoon: [],
                recentTransactions: [],
                revenueToday: { total_transactions: 0, revenue: 0 }
            });
        }
        catch (error) {
            console.error('Prepaid dashboard error:', error);
            res.status(500).send(`
        <h1>Server Error</h1>
        <p>Error: ${error}</p>
        <p>Stack: ${error instanceof Error ? error.stack : 'Unknown'}</p>
        <a href="/">Back to Home</a>
      `);
        }
    }
    /**
     * Customer Prepaid List
     */
    async customers(req, res) {
        try {
            let customers = [];
            try {
                const [result] = await pool_1.default.query(`SELECT c.* FROM customers c WHERE c.billing_mode = 'prepaid' LIMIT 50`);
                customers = result;
            }
            catch (queryError) {
                console.warn('Query error, using empty array:', queryError);
            }
            res.render('prepaid/admin/customers', {
                title: 'Customer Prepaid',
                layout: 'layouts/main',
                customers: customers
            });
        }
        catch (error) {
            console.error('Prepaid customers error:', error);
            res.status(500).send(`
        <h1>Server Error - Customers</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Packages Management
     */
    async packages(req, res) {
        try {
            let packages = [];
            try {
                const [result] = await pool_1.default.query(`SELECT pp.* FROM prepaid_packages pp ORDER BY pp.price ASC LIMIT 50`);
                packages = result;
            }
            catch (queryError) {
                console.warn('Query error, using empty array:', queryError);
            }
            res.render('prepaid/admin/packages', {
                title: 'Paket Prepaid',
                layout: 'layouts/main',
                packages: packages
            });
        }
        catch (error) {
            console.error('Prepaid packages error:', error);
            res.status(500).send(`
        <h1>Server Error - Packages</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Speed Profiles Management
     */
    async speedProfiles(req, res) {
        try {
            let profiles = [];
            try {
                const [result] = await pool_1.default.query(`SELECT * FROM speed_profiles WHERE is_active = 1 LIMIT 50`);
                profiles = result;
            }
            catch (queryError) {
                console.warn('Query error, using empty array:', queryError);
            }
            res.render('prepaid/admin/speed-profiles', {
                title: 'Speed Profiles',
                layout: 'layouts/main',
                profiles: profiles
            });
        }
        catch (error) {
            console.error('Speed profiles error:', error);
            res.status(500).send(`
        <h1>Server Error - Speed Profiles</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Address List Management (Portal Redirect)
     */
    async addressList(req, res) {
        try {
            res.render('prepaid/admin/address-list', {
                title: 'Portal Redirect Management',
                layout: 'layouts/main',
                customers: []
            });
        }
        catch (error) {
            console.error('Address list error:', error);
            res.status(500).send(`
        <h1>Server Error - Address List</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Active Subscriptions
     */
    async subscriptions(req, res) {
        try {
            let subscriptions = [];
            try {
                const [result] = await pool_1.default.query(`SELECT pps.* FROM prepaid_package_subscriptions pps 
           WHERE pps.status = 'active' LIMIT 50`);
                subscriptions = result;
            }
            catch (queryError) {
                console.warn('Query error, using empty array:', queryError);
            }
            res.render('prepaid/admin/subscriptions', {
                title: 'Active Subscriptions',
                layout: 'layouts/main',
                subscriptions: subscriptions
            });
        }
        catch (error) {
            console.error('Subscriptions error:', error);
            res.status(500).send(`
        <h1>Server Error - Subscriptions</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Reports
     */
    async reports(req, res) {
        try {
            res.render('prepaid/admin/reports', {
                title: 'Laporan Prepaid',
                layout: 'layouts/main',
                revenueByDay: [],
                packagePopularity: [],
                monthlyRevenue: []
            });
        }
        catch (error) {
            console.error('Reports error:', error);
            res.status(500).send(`
        <h1>Server Error - Reports</h1>
        <p>Error: ${error}</p>
        <a href="/prepaid/dashboard">Back to Dashboard</a>
      `);
        }
    }
    /**
     * Manual trigger scheduler (for testing)
     */
    async triggerScheduler(req, res) {
        try {
            res.json({
                success: true,
                message: 'Scheduler triggered (demo mode)'
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
            req.flash('success', 'Feature coming soon');
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
            req.flash('success', 'Feature coming soon');
            res.redirect('/prepaid/address-list');
        }
        catch (error) {
            console.error('Remove from redirect error:', error);
            req.flash('error', 'Server error');
            res.redirect('/prepaid/address-list');
        }
    }
}
exports.default = new PrepaidAdminControllerSimple();
//# sourceMappingURL=PrepaidAdminControllerSimple.js.map