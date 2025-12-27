"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const MikrotikService_1 = require("../../services/mikrotik/MikrotikService");
const bcrypt_1 = __importDefault(require("bcrypt"));
const PrepaidSchedulerServiceComplete_1 = __importDefault(require("../../services/prepaid/PrepaidSchedulerServiceComplete"));
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
const mikrotikService_1 = require("../../services/mikrotikService");
/**
 * Full Controller untuk Admin Prepaid Management
 * Dengan CRUD lengkap dan integrasi MikroTik
 */
class PrepaidAdminControllerFull {
    // ===========================================
    // DASHBOARD
    // ===========================================
    async dashboard(req, res) {
        try {
            // Get stats from scheduler service
            const stats = await PrepaidSchedulerServiceComplete_1.default.getStatistics();
            // Get MikroTik interfaces
            let interfaces = [];
            try {
                const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
                if (mikrotikConfig) {
                    const configWithTls = {
                        ...mikrotikConfig,
                        use_tls: mikrotikConfig.use_tls ?? false
                    };
                    interfaces = await (0, mikrotikService_1.getInterfaces)(configWithTls);
                }
            }
            catch (interfaceError) {
                console.error('Error fetching MikroTik interfaces:', interfaceError);
                interfaces = [];
            }
            res.render('prepaid/admin/dashboard', {
                title: 'Dashboard Prepaid',
                layout: 'layouts/main',
                stats,
                interfaces: interfaces || [],
                activeCustomers: [],
                expiringSoon: [],
                recentTransactions: [],
                revenueToday: { total_transactions: 0, revenue: 0 }
            });
        }
        catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    // ===========================================
    // PACKAGES CRUD
    // ===========================================
    async packages(req, res) {
        try {
            const [packages] = await pool_1.default.query(`SELECT pp.*, sp.name as speed_profile_name, sp.download_mbps, sp.upload_mbps
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         ORDER BY pp.price ASC`);
            const [speedProfiles] = await pool_1.default.query('SELECT * FROM speed_profiles WHERE is_active = 1 ORDER BY download_mbps ASC');
            res.render('prepaid/admin/packages', {
                title: 'Paket Prepaid',
                layout: 'layouts/main',
                packages,
                speedProfiles
            });
        }
        catch (error) {
            console.error('Packages error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    async createPackage(req, res) {
        try {
            const { name, description, price, duration_days, speed_profile_id } = req.body;
            const [result] = await pool_1.default.query(`INSERT INTO prepaid_packages 
         (name, description, price, duration_days, speed_profile_id, is_active, status)
         VALUES (?, ?, ?, ?, ?, 1, 'active')`, [name, description, price, duration_days, speed_profile_id]);
            req.flash('success', 'Paket prepaid berhasil dibuat');
            res.redirect('/prepaid/packages');
        }
        catch (error) {
            console.error('Create package error:', error);
            req.flash('error', 'Gagal membuat paket');
            res.redirect('/prepaid/packages');
        }
    }
    async updatePackage(req, res) {
        try {
            const { id } = req.params;
            const { name, description, price, duration_days, speed_profile_id, is_active } = req.body;
            await pool_1.default.query(`UPDATE prepaid_packages 
         SET name = ?, description = ?, price = ?, duration_days = ?, 
             speed_profile_id = ?, is_active = ?
         WHERE id = ?`, [name, description, price, duration_days, speed_profile_id, is_active ? 1 : 0, id]);
            req.flash('success', 'Paket berhasil diupdate');
            res.redirect('/prepaid/packages');
        }
        catch (error) {
            console.error('Update package error:', error);
            req.flash('error', 'Gagal update paket');
            res.redirect('/prepaid/packages');
        }
    }
    async deletePackage(req, res) {
        try {
            const { id } = req.params;
            // Check if package has active subscriptions
            const [subs] = await pool_1.default.query('SELECT COUNT(*) as count FROM prepaid_package_subscriptions WHERE package_id = ? AND status = "active"', [id]);
            if (subs[0]?.count && subs[0].count > 0) {
                req.flash('error', 'Tidak bisa hapus paket yang masih memiliki langganan aktif');
                return res.redirect('/prepaid/packages');
            }
            await pool_1.default.query('DELETE FROM prepaid_packages WHERE id = ?', [id]);
            req.flash('success', 'Paket berhasil dihapus');
            res.redirect('/prepaid/packages');
        }
        catch (error) {
            console.error('Delete package error:', error);
            req.flash('error', 'Gagal menghapus paket');
            res.redirect('/prepaid/packages');
        }
    }
    // ===========================================
    // CUSTOMERS CRUD
    // ===========================================
    async customers(req, res) {
        try {
            const [customers] = await pool_1.default.query(`SELECT c.*, pc.portal_id, pc.status as portal_status,
                pps.expiry_date, pp.name as package_name,
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
                customers
            });
        }
        catch (error) {
            console.error('Customers error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    async createPortalAccess(req, res) {
        try {
            const { customer_id } = req.body;
            // Generate Portal ID (8 digit random)
            const portalId = Math.floor(10000000 + Math.random() * 90000000).toString();
            // Generate PIN (6 digit)
            const portalPin = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedPin = await bcrypt_1.default.hash(portalPin, 10);
            await pool_1.default.query(`INSERT INTO portal_customers (customer_id, portal_id, portal_pin, status)
         VALUES (?, ?, ?, 'active')`, [customer_id, portalId, hashedPin]);
            req.flash('success', `Portal akses dibuat! ID: ${portalId}, PIN: ${portalPin}`);
            res.redirect('/prepaid/customers');
        }
        catch (error) {
            console.error('Create portal access error:', error);
            req.flash('error', 'Gagal membuat akses portal');
            res.redirect('/prepaid/customers');
        }
    }
    // ===========================================
    // SUBSCRIPTIONS & ACTIVATION
    // ===========================================
    async subscriptions(req, res) {
        try {
            const [subscriptions] = await pool_1.default.query(`SELECT pps.*, c.customer_code, c.name as customer_name, c.phone,
                c.pppoe_username, c.connection_type,
                sic.ip_address,
                pp.name as package_name, pp.price,
                sp.download_mbps, sp.upload_mbps, sp.mikrotik_profile_name,
                DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
         WHERE pps.status = 'active'
         ORDER BY pps.expiry_date ASC`);
            res.render('prepaid/admin/subscriptions', {
                title: 'Active Subscriptions',
                layout: 'layouts/main',
                subscriptions
            });
        }
        catch (error) {
            console.error('Subscriptions error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    /**
     * Manual activation (tanpa bayar)
     */
    async manualActivation(req, res) {
        try {
            const { customer_id, package_id } = req.body;
            // Get package details
            const [packages] = await pool_1.default.query(`SELECT pp.*, sp.* FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`, [package_id]);
            if (packages.length === 0) {
                req.flash('error', 'Paket tidak ditemukan');
                return res.redirect('/prepaid/subscriptions');
            }
            const pkg = packages[0];
            // Calculate expiry date
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + pkg.duration_days);
            // Deactivate existing active subscription
            await pool_1.default.query(`UPDATE prepaid_package_subscriptions 
         SET status = 'replaced' WHERE customer_id = ? AND status = 'active'`, [customer_id]);
            // Create new subscription
            const [result] = await pool_1.default.query(`INSERT INTO prepaid_package_subscriptions 
         (customer_id, package_id, activation_date, expiry_date, purchase_price, status)
         VALUES (?, ?, NOW(), ?, ?, 'active')`, [customer_id, package_id, expiryDate, pkg?.price || 0]);
            // Activate in MikroTik
            await this.activateInMikrotik(customer_id, pkg);
            req.flash('success', 'Paket berhasil diaktivasi secara manual');
            res.redirect('/prepaid/subscriptions');
        }
        catch (error) {
            console.error('Manual activation error:', error);
            req.flash('error', `Gagal aktivasi: ${error}`);
            res.redirect('/prepaid/subscriptions');
        }
    }
    /**
     * Deactivate subscription
     */
    async deactivateSubscription(req, res) {
        try {
            const { id } = req.params;
            // Get subscription details
            const [subs] = await pool_1.default.query(`SELECT pps.*, c.pppoe_username, c.connection_type, sic.ip_address
         FROM prepaid_package_subscriptions pps
         JOIN customers c ON pps.customer_id = c.id
         LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
         WHERE pps.id = ?`, [id]);
            if (subs.length === 0) {
                req.flash('error', 'Subscription tidak ditemukan');
                return res.redirect('/prepaid/subscriptions');
            }
            const sub = subs[0];
            // Update status
            await pool_1.default.query('UPDATE prepaid_package_subscriptions SET status = "canceled" WHERE id = ?', [id]);
            // Deactivate in MikroTik
            if (sub.connection_type === 'pppoe' && sub.pppoe_username) {
                await this.deactivateInMikrotik(sub.customer_id, sub.pppoe_username, sub.ip_address);
            }
            req.flash('success', 'Subscription berhasil dinonaktifkan');
            res.redirect('/prepaid/subscriptions');
        }
        catch (error) {
            console.error('Deactivate error:', error);
            req.flash('error', 'Gagal menonaktifkan subscription');
            res.redirect('/prepaid/subscriptions');
        }
    }
    // ===========================================
    // MIKROTIK INTEGRATION
    // ===========================================
    async activateInMikrotik(customerId, packageData) {
        try {
            // Get customer
            const [customers] = await pool_1.default.query('SELECT * FROM customers WHERE id = ?', [customerId]);
            if (customers.length === 0)
                return;
            const customer = customers[0];
            // Only for PPPoE
            if (customer.connection_type !== 'pppoe' || !customer.pppoe_username) {
                console.log('⏭️  Skip MikroTik: Not PPPoE customer');
                return;
            }
            // Get MikroTik settings
            const [settings] = await pool_1.default.query('SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
            if (settings.length === 0) {
                console.warn('⚠️  No active MikroTik settings found');
                return;
            }
            const mikrotik = new MikrotikService_1.MikrotikService({
                host: settings[0].host,
                username: settings[0].username,
                password: settings[0].password,
                port: settings[0].api_port || 8728
            });
            // Enable PPPoE secret with profile
            const profileName = packageData.mikrotik_profile_name || `${packageData.download_mbps}M-PREP`;
            const success = await mikrotik.updatePPPoEUser({
                name: customer.pppoe_username,
                profile: profileName,
                disabled: false
            });
            if (success) {
                console.log(`✅ MikroTik: Activated ${customer.pppoe_username} with profile ${profileName}`);
            }
            else {
                console.error(`❌ MikroTik: Failed to activate ${customer.pppoe_username}`);
            }
        }
        catch (error) {
            console.error('MikroTik activation error:', error);
            // Don't throw - activation continues even if MikroTik fails
        }
    }
    async deactivateInMikrotik(customerId, pppoeUsername, ipAddress) {
        try {
            // Get MikroTik settings
            const [settings] = await pool_1.default.query('SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
            if (settings.length === 0)
                return;
            const mikrotik = new MikrotikService_1.MikrotikService({
                host: settings[0].host,
                username: settings[0].username,
                password: settings[0].password,
                port: settings[0].api_port || 8728
            });
            // Disable PPPoE user
            await mikrotik.updatePPPoEUser(subscription.pppoe_username || '', {
                name: pppoeUsername,
                disabled: true
            });
            // Add to address list portal-redirect (if IP exists)
            if (ipAddress) {
                await mikrotik.addToAddressList({
                    address: ipAddress,
                    list: 'portal-redirect',
                    comment: `Prepaid expired: ${pppoeUsername}`
                });
            }
            console.log(`✅ MikroTik: Deactivated ${pppoeUsername}`);
        }
        catch (error) {
            console.error('MikroTik deactivation error:', error);
        }
    }
    // ===========================================
    // OTHER PAGES
    // ===========================================
    async speedProfiles(req, res) {
        try {
            const [profiles] = await pool_1.default.query('SELECT * FROM speed_profiles WHERE is_active = 1 ORDER BY download_mbps ASC');
            res.render('prepaid/admin/speed-profiles', {
                title: 'Speed Profiles',
                layout: 'layouts/main',
                profiles
            });
        }
        catch (error) {
            console.error('Speed profiles error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    async addressList(req, res) {
        try {
            const [items] = await pool_1.default.query(`SELECT mal.*, c.customer_code, c.name, c.connection_type,
                sic.ip_address as static_ip_address,
                mal.ip_address as stored_ip_address
         FROM mikrotik_address_list_items mal
         JOIN customers c ON mal.customer_id = c.id
         LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
         ORDER BY mal.created_at DESC`);
            res.render('prepaid/admin/address-list', {
                title: 'Portal Redirect Management',
                layout: 'layouts/main',
                customers: items
            });
        }
        catch (error) {
            console.error('Address list error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    async reports(req, res) {
        try {
            // Revenue by day (30 days)
            const [revenueByDay] = await pool_1.default.query(`SELECT DATE(created_at) as date, COUNT(*) as transactions, 
                SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_number LIKE 'INV/PREP/%' AND status = 'paid'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date DESC`);
            // Package popularity
            const [packagePopularity] = await pool_1.default.query(`SELECT pp.name, COUNT(pps.id) as purchases, 
                SUM(pps.purchase_price) as revenue
         FROM prepaid_package_subscriptions pps
         JOIN prepaid_packages pp ON pps.package_id = pp.id
         GROUP BY pp.id, pp.name
         ORDER BY purchases DESC`);
            // Monthly revenue
            const [monthlyRevenue] = await pool_1.default.query(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as transactions, SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_number LIKE 'INV/PREP/%' AND status = 'paid'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY month DESC`);
            res.render('prepaid/admin/reports', {
                title: 'Laporan Prepaid',
                layout: 'layouts/main',
                revenueByDay,
                packagePopularity,
                monthlyRevenue
            });
        }
        catch (error) {
            console.error('Reports error:', error);
            res.status(500).send(`Error: ${error}`);
        }
    }
    async triggerScheduler(req, res) {
        try {
            const result = await PrepaidSchedulerServiceComplete_1.default.triggerManually();
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async addToPortalRedirect(req, res) {
        req.flash('info', 'Feature coming soon');
        res.redirect('/prepaid/address-list');
    }
    async removeFromPortalRedirect(req, res) {
        req.flash('info', 'Feature coming soon');
        res.redirect('/prepaid/address-list');
    }
}
exports.default = new PrepaidAdminControllerFull();
//# sourceMappingURL=PrepaidAdminControllerFull.js.map