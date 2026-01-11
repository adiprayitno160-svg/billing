import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { getMikrotikConfig } from '../utils/mikrotikConfigHelper';
import { listPackages as listPppoePackages } from '../services/pppoeService';
import { listStaticIpPackages } from '../services/staticIpPackageService';
import { getInterfaces } from '../services/mikrotikService';
import { calculateCustomerIP } from '../utils/ipHelper';
import GenieacsService from '../services/genieacs/GenieacsService';

/**
 * Get customer list page
 */
export const getCustomerList = async (req: Request, res: Response) => {
    console.log('[getCustomerList] Route handler called for:', req.path);
    try {
        // Get search and filter parameters
        const search = req.query.search as string || '';
        const status = req.query.status as string || '';
        const connection_type = req.query.connection_type as string || '';
        const page = parseInt(req.query.page as string) || 1;
        const limit = 50; // Items per page
        const offset = (page - 1) * limit;

        // Build WHERE clause
        let whereConditions: string[] = [];
        let queryParams: any[] = [];

        if (search) {
            whereConditions.push(`(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.pppoe_username LIKE ?)`);
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (status) {
            whereConditions.push('c.status = ?');
            queryParams.push(status);
        }

        if (connection_type) {
            whereConditions.push('c.connection_type = ?');
            queryParams.push(connection_type);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query all customers with their subscriptions and packages
        const query = `
            SELECT 
                c.*,
                s.package_name as postpaid_package_name,
                s.price as subscription_price,
                sip.name as static_ip_package_name
            FROM customers c
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
            LEFT JOIN static_ip_packages sip ON sic.package_id = sip.id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);
        const [customers] = await databasePool.query<RowDataPacket[]>(query, queryParams);

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
        const countParams = queryParams.slice(0, -2); // Remove limit and offset
        const [countResult] = await databasePool.query<RowDataPacket[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        // Map results to include package_name based on connection_type
        const customersWithPackages = customers.map((customer: any) => {
            let pkgName = null;
            if (customer.connection_type === 'pppoe') {
                pkgName = customer.postpaid_package_name;
            } else if (customer.connection_type === 'static_ip') {
                pkgName = customer.static_ip_package_name;
            }

            return {
                ...customer,
                package_name: pkgName
            };
        });

        // Get statistics for the view
        const [totalCount] = await databasePool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as total FROM customers'
        );
        const [activeCount] = await databasePool.query<RowDataPacket[]>(
            "SELECT COUNT(*) as total FROM customers WHERE status = 'active'"
        );
        const [inactiveCount] = await databasePool.query<RowDataPacket[]>(
            "SELECT COUNT(*) as total FROM customers WHERE status = 'inactive'"
        );

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
                status: status,
                connection_type: connection_type
            },
            success: req.query.success || null,
            error: req.query.error || null,
            currentPath: '/customers/list'
        });

    } catch (error: unknown) {
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

/**
 * Test Mikrotik connection and list all address lists
 */
export const testMikrotikAddressLists = async (req: Request, res: Response) => {
    try {
        const config = await getMikrotikConfig();

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
        const listsByName: { [key: string]: any[] } = {};
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

    } catch (error: any) {
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



/**
 * Get customer detail page
 */
export const getCustomerDetail = async (req: Request, res: Response) => {
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

        const [customers] = await databasePool.query<RowDataPacket[]>(query, [customerId]);

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
            customer.static_ip_address = calculateCustomerIP(customer.static_ip_address);
        }

        // Format package data based on connection type
        let packageData: any = null;
        if (customer.connection_type === 'pppoe' && customer.pppoe_package_name) {
            packageData = {
                name: customer.pppoe_package_name,
                price: customer.pppoe_package_price,
                rate_limit_rx: customer.rate_limit_rx,
                rate_limit_tx: customer.rate_limit_tx,
                description: customer.pppoe_package_description
            };
        } else if (customer.connection_type === 'static_ip' && customer.static_ip_package_name) {
            packageData = {
                name: customer.static_ip_package_name,
                price: customer.static_ip_package_price,
                max_limit_download: customer.max_limit_download,
                max_limit_upload: customer.max_limit_upload
            };
        }

        // Get customer invoices
        let invoices: RowDataPacket[] = [];
        try {
            const [invoicesResult] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM invoices 
             WHERE customer_id = ? 
             ORDER BY created_at DESC`,
                [customerId]
            );
            invoices = Array.isArray(invoicesResult) ? invoicesResult : [];
        } catch (invoiceError) {
            console.error('Error fetching invoices:', invoiceError);
            invoices = [];
        }

        // Initialize device details
        let deviceDetails = null;

        // Debug: Log serial number from customer data
        console.log('[getCustomerDetail] Customer serial_number:', customer.serial_number);
        console.log('[getCustomerDetail] Customer connection_type:', customer.connection_type);

        // Fetch GenieACS info if serial number exists
        if (customer.serial_number) {
            console.log('[getCustomerDetail] Serial number found, attempting GenieACS fetch...');
            try {
                const genieacs = await GenieacsService.getInstanceFromDb();
                console.log('[getCustomerDetail] GenieACS instance created');

                const devices = await genieacs.getDevicesBySerial(customer.serial_number);
                console.log('[getCustomerDetail] Devices found:', devices?.length || 0);

                if (devices && devices.length > 0) {
                    const device = devices[0];
                    const info = genieacs.extractDeviceInfo(device);
                    const signal = genieacs.getSignalInfo(device);
                    const wan = genieacs.getWanStatus(device);
                    const wifi = genieacs.getWiFiDetails(device);

                    deviceDetails = {
                        ...info,
                        signal,
                        wan,
                        wifi
                    };
                    console.log('[getCustomerDetail] Device details compiled:', Object.keys(deviceDetails));
                } else {
                    console.log('[getCustomerDetail] No devices found in GenieACS for SN:', customer.serial_number);
                }
            } catch (genieError) {
                console.error('[getCustomerDetail] Error fetching GenieACS data:', genieError);
            }
        } else {
            console.log('[getCustomerDetail] No serial number found for customer');
        }

        console.log('[getCustomerDetail] Rendering template with deviceDetails:', deviceDetails ? 'PRESENT' : 'NULL');

        res.render('customers/detail', {
            title: `Detail Pelanggan - ${customer.name}`,
            customer: {
                ...customer,
                pppoe_package: customer.connection_type === 'pppoe' ? packageData : null,
                static_ip_package: customer.connection_type === 'static_ip' ? packageData : null
            },
            invoices: invoices || [],
            deviceDetails,
            currentPath: `/customers/${customerId}`
        });

    } catch (error: unknown) {
        console.error('Error fetching customer detail:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memuat detail pelanggan';
        res.status(500).render('error', {
            title: 'Error',
            message: errorMessage
        });
    }
};

/**
 * Get customer edit page
 */
export const getCustomerEdit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID is required' });
        }
        const customerId = parseInt(id);
        console.log(`[getCustomerEdit] Attempting to find customer. Requested ID: "${id}", Parsed: ${customerId}`);

        if (!customerId || isNaN(customerId)) {
            console.warn(`[getCustomerEdit] Invalid customer ID: "${id}"`);
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: `Pelanggan tidak ditemukan (ID: ${id})`
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
                END as package_id,
                olt.name as olt_name,
                odc.name as odc_name,
                odp.name as odp_name
            FROM customers c
            LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
            LEFT JOIN subscriptions s ON c.id = s.customer_id AND c.connection_type = 'pppoe' AND s.status = 'active'
            LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
            LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
            LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
            WHERE c.id = ?
            LIMIT 1
        `;

        const [customers] = await databasePool.query<RowDataPacket[]>(query, [customerId]);
        console.log(`[getCustomerEdit] Query executed for ID ${customerId}. Found ${customers.length} rows.`);

        if (!customers || customers.length === 0) {
            console.warn(`[getCustomerEdit] Customer with ID ${customerId} not found in database.`);
            return res.status(404).render('error', {
                title: 'Not Found',
                status: 404,
                message: `Pelanggan tidak ditemukan (ID: ${customerId})`
            });
        }

        const customer = customers[0];

        // Get packages based on connection type
        let packages: any[] = [];
        try {
            if (customer.connection_type === 'pppoe') {
                packages = await listPppoePackages();
                console.log(`[CustomerEdit] Loaded ${packages.length} PPPoE packages for customer ${customerId}`);
            } else if (customer.connection_type === 'static_ip') {
                packages = await listStaticIpPackages();
                console.log(`[CustomerEdit] Loaded ${packages.length} Static IP packages for customer ${customerId}`);
                console.log(`[CustomerEdit] Customer package_id: ${customer.package_id}, static_ip_package_id: ${customer.static_ip_package_id}`);
            }
        } catch (packageError) {
            console.error('[CustomerEdit] Error fetching packages:', packageError);
            packages = [];
        }

        // Get MikroTik interfaces with timeout
        let interfaces: any[] = [];
        let interfaceError: string | null = null;
        try {
            const mikrotikConfig = await getMikrotikConfig();
            if (mikrotikConfig) {
                const configWithTls: { host: string; port: number; username: string; password: string; use_tls: boolean } = {
                    ...mikrotikConfig,
                    use_tls: mikrotikConfig.use_tls ?? false
                };

                // Add timeout to interface fetching (3 seconds)
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('MikroTik connection timeout')), 3000)
                );

                interfaces = await Promise.race([
                    getInterfaces(configWithTls),
                    timeoutPromise
                ]) as any[];
            } else {
                interfaceError = 'MikroTik tidak dikonfigurasi';
            }
        } catch (interfaceErr) {
            console.error('Error fetching interfaces:', interfaceErr);
            interfaceError = interfaceErr instanceof Error ? interfaceErr.message : 'Gagal memuat interface';
            interfaces = [];
        }

        // Get ODP data
        // Optimization: Do NOT fetch all ODPs. Logic has moved to AJAX Search.
        let odpData: any[] = [];

        // Get customer with password field for view (password is already in customer object from first query)
        const customerForView = customer;

        res.render('customers/edit', {
            title: `Edit Pelanggan - ${customer.name}`,
            customer: customerForView,
            packages: packages && Array.isArray(packages) ? packages : [],
            interfaces: interfaces && Array.isArray(interfaces) ? interfaces : [],
            interfaceError: interfaceError || null,
            odpData: odpData && Array.isArray(odpData) ? odpData : [],
            currentPath: `/customers/${customerId}/edit`
        });

    } catch (error: unknown) {
        console.error('Error fetching customer for edit:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data pelanggan';
        res.status(500).render('error', {
            title: 'Error',
            message: errorMessage
        });
    }
};

/**
 * Update customer
 */
export const updateCustomer = async (req: Request, res: Response) => {
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

        const {
            name,
            customer_code,
            phone,
            email,
            address,
            status,
            connection_type,
            pppoe_username,
            pppoe_password,
            pppoe_profile_id,
            pppoe_package,
            ip_address,
            interface: interfaceName,
            static_ip_package,
            odp_id,
            odc_id,
            custom_payment_deadline,
            custom_isolate_days_after_deadline,
            serial_number,
            rental_mode,
            rental_cost
        } = req.body;

        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            // Check if customer exists and get old data
            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, pppoe_username, connection_type, pppoe_password, serial_number FROM customers WHERE id = ?',
                [customerId]
            );

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
            const updateFields: string[] = [];
            const updateValues: any[] = [];

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
            if (serial_number !== undefined) {
                updateFields.push('serial_number = ?');
                updateValues.push(serial_number || null);
            }

            // Handle PPN Taxable flag
            // Checkbox behavior: sent as '1' if checked, missing if unchecked
            // We only update if billing_mode is also present (implying a form submission or full update)
            if (req.body.billing_mode !== undefined) {
                if (req.body.is_taxable) {
                    updateFields.push('is_taxable = ?');
                    updateValues.push(1);
                } else {
                    updateFields.push('is_taxable = ?');
                    updateValues.push(0);
                }
            } else if (req.body.is_taxable !== undefined) {
                // Partial update explicitly targeting this field
                updateFields.push('is_taxable = ?');
                updateValues.push(req.body.is_taxable === '1' || req.body.is_taxable === true ? 1 : 0);
            }

            // Handle custom deadline fields
            if (custom_payment_deadline !== undefined && custom_payment_deadline !== '') {
                const deadline = parseInt(custom_payment_deadline);
                if (deadline >= 1 && deadline <= 31) {
                    updateFields.push('custom_payment_deadline = ?');
                    updateValues.push(deadline);
                } else {
                    updateFields.push('custom_payment_deadline = NULL');
                }
            } else if (custom_payment_deadline === '') {
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

            // Handle Device Rental flag
            // Checkbox behavior: sent as '1' if checked, missing if unchecked
            // We only update if billing_mode is also present (implying a form submission or full update)
            if (req.body.billing_mode !== undefined) {
                if (req.body.use_device_rental) {
                    updateFields.push('use_device_rental = ?');
                    updateValues.push(1);
                } else {
                    updateFields.push('use_device_rental = ?');
                    updateValues.push(0);
                }
            } else if (req.body.use_device_rental !== undefined) {
                // Partial update explicitly targeting this field
                updateFields.push('use_device_rental = ?');
                updateValues.push(req.body.use_device_rental === '1' || req.body.use_device_rental === true ? 1 : 0);
            }

            // Handle Rental Mode and Cost
            if (rental_mode !== undefined) {
                updateFields.push('rental_mode = ?');
                updateValues.push(rental_mode);
            }
            if (rental_cost !== undefined) {
                // If empty screen, set to null. If value provided, ensure numeric.
                let costVal = null;
                if (rental_cost !== null && rental_cost !== '') {
                    costVal = parseFloat(String(rental_cost).replace(/[^0-9.]/g, ''));
                }
                updateFields.push('rental_cost = ?');
                updateValues.push(costVal);
            }

            // Handle billing mode change (Prepaid/Postpaid)
            const { billing_mode, prepaid_bonus_days } = req.body;
            let billingModeChanged = false;
            let oldBillingMode = null;

            if (billing_mode !== undefined) {
                // Get current billing mode
                const [currentCustomer] = await conn.query<RowDataPacket[]>(
                    'SELECT billing_mode FROM customers WHERE id = ?',
                    [customerId]
                );

                if (currentCustomer && currentCustomer.length > 0) {
                    oldBillingMode = currentCustomer[0].billing_mode || 'postpaid';

                    if (oldBillingMode !== billing_mode) {
                        billingModeChanged = true;
                        updateFields.push('billing_mode = ?');
                        updateValues.push(billing_mode);

                        // If switching to prepaid, we'll need to set expiry date after update
                        // If switching to postpaid, clear expiry date
                        if (billing_mode === 'postpaid') {
                            updateFields.push('expiry_date = NULL');
                        }
                    }
                }
            }



            if (updateFields.length > 0) {
                updateValues.push(customerId);
                await conn.query(
                    `UPDATE customers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                    updateValues
                );
            }

            // Sync with GenieACS logic
            const targetSerial = serial_number || oldCustomer.serial_number;
            const targetName = name || oldName;
            const targetPppoe = pppoe_username || oldPppoeUsername;

            if (targetSerial || targetPppoe) {
                // Execute async without waiting to speed up response
                (async () => {
                    try {
                        const genieacs = await GenieacsService.getInstanceFromDb();
                        let device = null;

                        // 1. Try match by Serial
                        if (targetSerial) {
                            const devices = await genieacs.getDevices(1, 0, ['_id', '_tags'], { "_deviceId._SerialNumber": targetSerial });
                            if (devices && devices.length > 0) device = devices[0];
                        }

                        // 2. Try match by PPPoE if no serial match
                        if (!device && targetPppoe) {
                            // This is a bit heavier as we search by pppoeUsername virtual parameter or standard path
                            const devices = await genieacs.getDevices(1, 0, ['_id', '_tags'], {
                                $or: [
                                    { "VirtualParameters.pppoeUsername": targetPppoe },
                                    { "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": targetPppoe }
                                ]
                            });
                            if (devices && devices.length > 0) device = devices[0];
                        }

                        if (device) {
                            const deviceId = device._id;
                            const tagName = targetName.replace(/[^a-zA-Z0-9.\s_-]/g, '').trim();

                            console.log(`[GenieACS] Found device for sync, tagging: ${tagName}`);
                            await genieacs.addDeviceTag(deviceId, tagName);
                        }
                    } catch (err) {
                        console.error('[GenieACS] Sync on update failed:', err);
                    }
                })();
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
                await conn.query(
                    `UPDATE customers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                    updateValues
                );
            }

            // ========== UPDATE SUBSCRIPTION KETIKA PAKET DIUBAH ==========
            // Handle package update for PPPoE customers
            if (connection_type === 'pppoe' && pppoe_package) {
                const packageId = parseInt(pppoe_package);
                if (!isNaN(packageId) && packageId > 0) {
                    console.log(`[Edit Customer] Updating subscription for customer ${customerId} to package ${packageId}`);

                    // Get package details
                    const [packageRows] = await conn.query<RowDataPacket[]>(
                        'SELECT id, name, price FROM pppoe_packages WHERE id = ?',
                        [packageId]
                    );

                    if (packageRows && packageRows.length > 0) {
                        const pkg = packageRows[0];

                        // Check if subscription exists
                        const [existingSubs] = await conn.query<RowDataPacket[]>(
                            'SELECT id FROM subscriptions WHERE customer_id = ? AND status = "active"',
                            [customerId]
                        );

                        if (existingSubs && existingSubs.length > 0) {
                            // Update existing subscription
                            await conn.query(
                                `UPDATE subscriptions 
                                 SET package_id = ?, package_name = ?, price = ?, updated_at = NOW() 
                                 WHERE customer_id = ? AND status = 'active'`,
                                [pkg?.id, pkg?.name, pkg?.price, customerId]
                            );
                            console.log(`[Edit Customer] ✅ Subscription updated to package: ${pkg?.name}`);
                        } else {
                            // Create new subscription
                            await conn.query(
                                `INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), NOW())`,
                                [customerId, pkg?.id, pkg?.name, pkg?.price]
                            );
                            console.log(`[Edit Customer] ✅ New subscription created with package: ${pkg?.name}`);
                        }
                    } else {
                        console.log(`[Edit Customer] ⚠️ Package ID ${packageId} not found in pppoe_packages`);
                    }
                }
            }

            await conn.commit();

            // Handle prepaid mode switch AFTER commit
            if (billingModeChanged && billing_mode === 'prepaid') {
                try {
                    const { PrepaidService } = await import('../services/billing/PrepaidService');
                    const bonusDays = prepaid_bonus_days ? parseInt(prepaid_bonus_days) : 1;

                    const result = await PrepaidService.switchToPrepaid(
                        customerId,
                        bonusDays,
                        true // Send WhatsAppnotification
                    );

                    if (result.success) {
                        console.log(`✅ Customer ${customerId} switched to prepaid mode successfully`);
                    } else {
                        console.error(`⚠️ Failed to switch customer ${customerId} to prepaid:`, result.message);
                    }
                } catch (prepaidError) {
                    console.error('Error switching to prepaid:', prepaidError);
                    // Don't fail the whole update - customer is still updated
                }
            }


            // Handle status change (Enable/Disable) side effects
            if (status !== undefined && status !== oldCustomer.status) {
                console.log(`[UpdateCustomer] Status changed from ${oldCustomer.status} to ${status} for customer ${customerId}`);

                try {
                    const isDisabling = status === 'inactive';
                    const activeConnType = connection_type || oldCustomer.connection_type;
                    const activeUsername = pppoe_username || oldPppoeUsername;

                    // 1. Sync to MikroTik
                    const { getMikrotikConfig } = await import('../services/pppoeService');
                    // We need raw API for disable/enable for now if service function unavailable
                    const { RouterOSAPI } = await import('node-routeros');

                    const config = await getMikrotikConfig();
                    if (config) {
                        const api = new RouterOSAPI({
                            host: config.host,
                            port: config.port,
                            user: config.username,
                            password: config.password,
                            timeout: 10000
                        });

                        await api.connect();

                        try {
                            if (activeConnType === 'pppoe' && activeUsername) {
                                // Find secret
                                const secrets = await api.write('/ppp/secret/print', [`?name=${activeUsername}`]);
                                if (secrets && secrets.length > 0) {
                                    const secretId = secrets[0]['.id'];
                                    await api.write('/ppp/secret/set', [
                                        `=.id=${secretId}`,
                                        `=disabled=${isDisabling ? 'yes' : 'no'}`
                                    ]);

                                    // Also kick active connection if disabling
                                    if (isDisabling) {
                                        const active = await api.write('/ppp/active/print', [`?name=${activeUsername}`]);
                                        if (active && active.length > 0) {
                                            const activeId = active[0]['.id'];
                                            await api.write('/ppp/active/remove', [`=.id=${activeId}`]);
                                        }
                                    }
                                    console.log(`[UpdateCustomer] PPPoE secret ${activeUsername} ${isDisabling ? 'disabled' : 'enabled'}`);
                                }
                            } else if (activeConnType === 'static_ip') {

                                // For Static IP, we disable the Simple Queue to block bandwidth
                                // Getting IP/Name to find queue
                                const [staticClient] = await databasePool.query<RowDataPacket[]>(
                                    "SELECT client_name FROM static_ip_clients WHERE customer_id = ?",
                                    [customerId]
                                );

                                if (staticClient && staticClient.length > 0 && staticClient[0].client_name) {
                                    const clientName = staticClient[0].client_name;
                                    const queues = await api.write('/queue/simple/print', [`?name=${clientName}`]);
                                    if (queues && queues.length > 0) {
                                        const queueId = queues[0]['.id'];
                                        await api.write('/queue/simple/set', [
                                            `=.id=${queueId}`,
                                            `=disabled=${isDisabling ? 'yes' : 'no'}`
                                        ]);
                                        console.log(`[UpdateCustomer] Static Queue ${clientName} ${isDisabling ? 'disabled' : 'enabled'}`);
                                    }
                                }
                            }
                        } finally {
                            await api.close();
                        }
                    }

                    // 2. Send Notification
                    if (phone) {
                        const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
                        await UnifiedNotificationService.queueNotification({
                            customer_id: customerId,
                            notification_type: isDisabling ? 'service_suspended' : 'service_restored',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: name || oldName,
                                reason: isDisabling ? 'Status pelanggan dinonaktifkan (Disable Mode)' : 'Status pelanggan diaktifkan kembali'
                            },
                            priority: 'high'
                        });
                        // Trigger send immediately
                        try {
                            await UnifiedNotificationService.sendPendingNotifications(5);
                        } catch (e) { /* ignore */ }
                    }

                } catch (statusError) {
                    console.error('[UpdateCustomer] Error handling status change side-effects:', statusError);
                    // Don't fail the request, just log
                }
            }

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
                    const { getMikrotikConfig } = await import('../services/pppoeService');
                    const { findPppoeSecretIdByName, updatePppoeSecret, createPppoeSecret } = await import('../services/mikrotikService');

                    const config = await getMikrotikConfig();
                    if (config && newName) {
                        const oldSecretUsername = oldPppoeUsername || '';

                        // Get profile name from package if package is selected
                        let profileName: string | undefined = undefined;

                        // First, try to get profile from package (priority)
                        // Check both pppoe_package from form and existing package_id from customer
                        const packageIdToUse = pppoe_package || (oldCustomer as any).package_id || (oldCustomer as any).pppoe_package_id;
                        // Validate packageIdToUse: must be a valid number (not empty string, not null, not undefined, not NaN)
                        const packageIdNum = packageIdToUse ? Number(packageIdToUse) : null;
                        if (packageIdToUse && packageIdNum && !isNaN(packageIdNum) && packageIdNum > 0) {
                            try {
                                const { getPackageById, getProfileById } = await import('../services/pppoeService');
                                const packageData = await getPackageById(packageIdNum);
                                console.log(`[Edit Customer PPPoE] Package data untuk ID ${packageIdNum}:`, packageData ? 'Ditemukan' : 'Tidak ditemukan');
                                if (packageData && packageData.profile_id) {
                                    const profileIdNum = Number(packageData.profile_id);
                                    if (!isNaN(profileIdNum) && profileIdNum > 0) {
                                        const profile = await getProfileById(profileIdNum);
                                        if (profile) {
                                            profileName = profile.name;
                                            console.log(`[Edit Customer PPPoE] ✅ Profile dari paket (ID: ${packageIdNum}): ${profileName}`);
                                        } else {
                                            console.log(`[Edit Customer PPPoE] ⚠️ Profile dengan ID ${profileIdNum} tidak ditemukan`);
                                        }
                                    } else {
                                        console.log(`[Edit Customer PPPoE] ⚠️ Paket (ID: ${packageIdNum}) memiliki profile_id yang tidak valid: ${packageData.profile_id}`);
                                    }
                                } else {
                                    console.log(`[Edit Customer PPPoE] ⚠️ Paket (ID: ${packageIdNum}) tidak memiliki profile_id`);
                                }
                            } catch (packageError) {
                                console.error('⚠️ Gagal mendapatkan profile dari paket:', packageError);
                            }
                        } else {
                            console.log(`[Edit Customer PPPoE] ⚠️ Tidak ada paket yang dipilih (pppoe_package: ${pppoe_package}, existing package_id: ${(oldCustomer as any).package_id})`);
                        }

                        // Fallback: Get profile name if profile_id is provided directly
                        if (!profileName && pppoe_profile_id) {
                            try {
                                const profileIdNum = Number(pppoe_profile_id);
                                if (!isNaN(profileIdNum) && profileIdNum > 0) {
                                    const { getProfileById } = await import('../services/pppoeService');
                                    const profile = await getProfileById(profileIdNum);
                                    if (profile) {
                                        profileName = profile.name;
                                        console.log(`[Edit Customer PPPoE] Profile dari profile_id (${profileIdNum}): ${profileName}`);
                                    }
                                } else {
                                    console.log(`[Edit Customer PPPoE] ⚠️ profile_id yang tidak valid: ${pppoe_profile_id}`);
                                }
                            } catch (profileError) {
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
                        } else if (oldPppoeUsername && oldPppoeUsername.trim()) {
                            newUsername = oldPppoeUsername.trim();
                            console.log(`[Edit Customer PPPoE] ⚠️ Username dari form kosong, menggunakan username lama dari DB: "${newUsername}"`);
                        } else {
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
                            } catch (findNewError: any) {
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
                            } catch (findError: any) {
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
                            } catch (findCustomerIdError: any) {
                                // Ignore error
                                console.log(`[Edit Customer PPPoE] ℹ️ Secret tidak ditemukan dengan Customer ID: ${customerIdStr}`);
                            }
                        }

                        // Determine password to use: new password if provided (and not empty), otherwise use old password
                        // IMPORTANT: Do NOT auto-generate random passwords - this was causing customer passwords to change unexpectedly
                        let passwordToUse: string = '';
                        if (pppoe_password && pppoe_password.trim() !== '') {
                            // Password baru diisi, gunakan password baru
                            passwordToUse = pppoe_password.trim();
                            console.log(`[Edit Customer PPPoE] ✅ Menggunakan password baru dari form`);
                        } else if (oldPppoePassword && oldPppoePassword.trim() !== '') {
                            // Password tidak diisi, tapi ada password lama, gunakan password lama
                            passwordToUse = oldPppoePassword;
                            console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, menggunakan password lama`);
                        } else {
                            // Tidak ada password baru dan tidak ada password lama
                            // JANGAN generate password random - ini menyebabkan password pelanggan berubah tanpa sepengetahuan mereka
                            console.warn(`[Edit Customer PPPoE] ⚠️ Tidak ada password tersedia. Secret MikroTik TIDAK akan dibuat.`);
                            console.warn(`[Edit Customer PPPoE] 💡 Silakan isi password PPPoE secara manual untuk membuat secret di MikroTik.`);
                        }

                        if (existingSecretId || existingSecretByNewUsername || existingSecretByCustomerId) {
                            // If secret found with customer ID (legacy), we need to delete and recreate with username
                            if (secretFoundBy === 'customer_id' && customerId && !isNaN(customerId)) {
                                console.log(`[Edit Customer PPPoE] ⚠️ Secret ditemukan dengan Customer ID (legacy), akan dihapus dan dibuat ulang dengan username`);
                                const { deletePppoeSecret } = await import('../services/mikrotikService');

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
                                    await conn.query(
                                        'UPDATE customers SET pppoe_username = ? WHERE id = ?',
                                        [newUsername, customerId]
                                    );
                                    console.log(`[Edit Customer PPPoE] ✅ Username di database di-update ke: ${newUsername}`);
                                }
                            } else {
                                // Update existing secret with username (normal update)
                                const updateData: any = {
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
                                } else {
                                    console.log(`[Edit Customer PPPoE] Profile tidak di-update (tidak ada profile dari paket)`);
                                }

                                // Determine which identifier to use for updating
                                let secretToUpdate: string;
                                if (existingSecretByNewUsername) {
                                    secretToUpdate = newUsername;
                                } else if (existingSecretId) {
                                    secretToUpdate = oldSecretUsername;
                                } else {
                                    secretToUpdate = newUsername || oldSecretUsername;
                                }

                                console.log(`[Edit Customer PPPoE] Secret ditemukan dengan identifier: ${secretFoundBy}, akan di-update: ${secretToUpdate}`);

                                // Update secret di MikroTik - use existing secret identifier
                                await updatePppoeSecret(config, secretToUpdate, updateData);
                            }

                            // Update username di database dengan username baru
                            if (newUsername && newUsername !== oldSecretUsername) {
                                await conn.query(
                                    'UPDATE customers SET pppoe_username = ? WHERE id = ?',
                                    [newUsername, customerId]
                                );
                            }

                            // Update password di database hanya jika password baru diisi (jika kosong, tetap gunakan password lama)
                            if (pppoe_password && pppoe_password.trim() !== '') {
                                // Password baru diisi, update ke database
                                await conn.query(
                                    'UPDATE customers SET pppoe_password = ? WHERE id = ?',
                                    [passwordToUse, customerId]
                                );
                                console.log(`[Edit Customer PPPoE] ✅ Password baru di-update di database (${passwordToUse.length} characters)`);
                            } else {
                                // Password tidak diisi, tidak perlu update (tetap menggunakan password lama)
                                console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, tetap menggunakan password yang ada`);
                            }

                            console.log(`✅ PPPoE secret dengan username "${secretName}" berhasil di-update di MikroTik`);
                        } else {
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
                                    await conn.query(
                                        'UPDATE customers SET pppoe_username = ? WHERE id = ?',
                                        [newUsername, customerId]
                                    );
                                }

                                // Update password di database hanya jika password baru diisi atau auto-generated (jika customer belum punya password)
                                if (pppoe_password && pppoe_password.trim() !== '') {
                                    // Password baru diisi, update ke database
                                    await conn.query(
                                        'UPDATE customers SET pppoe_password = ? WHERE id = ?',
                                        [passwordToUse, customerId]
                                    );
                                    console.log(`[Edit Customer PPPoE] ✅ Password baru di-update di database (${passwordToUse.length} characters)`);
                                } else if (!oldPppoePassword) {
                                    // Tidak ada password lama dan tidak ada password baru, simpan password yang di-generate
                                    await conn.query(
                                        'UPDATE customers SET pppoe_password = ? WHERE id = ?',
                                        [passwordToUse, customerId]
                                    );
                                    console.log(`[Edit Customer PPPoE] ✅ Password auto-generated disimpan di database (${passwordToUse.length} characters)`);
                                } else {
                                    // Password tidak diisi dan ada password lama, tidak perlu update (tetap menggunakan password lama)
                                    console.log(`[Edit Customer PPPoE] ℹ️ Password tidak diubah, tetap menggunakan password yang ada`);
                                }

                                console.log(`✅ PPPoE secret dengan username "${secretName}" berhasil dibuat di MikroTik`);
                            } else {
                                console.error(`❌ Password atau username tidak tersedia, tidak bisa membuat secret baru`);
                                console.error(`   💡 Saran: Isi username dan password saat edit pelanggan untuk membuat secret di MikroTik`);
                                console.error(`   📋 Detail: Customer ID: ${customerId}, Name: ${newName}, Username: ${secretName || 'N/A'}`);
                                // Don't throw error, just log it - customer update can still succeed
                            }
                        }
                    }
                } catch (mikrotikError: any) {
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

            // Handle Static IP specific updates
            if (connection_type || oldCustomer.connection_type === 'static_ip') {
                const targetConnType = connection_type || oldCustomer.connection_type;
                if (targetConnType === 'static_ip') {
                    try {
                        const [staticClient] = await conn.query<RowDataPacket[]>('SELECT id FROM static_ip_clients WHERE customer_id = ?', [customerId]);

                        const staticIpUpdates: string[] = [];
                        const staticIpValues: any[] = [];

                        if (ip_address) { staticIpUpdates.push('ip_address = ?'); staticIpValues.push(ip_address); }
                        if (interfaceName) { staticIpUpdates.push('interface = ?'); staticIpValues.push(interfaceName); }
                        if (static_ip_package) { staticIpUpdates.push('package_id = ?'); staticIpValues.push(static_ip_package); }

                        if (staticIpUpdates.length > 0) {
                            if (staticClient && staticClient.length > 0) {
                                staticIpValues.push(staticClient[0].id);
                                await conn.query(`UPDATE static_ip_clients SET ${staticIpUpdates.join(', ')}, updated_at = NOW() WHERE id = ?`, staticIpValues);
                                console.log(`[UpdateCustomer] Updated static_ip_clients for customer ${customerId}`);
                            }
                        }
                    } catch (staticIpError) {
                        console.error('[UpdateCustomer] Error updating static IP data:', staticIpError);
                    }
                }
            }

            console.log('[updateCustomer] Update successful, redirecting to:', `/customers/${customerId}?success=updated`);
            req.flash('success', 'Data pelanggan berhasil diperbarui');
            res.redirect(`/customers/${customerId}?success=updated`);
        } catch (error: unknown) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error: unknown) {
        console.error('Error updating customer:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui data pelanggan';
        req.flash('error', errorMessage);
        res.redirect(`/customers/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`);
    }
};

/**
 * Delete customer
 */
export const deleteCustomer = async (req: Request, res: Response) => {
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

        const conn = await databasePool.getConnection();
        try {
            // Check if customer exists and get full data for MikroTik cleanup and notification
            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, customer_code, phone, connection_type, pppoe_username FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customers || customers.length === 0) {
                console.warn(`[deleteCustomer] Customer with ID ${customerId} not found for deletion.`);
                return res.status(404).json({
                    success: false,
                    error: `Pelanggan tidak ditemukan (ID: ${customerId})`
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
                        const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
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
                        } catch (queueError: any) {
                            console.warn(`[DeleteCustomer] ⚠️ Queue processing error (non-critical):`, queueError.message);
                            // Non-critical, notification is already queued
                        }
                    } catch (queueNotifError: any) {
                        console.error(`[DeleteCustomer] ⚠️ Failed to queue notification (non-critical, continuing deletion):`, queueNotifError.message);
                        // Continue with deletion even if notification queue fails
                    }
                } else {
                    console.log(`⚠️ No phone number for customer ${customerId} (${customer.name}), skipping notification`);
                }
            } catch (notifError: any) {
                console.error(`❌ Failed to send deletion notification for customer ${customerId} (non-critical, continuing deletion):`, notifError.message);
                // Continue with deletion even if notification fails - this is non-critical
            }

            // Delete from MikroTik based on connection type
            try {
                const { getMikrotikConfig } = await import('../services/pppoeService');
                const {
                    deletePppoeSecret,
                    removeIpAddress,
                    removeMangleRulesForClient,
                    deleteClientQueuesByClientName
                } = await import('../services/mikrotikService');

                const config = await getMikrotikConfig();

                if (config) {
                    if (customer.connection_type === 'pppoe') {
                        // Delete PPPoE secret from MikroTik
                        if (customer.pppoe_username) {
                            try {
                                await deletePppoeSecret(config, customer.pppoe_username);
                                console.log(`✅ PPPoE secret "${customer.pppoe_username}" berhasil dihapus dari MikroTik`);
                            } catch (mikrotikError: any) {
                                console.error(`⚠️ Gagal menghapus PPPoE secret dari MikroTik:`, mikrotikError.message);
                                // Continue deletion even if MikroTik deletion fails
                            }
                        }
                    } else if (customer.connection_type === 'static_ip') {
                        // Get static IP client data
                        const [staticIpClients] = await conn.query<RowDataPacket[]>(
                            'SELECT id, client_name, ip_address, interface FROM static_ip_clients WHERE customer_id = ?',
                            [customerId]
                        );

                        if (staticIpClients && staticIpClients.length > 0) {
                            const staticIpClient = staticIpClients[0]!;

                            try {
                                // Delete IP address from MikroTik
                                if (staticIpClient.ip_address) {
                                    await removeIpAddress(config, staticIpClient.ip_address);
                                    console.log(`✅ IP address "${staticIpClient.ip_address}" berhasil dihapus dari MikroTik`);
                                }

                                // Calculate peer IP and marks for mangle deletion
                                const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');

                                if (staticIpClient.ip_address) {
                                    const [ipOnlyRaw, prefixStrRaw] = String(staticIpClient.ip_address || '').split('/');
                                    const ipOnly: string = ipOnlyRaw || '';
                                    const prefix: number = Number(prefixStrRaw || '0');
                                    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
                                    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
                                    let peerIp = ipOnly;

                                    if (prefix === 30) {
                                        const firstHost = networkInt + 1;
                                        const secondHost = networkInt + 2;
                                        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
                                        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
                                    }

                                    const downloadMark: string = peerIp;
                                    const uploadMark: string = `UP-${peerIp}`;

                                    // Delete firewall mangle rules
                                    await removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
                                    console.log(`✅ Firewall mangle rules untuk "${peerIp}" berhasil dihapus dari MikroTik`);

                                    // Delete queue trees
                                    if (staticIpClient.client_name) {
                                        await deleteClientQueuesByClientName(config, staticIpClient.client_name);
                                        console.log(`✅ Queue trees untuk "${staticIpClient.client_name}" berhasil dihapus dari MikroTik`);
                                    }
                                }
                            } catch (mikrotikError: any) {
                                console.error(`⚠️ Gagal menghapus static IP resources dari MikroTik:`, mikrotikError.message);
                                // Continue deletion even if MikroTik deletion fails
                            }
                        }
                    }
                }
            } catch (mikrotikError: any) {
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
        } finally {
            conn.release();
        }
    } catch (error: unknown) {
        console.error('Error deleting customer:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal menghapus pelanggan';

        // Ensure JSON response - check if response already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage
            });
        } else {
            console.error('Response already sent, cannot send error response');
        }
    }
};

/**
 * Bulk delete customers
 */
export const bulkDeleteCustomers = async (req: Request, res: Response) => {
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

        const deleted: number[] = [];
        const skipped: number[] = [];
        const errors: { id: number; error: string }[] = [];

        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            for (const customerId of customerIds) {
                try {
                    // Check if customer exists and get full data for MikroTik cleanup and notification
                    const [customers] = await conn.query<RowDataPacket[]>(
                        'SELECT id, name, customer_code, phone, connection_type, pppoe_username FROM customers WHERE id = ?',
                        [customerId]
                    );

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
                                const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
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
                                } catch (queueError: any) {
                                    console.warn(`[BulkDelete] ⚠️ Queue processing error (non-critical):`, queueError.message);
                                    // Non-critical, notification is already queued
                                }
                            } catch (queueNotifError: any) {
                                console.error(`[BulkDelete] ⚠️ Failed to queue notification (non-critical, continuing deletion):`, queueNotifError.message);
                                // Continue with deletion even if notification queue fails
                            }
                        } else {
                            console.log(`⚠️ No phone number for customer ${customerId} (${customer.name}), skipping notification`);
                        }
                    } catch (notifError: any) {
                        console.error(`❌ Failed to send deletion notification for customer ${customerId} (non-critical, continuing deletion):`, notifError.message);
                        // Continue with deletion even if notification fails - this is non-critical
                    }

                    // Delete from MikroTik based on connection type
                    try {
                        const { getMikrotikConfig } = await import('../services/pppoeService');
                        const {
                            deletePppoeSecret,
                            removeIpAddress,
                            removeMangleRulesForClient,
                            deleteClientQueuesByClientName
                        } = await import('../services/mikrotikService');

                        const config = await getMikrotikConfig();

                        if (config) {
                            if (customer.connection_type === 'pppoe') {
                                // Delete PPPoE secret from MikroTik
                                if (customer.pppoe_username) {
                                    try {
                                        await deletePppoeSecret(config, customer.pppoe_username);
                                        console.log(`✅ PPPoE secret "${customer.pppoe_username}" berhasil dihapus dari MikroTik`);
                                    } catch (mikrotikError: any) {
                                        console.error(`⚠️ Gagal menghapus PPPoE secret dari MikroTik:`, mikrotikError.message);
                                        // Continue deletion even if MikroTik deletion fails
                                    }
                                }
                            } else if (customer.connection_type === 'static_ip') {
                                // Get static IP client data
                                const [staticIpClients] = await conn.query<RowDataPacket[]>(
                                    'SELECT id, client_name, ip_address, interface FROM static_ip_clients WHERE customer_id = ?',
                                    [customerId]
                                );

                                if (staticIpClients && staticIpClients.length > 0) {
                                    const staticIpClient = staticIpClients[0]!;

                                    try {
                                        // Delete IP address from MikroTik
                                        if (staticIpClient.ip_address) {
                                            await removeIpAddress(config, staticIpClient.ip_address);
                                            console.log(`✅ IP address "${staticIpClient.ip_address}" berhasil dihapus dari MikroTik`);
                                        }

                                        // Calculate peer IP and marks for mangle deletion
                                        const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                        const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');

                                        if (staticIpClient.ip_address) {
                                            const [ipOnlyRaw, prefixStrRaw] = String(staticIpClient.ip_address || '').split('/');
                                            const ipOnly: string = ipOnlyRaw || '';
                                            const prefix: number = Number(prefixStrRaw || '0');
                                            const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
                                            const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
                                            let peerIp = ipOnly;

                                            if (prefix === 30) {
                                                const firstHost = networkInt + 1;
                                                const secondHost = networkInt + 2;
                                                const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
                                                peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
                                            }

                                            const downloadMark: string = peerIp;
                                            const uploadMark: string = `UP-${peerIp}`;

                                            // Delete firewall mangle rules
                                            await removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
                                            console.log(`✅ Firewall mangle rules untuk "${peerIp}" berhasil dihapus dari MikroTik`);

                                            // Delete queue trees
                                            if (staticIpClient.client_name) {
                                                await deleteClientQueuesByClientName(config, staticIpClient.client_name);
                                                console.log(`✅ Queue trees untuk "${staticIpClient.client_name}" berhasil dihapus dari MikroTik`);
                                            }
                                        }
                                    } catch (mikrotikError: any) {
                                        console.error(`⚠️ Gagal menghapus static IP resources dari MikroTik:`, mikrotikError.message);
                                        // Continue deletion even if MikroTik deletion fails
                                    }
                                }
                            }
                        }
                    } catch (mikrotikError: any) {
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
                } catch (error: any) {
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
        } catch (error: any) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error: unknown) {
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

/**
 * Toggle customer status (Active/Inactive)
 */
export const toggleCustomerStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' or 'inactive'

        if (!id) return res.status(400).json({ success: false, error: 'ID is required' });
        if (!status || (status !== 'active' && status !== 'inactive')) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const customerId = parseInt(id);
        const conn = await databasePool.getConnection();

        try {
            await conn.beginTransaction();

            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, connection_type, pppoe_username, status FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customers || customers.length === 0) {
                await conn.rollback();
                return res.status(404).json({ success: false, error: 'Customer not found' });
            }

            const customer = customers[0];

            if (customer.status === status) {
                await conn.rollback();
                return res.json({ success: true, message: 'Status already ' + status });
            }

            await conn.query(
                'UPDATE customers SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, customerId]
            );

            // Conditional subscription update
            if (status === 'active') {
                // Only set to active if previously suspended
                await conn.query(
                    'UPDATE subscriptions SET status = "active", updated_at = NOW() WHERE customer_id = ? AND status = "suspended"',
                    [customerId]
                );
            } else {
                // If deactivating customer, suspend active subscription
                await conn.query(
                    'UPDATE subscriptions SET status = "suspended", updated_at = NOW() WHERE customer_id = ? AND status = "active"',
                    [customerId]
                );
            }

            // Sync to Mikrotik
            if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                try {
                    const config = await getMikrotikConfig();

                    if (config) {
                        const { RouterOSAPI } = require('routeros-api');
                        const api = new RouterOSAPI({
                            host: config.host,
                            port: config.port,
                            user: config.username,
                            password: config.password,
                            timeout: 5000
                        });

                        await api.connect();

                        const secrets = await api.write('/ppp/secret/print', [`?name=${customer.pppoe_username}`]);

                        if (Array.isArray(secrets) && secrets.length > 0) {
                            const secretId = secrets[0]['.id'];
                            const isDisabled = status === 'inactive';

                            await api.write('/ppp/secret/set', [
                                `.id=${secretId}`,
                                `disabled=${isDisabled ? 'yes' : 'no'}`
                            ]);

                            if (isDisabled) {
                                const activeConns = await api.write('/ppp/active/print', [`?name=${customer.pppoe_username}`]);
                                if (Array.isArray(activeConns)) {
                                    for (const conn of activeConns) {
                                        await api.write('/ppp/active/remove', [`.id=${conn['.id']}`]);
                                    }
                                }
                            }
                        }

                        api.close();
                    }
                } catch (mikrotikError) {
                    console.error('Failed to sync status to Mikrotik:', mikrotikError);
                }
            }

            await conn.commit();

            res.json({
                success: true,
                message: `Status updated to ${status}`
            });

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

    } catch (error: any) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Switch customer to prepaid billing mode
 */
export const switchToPrepaid = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { initialDays } = req.body;

        const customerId = parseInt(id);
        if (!customerId || isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid customer ID'
            });
        }

        const { PrepaidService } = await import('../services/billing/PrepaidService');

        const result = await PrepaidService.switchToPrepaid(
            customerId,
            parseInt(initialDays) || 1,
            true // Send WhatsApp notification
        );

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                expiryDate: result.expiryDate
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (error: any) {
        console.error('Switch to prepaid error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to switch to prepaid mode'
        });
    }
};

/**
 * Sync all customers to GenieACS (One-way: Billing -> GenieACS)
 * Updates Tags on GenieACS based on Serial Number in Billing
 */
export const syncAllCustomersToGenieacs = async (req: Request, res: Response) => {
    try {
        console.log('[Sync GenieACS] Starting full sync...');
        const genieacs = await GenieacsService.getInstanceFromDb();

        // 1. Get all customers with serial number
        const val: any[] = [];
        const [customers] = await databasePool.query<RowDataPacket[]>(
            "SELECT id, name, serial_number FROM customers WHERE serial_number IS NOT NULL AND serial_number != ''",
            val
        );

        console.log(`[Sync GenieACS] Found ${customers.length} customers with Serial Number`);

        let syncedCount = 0;
        let failedCount = 0;
        let notFoundCount = 0; // Device not found in GenieACS

        // Process in chunks or parallel with limit? 
        // For safety, sequential or small batches. sequential is fine for background job feel

        // We'll return a stream/progress or just wait? If many, it might timeout.
        // Better to send response immediately and process in background?
        // User asked for a button, usually expects feedback. 
        // If < 1000 customers, might be OK to wait 30s. If more, background is better.
        // I'll do synchronous for now but with a faster check standard.

        // Projection includes common PPPoE paths
        const projection = [
            '_id',
            '_deviceId._SerialNumber',
            '_tags',
            'VirtualParameters.pppoeUsername',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'
        ];

        const allDevices = await genieacs.getDevices(5000, 0, projection);

        // Build maps for efficient matching
        const deviceBySerial = new Map<string, any>();
        const deviceByPPPoE = new Map<string, any>();

        allDevices.forEach(d => {
            if (d._deviceId?._SerialNumber) {
                deviceBySerial.set(d._deviceId._SerialNumber, d);
            }

            // Use GenieacsService helper if available or manual extraction
            // Since we are in CustomerController, we'll do manual extraction for simplicity or assume service has it
            const tags = d._tags || [];

            // PPPoE Extraction logic similar to service
            let pppoeUsername = d.VirtualParameters?.pppoeUsername?._value;
            if (!pppoeUsername) {
                pppoeUsername = d.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value;
            }

            if (pppoeUsername && pppoeUsername !== '-') {
                deviceByPPPoE.set(pppoeUsername.toLowerCase(), d);
            }
        });

        console.log(`[Sync GenieACS] Loaded ${allDevices.length} devices from GenieACS`);

        for (const customer of customers) {
            let device = null;

            // A. Match by Serial
            if (customer.serial_number && deviceBySerial.has(customer.serial_number)) {
                device = deviceBySerial.get(customer.serial_number);
            }
            // B. Match by PPPoE
            else if (customer.pppoe_username && deviceByPPPoE.has(customer.pppoe_username.toLowerCase())) {
                device = deviceByPPPoE.get(customer.pppoe_username.toLowerCase());
            }

            if (device) {
                try {
                    const tagName = customer.name.replace(/[^a-zA-Z0-9.\s_-]/g, '').trim();
                    if (!(device._tags || []).includes(tagName)) {
                        await genieacs.addDeviceTag(device._id, tagName);
                        syncedCount++;
                    }
                } catch (e) {
                    console.error(`[Sync GenieACS] Failed to tag ${customer.name}:`, e);
                    failedCount++;
                }
            } else {
                notFoundCount++;
            }
        }

        res.json({
            success: true,
            message: `Sync Selesai. Dimperbarui: ${syncedCount}, Gagal: ${failedCount}, Tidak ditemukan di ACS: ${notFoundCount}`,
            data: { syncedCount, failedCount, notFoundCount }
        });

    } catch (error: any) {
        console.error('[Sync GenieACS] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Switch customer back to postpaid billing mode
 */
export const switchToPostpaid = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const customerId = parseInt(id);
        if (!customerId || isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid customer ID'
            });
        }

        const { PrepaidService } = await import('../services/billing/PrepaidService');

        const result = await PrepaidService.switchToPostpaid(customerId);

        res.json({
            success: result.success,
            message: result.message
        });

    } catch (error: any) {
        console.error('Switch to postpaid error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to switch to postpaid mode'
        });
    }
};
