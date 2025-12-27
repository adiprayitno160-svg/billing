"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteCustomers = exports.deleteCustomer = exports.updateCustomer = exports.getCustomerEdit = exports.getCustomerDetail = exports.testMikrotikAddressLists = exports.getCustomerList = void 0;
const pool_1 = require("../db/pool");
const mikrotikConfigHelper_1 = require("../utils/mikrotikConfigHelper");
const pppoeService_1 = require("../services/pppoeService");
const staticIpPackageService_1 = require("../services/staticIpPackageService");
const mikrotikService_1 = require("../services/mikrotikService");
const ipHelper_1 = require("../utils/ipHelper");
/**
 * Get customer list page
 */
const getCustomerList = async (req, res) => {
    console.log('[getCustomerList] Route handler called for:', req.path);
    try {
        // Get search and filter parameters
        const search = req.query.search || '';
        const status = req.query.status || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 50; // Items per page
        const offset = (page - 1) * limit;
        // Build WHERE clause
        let whereConditions = [];
        let queryParams = [];
        if (search) {
            whereConditions.push(`(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.pppoe_username LIKE ?)`);
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        if (status) {
            whereConditions.push('c.status = ?');
            queryParams.push(status);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        // Query all customers with their subscriptions and packages
        const query = `
            SELECT 
                c.*,
                s.package_name as postpaid_package_name,
                s.price as subscription_price
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
        const [customers] = await pool_1.databasePool.query(query, queryParams);
        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
        const countParams = queryParams.slice(0, -2); // Remove limit and offset
        const [countResult] = await pool_1.databasePool.query(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        // Map results to include package_name
        const customersWithPackages = customers.map((customer) => ({
            ...customer,
            package_name: customer.postpaid_package_name || null
        }));
        // Get statistics for the view
        const [totalCount] = await pool_1.databasePool.query('SELECT COUNT(*) as total FROM customers');
        const [activeCount] = await pool_1.databasePool.query("SELECT COUNT(*) as total FROM customers WHERE status = 'active'");
        const [inactiveCount] = await pool_1.databasePool.query("SELECT COUNT(*) as total FROM customers WHERE status = 'inactive'");
        res.render('customers/list', {
            title: 'Data Pelanggan',
            customers: customersWithPackages,
            stats: {
                total: totalCount[0]?.total || 0,
                active: activeCount[0]?.total || 0,
                inactive: inactiveCount[0]?.total || 0
            },
            pagination: {
                page: page,
                limit: limit,
                total: total,
                pages: Math.ceil(total / limit)
            },
            filters: {
                search: search,
                status: status
            },
            success: req.query.success || null,
            error: req.query.error || null,
            currentPath: '/customers/list'
        });
    }
    catch (error) {
        console.error('Error fetching customer list:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data pelanggan';
        res.status(500).render('customers/list', {
            title: 'Data Pelanggan',
            customers: [],
            stats: { total: 0, active: 0, inactive: 0 },
            error: errorMessage,
            currentPath: '/customers/list'
        });
    }
};
exports.getCustomerList = getCustomerList;
/**
 * Test Mikrotik connection and list all address lists
 */
const testMikrotikAddressLists = async (req, res) => {
    try {
        const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
        if (!config) {
            return res.send(`
                <html>
                    <head><title>Mikrotik Not Configured</title></head>
                    <body style="font-family: Arial; padding: 20px; color: red;">
                        <h2>❌ Mikrotik Belum Dikonfigurasi</h2>
                        <p><a href="/settings/mikrotik">Setup Mikrotik dulu</a></p>
                    </body>
                </html>
            `);
        }
        const { RouterOSAPI } = require('routeros-api');
        const api = new RouterOSAPI({
            host: config.host,
            port: config.api_port || config.port || 8728,
            user: config.username,
            password: config.password,
            timeout: 10000
        });
        await api.connect();
        console.log('✅ Connected to Mikrotik');
        // Get all address lists
        const allAddressLists = await api.write('/ip/firewall/address-list/print');
        const allListsArray = Array.isArray(allAddressLists) ? allAddressLists : [];
        // Group by list name
        const listsByName = {};
        for (const entry of allListsArray) {
            const listName = entry.list || 'UNKNOWN';
            if (!listsByName[listName]) {
                listsByName[listName] = [];
            }
            listsByName[listName].push(entry);
        }
        // Check for prepaid lists
        const prepaidNoPackage = listsByName['prepaid-no-package'] || [];
        const prepaidActive = listsByName['prepaid-active'] || [];
        let html = `
            <html>
                <head>
                    <title>Mikrotik Address Lists Test</title>
                    <style>
                        body { font-family: Arial; padding: 20px; }
                        .success { color: green; }
                        .error { color: red; }
                        .warning { color: orange; }
                        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #4CAF50; color: white; }
                        .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>🔍 Mikrotik Address Lists Status</h1>
                    <div class="section">
                        <h2>Connection Info</h2>
                        <p><strong>Host:</strong> ${config.host}:${config.api_port || config.port || 8728}</p>
                        <p><strong>User:</strong> ${config.username}</p>
                        <p class="success">✅ Connected successfully</p>
                    </div>
        `;
        // Prepaid lists status
        html += `
            <div class="section">
                <h2>📋 Prepaid Address Lists</h2>
                <p><strong>prepaid-no-package:</strong> ${prepaidNoPackage.length > 0 ? `<span class="success">✅ Found (${prepaidNoPackage.length} entries)</span>` : '<span class="error">❌ NOT FOUND</span>'}</p>
                <p><strong>prepaid-active:</strong> ${prepaidActive.length > 0 ? `<span class="success">✅ Found (${prepaidActive.length} entries)</span>` : '<span class="error">❌ NOT FOUND</span>'}</p>
        `;
        if (prepaidNoPackage.length === 0 && prepaidActive.length === 0) {
            html += `
                <p class="warning">⚠️ Address lists belum dibuat. Akan dibuat otomatis saat IP pertama ditambahkan.</p>
                <p><a href="/quick-fix-ip?ip=192.168.5.2">Tambah IP 192.168.5.2 (akan membuat list otomatis)</a></p>
            `;
        }
        html += `</div>`;
        // Show prepaid-no-package entries
        if (prepaidNoPackage.length > 0) {
            html += `
                <div class="section">
                    <h2>📝 prepaid-no-package Entries (${prepaidNoPackage.length})</h2>
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>Address</th>
                            <th>Comment</th>
                            <th>Disabled</th>
                        </tr>
            `;
            for (const entry of prepaidNoPackage) {
                html += `
                    <tr>
                        <td>${entry['.id'] || 'N/A'}</td>
                        <td><strong>${entry.address || 'N/A'}</strong></td>
                        <td>${entry.comment || '-'}</td>
                        <td>${entry.disabled === 'true' ? 'Yes' : 'No'}</td>
                    </tr>
                `;
            }
            html += `</table></div>`;
        }
        // Show prepaid-active entries
        if (prepaidActive.length > 0) {
            html += `
                <div class="section">
                    <h2>✅ prepaid-active Entries (${prepaidActive.length})</h2>
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>Address</th>
                            <th>Comment</th>
                            <th>Disabled</th>
                        </tr>
            `;
            for (const entry of prepaidActive) {
                html += `
                    <tr>
                        <td>${entry['.id'] || 'N/A'}</td>
                        <td><strong>${entry.address || 'N/A'}</strong></td>
                        <td>${entry.comment || '-'}</td>
                        <td>${entry.disabled === 'true' ? 'Yes' : 'No'}</td>
                    </tr>
                `;
            }
            html += `</table></div>`;
        }
        // All address lists
        html += `
            <div class="section">
                <h2>📊 All Address Lists in Mikrotik</h2>
                <p><strong>Total lists found:</strong> ${Object.keys(listsByName).length}</p>
                <ul>
        `;
        for (const listName of Object.keys(listsByName)) {
            html += `<li><strong>${listName}</strong>: ${listsByName[listName].length} entries</li>`;
        }
        html += `</ul></div>`;
        // Quick actions
        html += `
            <div class="section">
                <h2>🚀 Quick Actions</h2>
                <ul>
                    <li><a href="/quick-fix-ip?ip=192.168.5.2">Tambah IP 192.168.5.2 ke prepaid-no-package</a></li>
                    <li><a href="/test-mikrotik-address-lists">Refresh (cek lagi)</a></li>
                    <li><a href="/prepaid/address-list">Address List Management</a></li>
                    <li><a href="/prepaid/mikrotik-setup">Mikrotik Setup Wizard</a></li>
                </ul>
            </div>
        `;
        html += `</body></html>`;
        api.close();
        res.send(html);
    }
    catch (error) {
        console.error('Error testing Mikrotik address lists:', error);
        return res.send(`
            <html>
                <head><title>Error</title></head>
                <body style="font-family: Arial; padding: 20px; color: red;">
                    <h2>❌ Error</h2>
                    <p><strong>Message:</strong> ${error.message || 'Unknown error'}</p>
                    <p><strong>Details:</strong></p>
                    <pre>${error.stack || JSON.stringify(error, null, 2)}</pre>
                    <hr>
                    <p><a href="/settings/mikrotik">Check Mikrotik Settings</a></p>
                </body>
            </html>
        `);
    }
};
exports.testMikrotikAddressLists = testMikrotikAddressLists;
/**
 * Get customer detail page
 */
const getCustomerDetail = async (req, res) => {
    try {
        console.log('[getCustomerDetail] Request received, params:', req.params);
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID is required' });
        }
        const customerId = parseInt(id);
        console.log('[getCustomerDetail] Parsed customer ID:', customerId);
        if (!customerId || isNaN(customerId)) {
            console.log('[getCustomerDetail] Invalid customer ID');
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        // Get customer with all related data (without sic.gateway)
        const query = `
            SELECT 
                c.*,
                s.package_name as postpaid_package_name,
                s.price as subscription_price,
                s.package_id as subscription_package_id,
                pp.name as pppoe_package_name,
                pp.rate_limit_rx,
                pp.rate_limit_tx,
                pp.price as pppoe_package_price,
                pp.description as pppoe_package_description,
                olt.name as olt_name,
                odc.name as odc_name,
                odp.name as odp_name
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
            LEFT JOIN pppoe_packages pp ON s.package_id = pp.id AND c.connection_type = 'pppoe'
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
            LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
            LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
            WHERE c.id = ?
            LIMIT 1
        `;
        const [customers] = await pool_1.databasePool.query(query, [customerId]);
        if (!customers || customers.length === 0) {
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        const customer = customers[0];
        if (!customer) {
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        // IMPORTANT: Proses IP address untuk static IP
        // IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
        // IP yang ditampilkan ke user harus IP client (192.168.1.2)
        if (customer.connection_type === 'static_ip' && customer.static_ip_address) {
            customer.static_ip_address = (0, ipHelper_1.calculateCustomerIP)(customer.static_ip_address);
        }
        // Format package data based on connection type
        let packageData = null;
        if (customer.connection_type === 'pppoe' && customer.pppoe_package_name) {
            packageData = {
                name: customer.pppoe_package_name,
                price: customer.pppoe_package_price,
                rate_limit_rx: customer.rate_limit_rx,
                rate_limit_tx: customer.rate_limit_tx,
                description: customer.pppoe_package_description
            };
        }
        else if (customer.connection_type === 'static_ip' && customer.static_ip_package_name) {
            packageData = {
                name: customer.static_ip_package_name,
                price: customer.static_ip_package_price,
                max_limit_download: customer.max_limit_download,
                max_limit_upload: customer.max_limit_upload
            };
        }
        // Get customer invoices
        let invoices = [];
        try {
            const [invoicesResult] = await pool_1.databasePool.query(`SELECT * FROM invoices 
             WHERE customer_id = ? 
             ORDER BY created_at DESC`, [customerId]);
            invoices = Array.isArray(invoicesResult) ? invoicesResult : [];
        }
        catch (invoiceError) {
            console.error('Error fetching invoices:', invoiceError);
            invoices = [];
        }
        res.render('customers/detail', {
            title: `Detail Pelanggan - ${customer.name}`,
            customer: {
                ...customer,
                pppoe_package: customer.connection_type === 'pppoe' ? packageData : null,
                static_ip_package: customer.connection_type === 'static_ip' ? packageData : null
            },
            invoices: invoices || [],
            currentPath: `/customers/${customerId}`
        });
    }
    catch (error) {
        console.error('Error fetching customer detail:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memuat detail pelanggan';
        res.status(500).render('error', {
            title: 'Error',
            message: errorMessage
        });
    }
};
exports.getCustomerDetail = getCustomerDetail;
/**
 * Get customer edit page
 */
const getCustomerEdit = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID is required' });
        }
        const customerId = parseInt(id);
        if (!customerId || isNaN(customerId)) {
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        // Get customer with package info based on connection type
        const query = `
            SELECT 
                c.*,
                sic.ip_address,
                sic.interface,
                sic.package_id as static_ip_package_id,
                s.package_id as pppoe_package_id,
                CASE 
                    WHEN c.connection_type = 'pppoe' THEN s.package_id
                    WHEN c.connection_type = 'static_ip' THEN sic.package_id
                    ELSE NULL
                END as package_id
            FROM customers c
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND c.connection_type = 'pppoe' AND s.status = 'active'
            WHERE c.id = ?
            LIMIT 1
        `;
        const [customers] = await pool_1.databasePool.query(query, [customerId]);
        if (!customers || customers.length === 0) {
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        const customer = customers[0];
        // Get packages based on connection type
        let packages = [];
        try {
            if (customer.connection_type === 'pppoe') {
                packages = await (0, pppoeService_1.listPackages)();
            }
            else if (customer.connection_type === 'static_ip') {
                packages = await (0, staticIpPackageService_1.listStaticIpPackages)();
            }
        }
        catch (packageError) {
            console.error('Error fetching packages:', packageError);
            packages = [];
        }
        // Get MikroTik interfaces
        let interfaces = [];
        let interfaceError = null;
        try {
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            if (mikrotikConfig) {
                const configWithTls = {
                    ...mikrotikConfig,
                    use_tls: mikrotikConfig.use_tls ?? false
                };
                interfaces = await (0, mikrotikService_1.getInterfaces)(configWithTls);
            }
            else {
                interfaceError = 'MikroTik tidak dikonfigurasi';
            }
        }
        catch (interfaceErr) {
            console.error('Error fetching interfaces:', interfaceErr);
            interfaceError = interfaceErr instanceof Error ? interfaceErr.message : 'Gagal memuat interface';
            interfaces = [];
        }
        // Get ODP data
        let odpData = [];
        try {
            const [odpRows] = await pool_1.databasePool.query(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.name as odc_name,
                    odc.olt_id,
                    olt.name as olt_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);
            odpData = Array.isArray(odpRows) ? odpRows : [];
        }
        catch (odpError) {
            console.error('Error fetching ODP data:', odpError);
            odpData = [];
        }
        // Get customer with password field for view (password is already in customer object from first query)
        const customerForView = customer;
        res.render('customers/edit', {
            title: `Edit Pelanggan - ${customer.name}`,
            customer: customerForView,
            packages: packages || [],
            interfaces: interfaces || [],
            interfaceError: interfaceError,
            odpData: odpData || [],
            currentPath: `/customers/${customerId}/edit`
        });
    }
    catch (error) {
        console.error('Error fetching customer for edit:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data pelanggan';
        res.status(500).render('error', {
            title: 'Error',
            message: errorMessage
        });
    }
};
exports.getCustomerEdit = getCustomerEdit;
/**
 * Update customer
 */
const updateCustomer = async (req, res) => {
    try {
        console.log('[updateCustomer] Request received, method:', req.method, 'params:', req.params);
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID is required' });
        }
        const customerId = parseInt(id);
        console.log('[updateCustomer] Parsed customer ID:', customerId);
        if (!customerId || isNaN(customerId)) {
            console.log('[updateCustomer] Invalid customer ID');
            return res.status(400).json({
                success: false,
                error: 'Invalid customer ID'
            });
        }
        const { name, customer_code, phone, email, address, status, connection_type, pppoe_username, pppoe_password, pppoe_profile_id, pppoe_package, ip_address, interface: interfaceName, static_ip_package, odp_id, odc_id, custom_payment_deadline, custom_isolate_days_after_deadline } = req.body;
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            // Check if customer exists and get old data
            const [customers] = await conn.query('SELECT id, name, pppoe_username, connection_type, pppoe_password FROM customers WHERE id = ?', [customerId]);
            if (!customers || customers.length === 0) {
                await conn.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'Pelanggan tidak ditemukan'
                });
            }
            const oldCustomer = customers[0];
            if (!oldCustomer) {
                return res.status(404).json({ success: false, error: 'Customer not found' });
            }
            const oldName = oldCustomer.name;
            const oldPppoeUsername = oldCustomer.pppoe_username;
            const oldPppoePassword = oldCustomer.pppoe_password;
            // Update customer basic info
            const updateFields = [];
            const updateValues = [];
            if (name !== undefined) {
                updateFields.push('name = ?');
                updateValues.push(name);
            }
            if (customer_code !== undefined) {
                updateFields.push('customer_code = ?');
                updateValues.push(customer_code || null);
            }
            if (phone !== undefined) {
                updateFields.push('phone = ?');
                updateValues.push(phone || null);
            }
            if (email !== undefined) {
                updateFields.push('email = ?');
                updateValues.push(email || null);
            }
            if (address !== undefined) {
                updateFields.push('address = ?');
                updateValues.push(address || null);
            }
            if (status !== undefined) {
                updateFields.push('status = ?');
                updateValues.push(status);
            }
            if (connection_type !== undefined) {
                updateFields.push('connection_type = ?');
                updateValues.push(connection_type);
            }
            if (odp_id !== undefined) {
                updateFields.push('odp_id = ?');
                updateValues.push(odp_id || null);
            }
            if (odc_id !== undefined) {
                updateFields.push('odc_id = ?');
                updateValues.push(odc_id || null);
            }
            // Handle custom deadline fields
            if (custom_payment_deadline !== undefined && custom_payment_deadline !== '') {
                const deadline = parseInt(custom_payment_deadline);
                if (deadline >= 1 && deadline <= 31) {
                    updateFields.push('custom_payment_deadline = ?');
                    updateValues.push(deadline);
                }
                else {
                    updateFields.push('custom_payment_deadline = NULL');
                }
            }
            else if (custom_payment_deadline === '') {
                // Empty string means reset to NULL
                updateFields.push('custom_payment_deadline = NULL');
            }
            if (custom_isolate_days_after_deadline !== undefined && custom_isolate_days_after_deadline !== '') {
                const days = parseInt(custom_isolate_days_after_deadline);
                if (days >= 1 && days <= 7) {
                    updateFields.push('custom_isolate_days_after_deadline = ?');
                    updateValues.push(days);
                }
            }
            if (updateFields.length > 0) {
                updateValues.push(customerId);
                await conn.query(`UPDATE customers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, updateValues);
            }
            // Handle connection type specific updates (basic fields only, password will be handled after MikroTik sync)
            if (connection_type === 'pppoe' && pppoe_username) {
                updateFields.length = 0;
                updateValues.length = 0;
                updateFields.push('pppoe_username = ?');
                updateValues.push(pppoe_username);
                if (pppoe_profile_id) {
                    const profileIdNum = parseInt(pppoe_profile_id);
                    if (!isNaN(profileIdNum) && profileIdNum > 0) {
                        updateFields.push('pppoe_profile_id = ?');
                        updateValues.push(profileIdNum);
                    }
                }
                // Note: Password update will be handled after MikroTik sync to ensure consistency
                updateValues.push(customerId);
                await conn.query(`UPDATE customers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, updateValues);
            }
            // ========== UPDATE SUBSCRIPTION KETIKA PAKET DIUBAH ==========
            // Handle package update for PPPoE customers
            if (connection_type === 'pppoe' && pppoe_package) {
                const packageId = parseInt(pppoe_package);
                if (!isNaN(packageId) && packageId > 0) {
                    console.log(`[Edit Customer] Updating subscription for customer ${customerId} to package ${packageId}`);
                    // Get package details
                    const [packageRows] = await conn.query('SELECT id, name, price FROM pppoe_packages WHERE id = ?', [packageId]);
                    if (packageRows && packageRows.length > 0) {
                        const pkg = packageRows[0];
                        // Check if subscription exists
                        const [existingSubs] = await conn.query('SELECT id FROM subscriptions WHERE customer_id = ? AND status = "active"', [customerId]);
                        if (existingSubs && existingSubs.length > 0) {
                            // Update existing subscription
                            await conn.query(`UPDATE subscriptions 
                                 SET package_id = ?, package_name = ?, price = ?, updated_at = NOW() 
                                 WHERE customer_id = ? AND status = 'active'`, [pkg?.id, pkg?.name, pkg?.price, customerId]);
                            console.log(`[Edit Customer] ✅ Subscription updated to package: ${pkg?.name}`);
                        }
                        else {
                            // Create new subscription
                            await conn.query(`INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), NOW())`, [customerId, pkg?.id, pkg?.name, pkg?.price]);
                            console.log(`[Edit Customer] ✅ New subscription created with package: ${pkg?.name}`);
                        }
                    }
                    else {
                        console.log(`[Edit Customer] ⚠️ Package ID ${packageId} not found in pppoe_packages`);
                    }
                }
            }
            await conn.commit();
            // Sync secret ke MikroTik untuk PPPoE customers
            const currentConnectionType = connection_type || oldCustomer.connection_type;
            const newName = name || oldName;
            console.log('\n');
            console.log('========================================');
            console.log('[Edit Customer] ========== PPPoE SYNC START ==========');
            console.log('[Edit Customer] Customer ID:', customerId);
            console.log('[Edit Customer] Connection Type:', currentConnectionType);
            console.log('[Edit Customer] New Name:', newName);
            console.log('========================================');
            console.log('\n');
            if (currentConnectionType === 'pppoe') {
                try {
                    const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../services/pppoeService')));
                    const { findPppoeSecretIdByName, updatePppoeSecret, createPppoeSecret } = await Promise.resolve().then(() => __importStar(require('../services/mikrotikService')));
                    const config = await getMikrotikConfig();
                    if (config && newName) {
                        const oldSecretUsername = oldPppoeUsername || '';
                        // Get profile name from package if package is selected
                        let profileName = undefined;
                        // First, try to get profile from package (priority)
                        // Check both pppoe_package from form and existing package_id from customer
                        const packageIdToUse = pppoe_package || oldCustomer.package_id || oldCustomer.pppoe_package_id;
                        // Validate packageIdToUse: must be a valid number (not empty string, not null, not undefined, not NaN)
                        const packageIdNum = packageIdToUse ? Number(packageIdToUse) : null;
                        if (packageIdToUse && packageIdNum && !isNaN(packageIdNum) && packageIdNum > 0) {
                            try {
                                const { getPackageById, getProfileById } = await Promise.resolve().then(() => __importStar(require('../services/pppoeService')));
                                const packageData = await getPackageById(packageIdNum);
                                console.log(`[Edit Customer PPPoE] Package data untuk ID ${packageIdNum}:`, packageData ? 'Ditemukan' : 'Tidak ditemukan');
                                if (packageData && packageData.profile_id) {
                                    const profileIdNum = Number(packageData.profile_id);
                                    if (!isNaN(profileIdNum) && profileIdNum > 0) {
                                        const profile = await getProfileById(profileIdNum);
                                        if (profile) {
                                            profileName = profile.name;
                                            console.log(`[Edit Customer PPPoE] ✅ Profile dari paket (ID: ${packageIdNum}): ${profileName}`);
                                        }
                                        else {
                                            console.log(`[Edit Customer PPPoE] ⚠️ Profile dengan ID ${profileIdNum} tidak ditemukan`);
                                        }
                                    }
                                    else {
                                        console.log(`[Edit Customer PPPoE] ⚠️ Paket (ID: ${packageIdNum}) memiliki profile_id yang tidak valid: ${packageData.profile_id}`);
                                    }
                                }
                                else {
                                    console.log(`[Edit Customer PPPoE] ⚠️ Paket (ID: ${packageIdNum}) tidak memiliki profile_id`);
                                }
                            }
                            catch (packageError) {
                                console.error('⚠️ Gagal mendapatkan profile dari paket:', packageError);
                            }
                        }
                        else {
                            console.log(`[Edit Customer PPPoE] ⚠️ Tidak ada paket yang dipilih (pppoe_package: ${pppoe_package}, existing package_id: ${oldCustomer.package_id})`);
                        }
                        // Fallback: Get profile name if profile_id is provided directly
                        if (!profileName && pppoe_profile_id) {
                            try {
                                const profileIdNum = Number(pppoe_profile_id);
                                if (!isNaN(profileIdNum) && profileIdNum > 0) {
                                    const { getProfileById } = await Promise.resolve().then(() => __importStar(require('../services/pppoeService')));
                                    const profile = await getProfileById(profileIdNum);
                                    if (profile) {
                                        profileName = profile.name;
                                        console.log(`[Edit Customer PPPoE] Profile dari profile_id (${profileIdNum}): ${profileName}`);
                                    }
                                }
                                else {
                                    console.log(`[Edit Customer PPPoE] ⚠️ profile_id yang tidak valid: ${pppoe_profile_id}`);
                                }
                            }
                            catch (profileError) {
                                console.error('⚠️ Gagal mendapatkan profile:', profileError);
                            }
                        }
                        console.log(`[Edit Customer PPPoE] Profile yang akan digunakan: ${profileName || 'tidak ada (MikroTik akan menggunakan default)'}`);
                        // Use username from form as the name for PPPoE secret (not customer ID)
                        // IMPORTANT: Use the username from form, not customer ID
                        console.log(`[Edit Customer PPPoE] ========== DEBUG START ==========`);
                        console.log(`[Edit Customer PPPoE] Customer ID: ${customerId}`);
                        console.log(`[Edit Customer PPPoE] pppoe_username from form (raw):`, pppoe_username);
                        console.log(`[Edit Customer PPPoE] pppoe_username type:`, typeof pppoe_username);
                        console.log(`[Edit Customer PPPoE] oldPppoeUsername from DB:`, oldPppoeUsername);
                        // Get username - prioritize form value, then old username from DB
                        let newUsername = '';
                        if (pppoe_username && typeof pppoe_username === 'string' && pppoe_username.trim()) {
                            newUsername = pppoe_username.trim();
                            console.log(`[Edit Customer PPPoE] ✅ Menggunakan username dari form: "${newUsername}"`);
                        }
                        else if (oldPppoeUsername && oldPppoeUsername.trim()) {
                            newUsername = oldPppoeUsername.trim();
                            console.log(`[Edit Customer PPPoE] ⚠️ Username dari form kosong, menggunakan username lama dari DB: "${newUsername}"`);
                        }
                        else {
                            console.error(`[Edit Customer PPPoE] ❌ ERROR: Tidak ada username! Form: "${pppoe_username}", DB: "${oldPppoeUsername}"`);
                            console.error(`[Edit Customer PPPoE] ❌ Secret TIDAK AKAN dibuat karena tidak ada username`);
                            // Don't create secret if no username
                            throw new Error('Username PPPoE wajib diisi untuk membuat secret di MikroTik');
                        }
                        const secretName = newUsername; // ALWAYS use username, never customer ID
                        console.log(`[Edit Customer PPPoE] ✅ Secret Name (FINAL): "${secretName}"`);
                        console.log(`[Edit Customer PPPoE] ✅ Secret akan dibuat/di-update dengan username: "${secretName}"`);
                        console.log(`[Edit Customer PPPoE] New Name: ${newName}`);
                        console.log(`[Edit Customer PPPoE] Password provided: ${pppoe_password ? 'YES (length: ' + pppoe_password.length + ')' : 'NO'}`);
                        console.log(`[Edit Customer PPPoE] ========== DEBUG END ==========`);
                        // Cek apakah secret sudah ada (dengan username baru, username lama, atau customer ID)
                        let existingSecretId = null;
                        let existingSecretByNewUsername = null;
                        let existingSecretByCustomerId = null;
                        let secretFoundBy = null; // Track which identifier found the secret
                        // Check by new username first (priority)
                        if (newUsername) {
                            try {
                                existingSecretByNewUsername = await findPppoeSecretIdByName(config, newUsername);
                                if (existingSecretByNewUsername) {
                                    console.log(`[Edit Customer PPPoE] ✅ Secret ditemukan dengan username baru: ${newUsername}`);
                                    secretFoundBy = 'new_username';
                                }
                            }
                            catch (findNewError) {
                                // Ignore error, secret doesn't exist with this username
                                console.log(`[Edit Customer PPPoE] ℹ️ Secret tidak ditemukan dengan username baru: ${newUsername}`);
                            }
                        }
                        // Check by old username (for backward compatibility)
                        if (!existingSecretByNewUsername && oldSecretUsername && oldSecretUsername !== newUsername) {
                            try {
                                existingSecretId = await findPppoeSecretIdByName(config, oldSecretUsername);
                                if (existingSecretId) {
                                    console.log(`[Edit Customer PPPoE] ✅ Secret ditemukan dengan username lama: ${oldSecretUsername}`);
                                    secretFoundBy = 'old_username';
                                }
                            }
                            catch (findError) {
                                // Ignore error
                                console.log(`[Edit Customer PPPoE] ℹ️ Secret tidak ditemukan dengan username lama: ${oldSecretUsername}`);
                            }
                        }
                        // Check by customer ID (for legacy secrets created with customer ID)
                        if (!existingSecretByNewUsername && !existingSecretId && customerId && !isNaN(customerId)) {
                            const customerIdStr = customerId.toString();
                            try {
                                existingSecretByCustomerId = await findPppoeSecretIdByName(config, customerIdStr);
                                if (existingSecretByCustomerId) {
                                    console.log(`[Edit Customer PPPoE] ⚠️ Secret ditemukan dengan Customer ID (legacy): ${customerIdStr}`);
                                    console.log(`[Edit Customer PPPoE] ⚠️ Secret ini akan di-update ke username baru: ${newUsername || 'N/A'}`);
                                    secretFoundBy = 'customer_id';
                                }
                            }
                            catch (findCustomerIdError) {
                                // Ignore error
                                console.log(`[Edit Customer PPPoE] ℹ️ Secret tidak ditemukan dengan Customer ID: ${customerIdStr}`);
                            }
                        }
                        // Determine password to use: new password if provided (and not empty), otherwise use old password, or generate new one only if customer has no password at all
                        let passwordToUse;
                        if (pppoe_password && pppoe_password.trim() !== '') {
                            // Password baru diisi, gunakan password baru
                            passwordToUse = pppoe_password.trim();
                            console.log(`[Edit Customer PPPoE] ✅ Menggunakan password baru dari form`);
                        }
                        else if (oldPppoePassword && oldPppoePassword.trim() !== '') {
                            // Password tidak diisi, tapi ada password lama, gunakan password lama
                            passwordToUse = oldPppoePassword;
                            console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, menggunakan password lama`);
                        }
                        else {
                            // Tidak ada password baru dan tidak ada password lama, generate password baru
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
                            passwordToUse = '';
                            for (let i = 0; i < length; i++) {
                                passwordToUse += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            console.log(`[Edit Customer PPPoE] 🔑 Password auto-generated: ${passwordToUse.length} characters`);
                        }
                        if (existingSecretId || existingSecretByNewUsername || existingSecretByCustomerId) {
                            // If secret found with customer ID (legacy), we need to delete and recreate with username
                            if (secretFoundBy === 'customer_id' && customerId && !isNaN(customerId)) {
                                console.log(`[Edit Customer PPPoE] ⚠️ Secret ditemukan dengan Customer ID (legacy), akan dihapus dan dibuat ulang dengan username`);
                                const { deletePppoeSecret } = await Promise.resolve().then(() => __importStar(require('../services/mikrotikService')));
                                // Delete old secret with customer ID
                                await deletePppoeSecret(config, customerId.toString());
                                console.log(`[Edit Customer PPPoE] ✅ Secret lama dengan Customer ID "${customerId}" berhasil dihapus`);
                                // Create new secret with username
                                await createPppoeSecret(config, {
                                    name: secretName, // Use username, not customer ID
                                    password: passwordToUse,
                                    profile: profileName || undefined,
                                    comment: newName
                                });
                                console.log(`[Edit Customer PPPoE] ✅ Secret baru dengan username "${secretName}" berhasil dibuat`);
                                // Update username di database dengan username baru
                                if (newUsername) {
                                    await conn.query('UPDATE customers SET pppoe_username = ? WHERE id = ?', [newUsername, customerId]);
                                    console.log(`[Edit Customer PPPoE] ✅ Username di database di-update ke: ${newUsername}`);
                                }
                            }
                            else {
                                // Update existing secret with username (normal update)
                                const updateData = {
                                    comment: newName // Use customer name as comment
                                };
                                // Update password jika ada (baik password baru maupun tetap pakai yang lama)
                                if (passwordToUse) {
                                    updateData.password = passwordToUse;
                                }
                                // Update profile jika ada (dari paket atau profile_id)
                                if (profileName) {
                                    updateData.profile = profileName;
                                    console.log(`[Edit Customer PPPoE] Profile akan di-update ke: ${profileName}`);
                                }
                                else {
                                    console.log(`[Edit Customer PPPoE] Profile tidak di-update (tidak ada profile dari paket)`);
                                }
                                // Determine which identifier to use for updating
                                let secretToUpdate;
                                if (existingSecretByNewUsername) {
                                    secretToUpdate = newUsername;
                                }
                                else if (existingSecretId) {
                                    secretToUpdate = oldSecretUsername;
                                }
                                else {
                                    secretToUpdate = newUsername || oldSecretUsername;
                                }
                                console.log(`[Edit Customer PPPoE] Secret ditemukan dengan identifier: ${secretFoundBy}, akan di-update: ${secretToUpdate}`);
                                // Update secret di MikroTik - use existing secret identifier
                                await updatePppoeSecret(config, secretToUpdate, updateData);
                            }
                            // Update username di database dengan username baru
                            if (newUsername && newUsername !== oldSecretUsername) {
                                await conn.query('UPDATE customers SET pppoe_username = ? WHERE id = ?', [newUsername, customerId]);
                            }
                            // Update password di database hanya jika password baru diisi (jika kosong, tetap gunakan password lama)
                            if (pppoe_password && pppoe_password.trim() !== '') {
                                // Password baru diisi, update ke database
                                await conn.query('UPDATE customers SET pppoe_password = ? WHERE id = ?', [passwordToUse, customerId]);
                                console.log(`[Edit Customer PPPoE] ✅ Password baru di-update di database (${passwordToUse.length} characters)`);
                            }
                            else {
                                // Password tidak diisi, tidak perlu update (tetap menggunakan password lama)
                                console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, tetap menggunakan password yang ada`);
                            }
                            console.log(`✅ PPPoE secret dengan username "${secretName}" berhasil di-update di MikroTik`);
                        }
                        else {
                            // Create secret baru jika belum ada (secret dihapus atau belum pernah dibuat)
                            console.log(`[Edit Customer PPPoE] 🔄 Secret tidak ditemukan, akan membuat secret baru...`);
                            console.log(`[Edit Customer PPPoE] Password baru: ${pppoe_password && pppoe_password.trim() !== '' ? 'ADA (length: ' + pppoe_password.length + ')' : 'TIDAK ADA'}`);
                            console.log(`[Edit Customer PPPoE] Password lama: ${oldPppoePassword ? 'ADA (length: ' + oldPppoePassword.length + ')' : 'TIDAK ADA'}`);
                            console.log(`[Edit Customer PPPoE] Password yang akan digunakan: ${passwordToUse ? 'ADA (length: ' + passwordToUse.length + ')' : 'TIDAK ADA'}`);
                            if (passwordToUse && secretName) {
                                console.log(`[Edit Customer PPPoE] ========== CREATING NEW SECRET ==========`);
                                console.log(`[Edit Customer PPPoE] 📤 Membuat secret baru:`);
                                console.log(`[Edit Customer PPPoE]    - Name (username): "${secretName}"`);
                                console.log(`[Edit Customer PPPoE]    - Profile: ${profileName || 'tidak ada (MikroTik default)'}`);
                                console.log(`[Edit Customer PPPoE]    - Comment: ${newName}`);
                                console.log(`[Edit Customer PPPoE]    - Password: ${passwordToUse ? 'ADA' : 'TIDAK ADA'}`);
                                console.log(`[Edit Customer PPPoE] ⚠️ IMPORTANT: Secret dibuat dengan username "${secretName}", BUKAN customer ID!`);
                                await createPppoeSecret(config, {
                                    name: secretName, // ALWAYS use username, NEVER customer ID
                                    password: passwordToUse,
                                    profile: profileName || undefined, // Don't set profile if not found, let MikroTik use default
                                    comment: newName // Use customer name as comment
                                });
                                console.log(`[Edit Customer PPPoE] ✅ Secret berhasil dibuat dengan username: "${secretName}"`);
                                // Update username di database dengan username baru
                                if (newUsername) {
                                    await conn.query('UPDATE customers SET pppoe_username = ? WHERE id = ?', [newUsername, customerId]);
                                }
                                // Update password di database hanya jika password baru diisi atau auto-generated (jika customer belum punya password)
                                if (pppoe_password && pppoe_password.trim() !== '') {
                                    // Password baru diisi, update ke database
                                    await conn.query('UPDATE customers SET pppoe_password = ? WHERE id = ?', [passwordToUse, customerId]);
                                    console.log(`[Edit Customer PPPoE] ✅ Password baru di-update di database (${passwordToUse.length} characters)`);
                                }
                                else if (!oldPppoePassword) {
                                    // Tidak ada password lama dan tidak ada password baru, simpan password yang di-generate
                                    await conn.query('UPDATE customers SET pppoe_password = ? WHERE id = ?', [passwordToUse, customerId]);
                                    console.log(`[Edit Customer PPPoE] ✅ Password auto-generated disimpan di database (${passwordToUse.length} characters)`);
                                }
                                else {
                                    // Password tidak diisi dan ada password lama, tidak perlu update (tetap menggunakan password lama)
                                    console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, tetap menggunakan password yang ada`);
                                }
                                console.log(`✅ PPPoE secret dengan username "${secretName}" berhasil dibuat di MikroTik`);
                            }
                            else {
                                console.error(`❌ Password atau username tidak tersedia, tidak bisa membuat secret baru`);
                                console.error(`   💡 Saran: Isi username dan password saat edit pelanggan untuk membuat secret di MikroTik`);
                                console.error(`   📋 Detail: Customer ID: ${customerId}, Name: ${newName}, Username: ${secretName || 'N/A'}`);
                                // Don't throw error, just log it - customer update can still succeed
                            }
                        }
                    }
                }
                catch (mikrotikError) {
                    console.error('\n');
                    console.error('========================================');
                    console.error('[Edit Customer] ========== MIKROTIK ERROR ==========');
                    console.error('[Edit Customer] ⚠️ Gagal sync secret ke MikroTik:', mikrotikError.message);
                    console.error('[Edit Customer] Error type:', typeof mikrotikError);
                    console.error('[Edit Customer] Error details:', mikrotikError);
                    console.error('[Edit Customer] Error stack:', mikrotikError.stack || 'No stack trace');
                    console.error('========================================');
                    console.error('\n');
                    // Non-critical error - customer updated successfully
                }
            }
            console.log('[updateCustomer] Update successful, redirecting to:', `/customers/${customerId}?success=updated`);
            req.flash('success', 'Data pelanggan berhasil diperbarui');
            res.redirect(`/customers/${customerId}?success=updated`);
        }
        catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error updating customer:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui data pelanggan';
        req.flash('error', errorMessage);
        res.redirect(`/customers/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`);
    }
};
exports.updateCustomer = updateCustomer;
/**
 * Delete customer
 */
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID is required' });
        }
        const customerId = parseInt(id);
        if (!customerId || isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid customer ID'
            });
        }
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Check if customer exists and get full data for MikroTik cleanup and notification
            const [customers] = await conn.query('SELECT id, name, customer_code, phone, connection_type, pppoe_username FROM customers WHERE id = ?', [customerId]);
            if (!customers || customers.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Pelanggan tidak ditemukan'
                });
            }
            const customer = customers[0];
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: 'Pelanggan tidak ditemukan'
                });
            }
            // Send notification before deletion (must be done before customer is deleted)
            // Wrap in try-catch to ensure deletion continues even if notification fails
            try {
                console.log(`[DeleteCustomer] Attempting to send notification for customer ${customerId}...`);
                console.log(`[DeleteCustomer] Customer data: name=${customer.name}, phone=${customer.phone}, code=${customer.customer_code}`);
                if (customer.phone) {
                    try {
                        const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
                        console.log(`[DeleteCustomer] Queueing notification via UnifiedNotificationService...`);
                        const notificationIds = await UnifiedNotificationService.queueNotification({
                            customer_id: customerId,
                            notification_type: 'customer_deleted',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                customer_code: customer.customer_code || `#${customerId}`
                            },
                            priority: 'high'
                        });
                        console.log(`✅ Notification queued for customer deletion: ${customer.name} (${customer.phone}) - Notification IDs: ${notificationIds.join(', ')}`);
                        // Process queue immediately (same as customer_created)
                        try {
                            const result = await UnifiedNotificationService.sendPendingNotifications(10);
                            console.log(`[DeleteCustomer] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
                        }
                        catch (queueError) {
                            console.warn(`[DeleteCustomer] ⚠️ Queue processing error (non-critical):`, queueError.message);
                            // Non-critical, notification is already queued
                        }
                    }
                    catch (queueNotifError) {
                        console.error(`[DeleteCustomer] ⚠️ Failed to queue notification (non-critical, continuing deletion):`, queueNotifError.message);
                        // Continue with deletion even if notification queue fails
                    }
                }
                else {
                    console.log(`⚠️ No phone number for customer ${customerId} (${customer.name}), skipping notification`);
                }
            }
            catch (notifError) {
                console.error(`❌ Failed to send deletion notification for customer ${customerId} (non-critical, continuing deletion):`, notifError.message);
                // Continue with deletion even if notification fails - this is non-critical
            }
            // Delete from MikroTik based on connection type
            try {
                const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../services/pppoeService')));
                const { deletePppoeSecret, removeIpAddress, removeMangleRulesForClient, deleteClientQueuesByClientName } = await Promise.resolve().then(() => __importStar(require('../services/mikrotikService')));
                const config = await getMikrotikConfig();
                if (config) {
                    if (customer.connection_type === 'pppoe') {
                        // Delete PPPoE secret from MikroTik
                        if (customer.pppoe_username) {
                            try {
                                await deletePppoeSecret(config, customer.pppoe_username);
                                console.log(`✅ PPPoE secret "${customer.pppoe_username}" berhasil dihapus dari MikroTik`);
                            }
                            catch (mikrotikError) {
                                console.error(`⚠️ Gagal menghapus PPPoE secret dari MikroTik:`, mikrotikError.message);
                                // Continue deletion even if MikroTik deletion fails
                            }
                        }
                    }
                    else if (customer.connection_type === 'static_ip') {
                        // Get static IP client data
                        const [staticIpClients] = await conn.query('SELECT id, client_name, ip_address, interface FROM static_ip_clients WHERE customer_id = ?', [customerId]);
                        if (staticIpClients && staticIpClients.length > 0) {
                            const staticIpClient = staticIpClients[0];
                            try {
                                // Delete IP address from MikroTik
                                if (staticIpClient.ip_address) {
                                    await removeIpAddress(config, staticIpClient.ip_address);
                                    console.log(`✅ IP address "${staticIpClient.ip_address}" berhasil dihapus dari MikroTik`);
                                }
                                // Calculate peer IP and marks for mangle deletion
                                const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                                if (staticIpClient.ip_address) {
                                    const [ipOnlyRaw, prefixStrRaw] = String(staticIpClient.ip_address || '').split('/');
                                    const ipOnly = ipOnlyRaw || '';
                                    const prefix = Number(prefixStrRaw || '0');
                                    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
                                    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
                                    let peerIp = ipOnly;
                                    if (prefix === 30) {
                                        const firstHost = networkInt + 1;
                                        const secondHost = networkInt + 2;
                                        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
                                        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
                                    }
                                    const downloadMark = peerIp;
                                    const uploadMark = `UP-${peerIp}`;
                                    // Delete firewall mangle rules
                                    await removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
                                    console.log(`✅ Firewall mangle rules untuk "${peerIp}" berhasil dihapus dari MikroTik`);
                                    // Delete queue trees
                                    if (staticIpClient.client_name) {
                                        await deleteClientQueuesByClientName(config, staticIpClient.client_name);
                                        console.log(`✅ Queue trees untuk "${staticIpClient.client_name}" berhasil dihapus dari MikroTik`);
                                    }
                                }
                            }
                            catch (mikrotikError) {
                                console.error(`⚠️ Gagal menghapus static IP resources dari MikroTik:`, mikrotikError.message);
                                // Continue deletion even if MikroTik deletion fails
                            }
                        }
                    }
                }
            }
            catch (mikrotikError) {
                console.error(`⚠️ Error saat menghapus dari MikroTik:`, mikrotikError.message);
                // Continue deletion even if MikroTik deletion fails
            }
            // Delete related data first
            await conn.query('DELETE FROM subscriptions WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM static_ip_clients WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM invoices WHERE customer_id = ?', [customerId]);
            // Delete customer
            await conn.query('DELETE FROM customers WHERE id = ?', [customerId]);
            res.json({
                success: true,
                message: 'Pelanggan berhasil dihapus'
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error deleting customer:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal menghapus pelanggan';
        // Ensure JSON response - check if response already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage
            });
        }
        else {
            console.error('Response already sent, cannot send error response');
        }
    }
};
exports.deleteCustomer = deleteCustomer;
/**
 * Bulk delete customers
 */
const bulkDeleteCustomers = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IDs array is required'
            });
        }
        const customerIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        if (customerIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid customer IDs provided'
            });
        }
        const deleted = [];
        const skipped = [];
        const errors = [];
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            for (const customerId of customerIds) {
                try {
                    // Check if customer exists and get full data for MikroTik cleanup and notification
                    const [customers] = await conn.query('SELECT id, name, customer_code, phone, connection_type, pppoe_username FROM customers WHERE id = ?', [customerId]);
                    if (!customers || customers.length === 0) {
                        skipped.push(customerId);
                        continue;
                    }
                    const customer = customers[0];
                    if (!customer) {
                        skipped.push(customerId);
                        continue;
                    }
                    // Send notification before deletion (must be done before customer is deleted)
                    // Wrap in try-catch to ensure deletion continues even if notification fails
                    try {
                        console.log(`[BulkDelete] Attempting to send notification for customer ${customerId}...`);
                        console.log(`[BulkDelete] Customer data: name=${customer.name}, phone=${customer.phone}, code=${customer.customer_code}`);
                        if (customer.phone) {
                            try {
                                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
                                console.log(`[BulkDelete] Queueing notification via UnifiedNotificationService...`);
                                const notificationIds = await UnifiedNotificationService.queueNotification({
                                    customer_id: customerId,
                                    notification_type: 'customer_deleted',
                                    channels: ['whatsapp'],
                                    variables: {
                                        customer_name: customer.name || 'Pelanggan',
                                        customer_code: customer.customer_code || `#${customerId}`
                                    },
                                    priority: 'high'
                                });
                                console.log(`✅ Notification queued for customer deletion: ${customer.name} (${customer.phone}) - Notification IDs: ${notificationIds.join(', ')}`);
                                // Process queue immediately (same as customer_created)
                                try {
                                    const result = await UnifiedNotificationService.sendPendingNotifications(10);
                                    console.log(`[BulkDelete] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
                                }
                                catch (queueError) {
                                    console.warn(`[BulkDelete] ⚠️ Queue processing error (non-critical):`, queueError.message);
                                    // Non-critical, notification is already queued
                                }
                            }
                            catch (queueNotifError) {
                                console.error(`[BulkDelete] ⚠️ Failed to queue notification (non-critical, continuing deletion):`, queueNotifError.message);
                                // Continue with deletion even if notification queue fails
                            }
                        }
                        else {
                            console.log(`⚠️ No phone number for customer ${customerId} (${customer.name}), skipping notification`);
                        }
                    }
                    catch (notifError) {
                        console.error(`❌ Failed to send deletion notification for customer ${customerId} (non-critical, continuing deletion):`, notifError.message);
                        // Continue with deletion even if notification fails - this is non-critical
                    }
                    // Delete from MikroTik based on connection type
                    try {
                        const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../services/pppoeService')));
                        const { deletePppoeSecret, removeIpAddress, removeMangleRulesForClient, deleteClientQueuesByClientName } = await Promise.resolve().then(() => __importStar(require('../services/mikrotikService')));
                        const config = await getMikrotikConfig();
                        if (config) {
                            if (customer.connection_type === 'pppoe') {
                                // Delete PPPoE secret from MikroTik
                                if (customer.pppoe_username) {
                                    try {
                                        await deletePppoeSecret(config, customer.pppoe_username);
                                        console.log(`✅ PPPoE secret "${customer.pppoe_username}" berhasil dihapus dari MikroTik`);
                                    }
                                    catch (mikrotikError) {
                                        console.error(`⚠️ Gagal menghapus PPPoE secret dari MikroTik:`, mikrotikError.message);
                                        // Continue deletion even if MikroTik deletion fails
                                    }
                                }
                            }
                            else if (customer.connection_type === 'static_ip') {
                                // Get static IP client data
                                const [staticIpClients] = await conn.query('SELECT id, client_name, ip_address, interface FROM static_ip_clients WHERE customer_id = ?', [customerId]);
                                if (staticIpClients && staticIpClients.length > 0) {
                                    const staticIpClient = staticIpClients[0];
                                    try {
                                        // Delete IP address from MikroTik
                                        if (staticIpClient.ip_address) {
                                            await removeIpAddress(config, staticIpClient.ip_address);
                                            console.log(`✅ IP address "${staticIpClient.ip_address}" berhasil dihapus dari MikroTik`);
                                        }
                                        // Calculate peer IP and marks for mangle deletion
                                        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                                        if (staticIpClient.ip_address) {
                                            const [ipOnlyRaw, prefixStrRaw] = String(staticIpClient.ip_address || '').split('/');
                                            const ipOnly = ipOnlyRaw || '';
                                            const prefix = Number(prefixStrRaw || '0');
                                            const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
                                            const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
                                            let peerIp = ipOnly;
                                            if (prefix === 30) {
                                                const firstHost = networkInt + 1;
                                                const secondHost = networkInt + 2;
                                                const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
                                                peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
                                            }
                                            const downloadMark = peerIp;
                                            const uploadMark = `UP-${peerIp}`;
                                            // Delete firewall mangle rules
                                            await removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
                                            console.log(`✅ Firewall mangle rules untuk "${peerIp}" berhasil dihapus dari MikroTik`);
                                            // Delete queue trees
                                            if (staticIpClient.client_name) {
                                                await deleteClientQueuesByClientName(config, staticIpClient.client_name);
                                                console.log(`✅ Queue trees untuk "${staticIpClient.client_name}" berhasil dihapus dari MikroTik`);
                                            }
                                        }
                                    }
                                    catch (mikrotikError) {
                                        console.error(`⚠️ Gagal menghapus static IP resources dari MikroTik:`, mikrotikError.message);
                                        // Continue deletion even if MikroTik deletion fails
                                    }
                                }
                            }
                        }
                    }
                    catch (mikrotikError) {
                        console.error(`⚠️ Error saat menghapus dari MikroTik untuk customer ${customerId}:`, mikrotikError.message);
                        // Continue deletion even if MikroTik deletion fails
                    }
                    // Delete related data first
                    await conn.query('DELETE FROM subscriptions WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM static_ip_clients WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM invoices WHERE customer_id = ?', [customerId]);
                    // Delete customer
                    await conn.query('DELETE FROM customers WHERE id = ?', [customerId]);
                    deleted.push(customerId);
                    console.log(`✅ Customer ${customerId} berhasil dihapus`);
                }
                catch (error) {
                    console.error(`❌ Error deleting customer ${customerId}:`, error);
                    errors.push({
                        id: customerId,
                        error: error.message || 'Unknown error'
                    });
                    skipped.push(customerId);
                }
            }
            await conn.commit();
            res.json({
                success: true,
                message: `Hapus massal selesai. Dihapus: ${deleted.length}, Dilewati: ${skipped.length}`,
                results: {
                    deleted,
                    skipped,
                    errors: errors.length > 0 ? errors : undefined
                }
            });
        }
        catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error in bulk delete customers:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal melakukan hapus massal';
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage
            });
        }
    }
};
exports.bulkDeleteCustomers = bulkDeleteCustomers;
//# sourceMappingURL=customerController.js.map