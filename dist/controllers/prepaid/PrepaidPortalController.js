"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const PrepaidActivationService_1 = __importDefault(require("../../services/prepaid/PrepaidActivationService"));
/**
 * Controller untuk Prepaid Portal Pages
 * Handle login, dashboard, dan portal navigation
 */
class PrepaidPortalController {
    /**
     * Show login page
     */
    async showLogin(req, res) {
        try {
            // Set no-cache headers to prevent browser caching
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.render('prepaid/portal-login', {
                title: 'Portal Prepaid - Login',
                layout: false, // No main layout
                error: req.query.error || null,
                success: req.query.success || null
            });
        }
        catch (error) {
            console.error('Error showing login page:', error);
            res.status(500).send('Server error');
        }
    }
    /**
     * Process login
     */
    async processLogin(req, res) {
        try {
            const { portal_id, portal_pin } = req.body;
            if (!portal_id || !portal_pin) {
                return res.redirect('/prepaid/portal/login?error=ID dan PIN harus diisi');
            }
            // Find portal customer
            const [portalRows] = await pool_1.default.query(`SELECT pc.*, c.name, c.phone, c.customer_code, c.status
         FROM portal_customers pc
         INNER JOIN customers c ON pc.customer_id = c.id
         WHERE pc.portal_id = ? AND pc.status = 'active'`, [portal_id]);
            if (portalRows.length === 0) {
                return res.redirect('/prepaid/portal/login?error=ID Portal tidak ditemukan');
            }
            const portalCustomer = portalRows[0];
            // Verify PIN (simple comparison for now, bcrypt for production)
            // For testing: PIN stored as plain text
            // For production: use bcrypt.compare(portal_pin, portalCustomer.portal_pin)
            if (!portalCustomer) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }
            const pinMatch = portal_pin === portalCustomer.portal_pin ||
                await bcrypt_1.default.compare(portal_pin, portalCustomer.portal_pin);
            if (!pinMatch) {
                // Increment login attempts
                await pool_1.default.query('UPDATE portal_customers SET login_attempts = login_attempts + 1 WHERE id = ?', [portalCustomer.id]);
                return res.redirect('/prepaid/portal/login?error=PIN salah');
            }
            // Reset login attempts and update last login
            await pool_1.default.query('UPDATE portal_customers SET login_attempts = 0, last_login = NOW() WHERE id = ?', [portalCustomer.id]);
            // Create session
            if (req.session) {
                req.session.portalCustomerId = portalCustomer.customer_id;
                req.session.portalId = portal_id;
                req.session.customerName = portalCustomer.name;
            }
            // Redirect to dashboard/packages
            res.redirect('/prepaid/portal/packages');
        }
        catch (error) {
            console.error('Login error:', error);
            res.redirect('/prepaid/portal/login?error=Terjadi kesalahan sistem');
        }
    }
    /**
     * Show portal dashboard
     */
    async showDashboard(req, res) {
        try {
            const customerId = req.session?.portalCustomerId || 1; // Default to customer 1 for testing
            // Get customer details
            const [customerRows] = await pool_1.default.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId]);
            if (customerRows.length === 0) {
                // No customer found, show message
                return res.send(`
          <h1>Portal Dashboard</h1>
          <p>No customer data found. Please create prepaid customers first.</p>
          <p>Customer ID tried: ${customerId}</p>
          <a href="/prepaid/portal/login">Back to Login</a>
        `);
            }
            const customer = customerRows[0];
            // Get active subscription
            const activeSubscription = await PrepaidActivationService_1.default.getActiveSubscription(customerId);
            // Get subscription history
            const subscriptionHistory = await PrepaidActivationService_1.default.getSubscriptionHistory(customerId, 5);
            res.render('prepaid/portal-dashboard', {
                title: 'Dashboard Prepaid',
                layout: false,
                customer: customer,
                activeSubscription: activeSubscription,
                subscriptionHistory: subscriptionHistory,
                customerName: req.session?.customerName || customer?.name || 'Customer'
            });
        }
        catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).send(`Server error: ${error}`);
        }
    }
    /**
     * Logout
     */
    async logout(req, res) {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destroy error:', err);
                }
                res.redirect('/prepaid/portal/login?success=Logout berhasil');
            });
        }
        else {
            res.redirect('/prepaid/portal/login');
        }
    }
    /**
     * Show customer usage/statistics
     */
    async showUsage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            // Get active subscription with usage data
            const activeSubscription = await PrepaidActivationService_1.default.getActiveSubscription(customerId);
            res.render('prepaid/portal-usage', {
                title: 'Penggunaan Paket',
                layout: false,
                subscription: activeSubscription,
                customerName: req.session.customerName
            });
        }
        catch (error) {
            console.error('Usage page error:', error);
            res.status(500).send('Server error');
        }
    }
}
exports.default = new PrepaidPortalController();
//# sourceMappingURL=PrepaidPortalController.js.map