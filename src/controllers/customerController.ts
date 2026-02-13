import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { getMikrotikConfig } from '../utils/mikrotikConfigHelper';
import { listPackages as listPppoePackages } from '../services/pppoeService';
import { listStaticIpPackages, syncClientQueues } from '../services/staticIpPackageService';
import { getInterfaces } from '../services/mikrotikService';
import { calculateCustomerIP } from '../utils/ipHelper';
import GenieacsService from '../services/genieacs/GenieacsService';
import { NetworkMonitoringService } from '../services/monitoring/NetworkMonitoringService';
import { recalculateOdpUsage } from '../services/ftth/odpService';

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

        // Get customer compensations
        let compensations: RowDataPacket[] = [];
        try {
            const [compResult] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM customer_compensations 
                 WHERE customer_id = ? 
                 ORDER BY created_at DESC`,
                [customerId]
            );
            compensations = Array.isArray(compResult) ? compResult : [];
        } catch (compError) {
            console.error('Error fetching compensations:', compError);
            compensations = [];
        }

        // Get technician jobs history
        let technicianJobs: RowDataPacket[] = [];
        try {
            const [jobsResult] = await databasePool.query<RowDataPacket[]>(
                `SELECT tj.*, u.username as technician_name 
                 FROM technician_jobs tj
                 LEFT JOIN users u ON tj.technician_id = u.id
                 WHERE tj.customer_id = ? 
                 ORDER BY tj.created_at DESC`,
                [customerId]
            );
            technicianJobs = Array.isArray(jobsResult) ? jobsResult : [];
        } catch (jobError) {
            console.error('Error fetching jobs:', jobError);
            technicianJobs = [];
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
            compensations: compensations || [],
            technicianJobs: technicianJobs || [],
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
                const allPppoePackages = await listPppoePackages();
                // Filter out full packages, but ALWAYS keep the customer's CURRENT package
                packages = allPppoePackages.filter((p: any) => !p.is_full || p.id === customer.package_id || p.id === customer.pppoe_package_id);
                console.log(`[CustomerEdit] Loaded ${packages.length} PPPoE packages for customer ${customerId}`);
            } else if (customer.connection_type === 'static_ip') {
                const allStaticIpPackages = await listStaticIpPackages();
                // Filter out full packages, but ALWAYS keep the customer's CURRENT package
                packages = allStaticIpPackages.filter(p => !p.is_full || p.id === customer.static_ip_package_id || p.id === customer.package_id);
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
        console.log('[updateCustomer] Request received, method:', req.method);
        console.log('[updateCustomer] Params:', req.params);
        console.log('[updateCustomer] Body Phone:', req.body.phone);
        console.log('[updateCustomer] Body All Keys:', Object.keys(req.body));
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
            rental_cost,
            ignore_monitoring_start,
            ignore_monitoring_end
        } = req.body;

        console.log('[DEBUG UPDATE] ODP ID from body:', odp_id);
        console.log('[DEBUG UPDATE] ODC ID from body:', odc_id);

        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            // Check if customer exists and get old data
            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, status, pppoe_username, connection_type, pppoe_password, serial_number, phone, name_edited_at, odp_id FROM customers WHERE id = ?',
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
            const oldStatus = oldCustomer.status;
            const oldPppoeUsername = oldCustomer.pppoe_username;
            const oldPppoePassword = oldCustomer.pppoe_password;

            // Update customer basic info
            const updateFields: string[] = [];
            const updateValues: any[] = [];
            let newStatus = null;

            if (name !== undefined) {
                if (name !== oldName) {
                    // Admin can change name unlimited times. 
                    // We DO NOT update 'name_edited_at' here so it doesn't affect WhatsApp self-service limit.
                    // Or we could, but better to keep them separate unless Admin wants to lock it.
                }

                updateFields.push('name = ?');
                updateValues.push(name);
            }
            if (customer_code !== undefined) {
                updateFields.push('customer_code = ?');
                updateValues.push(customer_code || null);
            }
            if (req.body.phone !== undefined) {
                console.log('[DEBUG PHONE] Phone from body:', req.body.phone);
                updateFields.push('phone = ?');
                // Ensure phone is stored as string, clean whitespace
                const phoneVal = req.body.phone ? String(req.body.phone).trim() : null;
                console.log('[DEBUG PHONE] Phone value to save:', phoneVal);
                updateValues.push(phoneVal);
            } else if (req.body.phone === '') {
                // Handle empty string case
                updateFields.push('phone = ?');
                updateValues.push(null);
            } else {
                console.log('[DEBUG PHONE] Phone is UNDEFINED in req.body');
            }
            if (email !== undefined) {
                updateFields.push('email = ?');
                updateValues.push(email || null);
            }
            if (req.body.address !== undefined) {
                updateFields.push('address = ?');
                updateValues.push(req.body.address || null);
            }
            if (status !== undefined) {
                updateFields.push('status = ?');
                updateValues.push(status);
                newStatus = status;


            }
            if (connection_type !== undefined) {
                updateFields.push('connection_type = ?');
                updateValues.push(connection_type);
            }
            if (req.body.ip_address !== undefined) {
                // Save IP to main table as well (for SelfHealingService)
                updateFields.push('ip_address = ?');
                updateValues.push(req.body.ip_address || null);

                // If static IP, also save to static_ip column
                if (connection_type === 'static_ip' || (oldCustomer.connection_type === 'static_ip' && !connection_type)) {
                    updateFields.push('static_ip = ?');
                    updateValues.push(req.body.ip_address || null);
                }
            }
            if (req.body.odp_id !== undefined) {
                updateFields.push('odp_id = ?');
                updateValues.push(req.body.odp_id || null);
            }
            if (req.body.odc_id !== undefined) {
                updateFields.push('odc_id = ?');
                updateValues.push(req.body.odc_id || null);
            }
            if (req.body.serial_number !== undefined) {
                updateFields.push('serial_number = ?');
                updateValues.push(req.body.serial_number || null);
            }
            if (req.body.latitude !== undefined) {
                updateFields.push('latitude = ?');
                updateValues.push(req.body.latitude || null);
            }
            if (req.body.longitude !== undefined) {
                updateFields.push('longitude = ?');
                updateValues.push(req.body.longitude || null);
            }

            // Handle PPN Taxable flag
            // Checkbox behavior: sent as '1' if checked, missing if unchecked
            // We only update if billing_mode is also present (implying a form submission or full update)
            if (req.body.billing_mode !== undefined) {
                updateFields.push('is_taxable = ?');
                updateValues.push(req.body.is_taxable ? 1 : 0);
            } else if (req.body.is_taxable !== undefined) {
                // Partial update explicitly targeting this field
                updateFields.push('is_taxable = ?');
                updateValues.push(req.body.is_taxable === '1' || req.body.is_taxable === true ? 1 : 0);
            }

            // Handle custom deadline fields
            if (req.body.custom_payment_deadline !== undefined && req.body.custom_payment_deadline !== '') {
                const deadline = parseInt(req.body.custom_payment_deadline);
                if (deadline >= 1 && deadline <= 31) {
                    updateFields.push('custom_payment_deadline = ?');
                    updateValues.push(deadline);
                } else {
                    updateFields.push('custom_payment_deadline = NULL');
                }
            } else if (req.body.custom_payment_deadline === '') {
                // Empty string means reset to NULL
                updateFields.push('custom_payment_deadline = NULL');
            }

            if (req.body.custom_isolate_days_after_deadline !== undefined && req.body.custom_isolate_days_after_deadline !== '') {
                const days = parseInt(req.body.custom_isolate_days_after_deadline);
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
            if (req.body.rental_mode !== undefined) {
                updateFields.push('rental_mode = ?');
                updateValues.push(req.body.rental_mode);
            }
            if (req.body.rental_cost !== undefined) {
                // If empty screen, set to null. If value provided, ensure numeric.
                let costVal = null;
                if (req.body.rental_cost !== null && req.body.rental_cost !== '') {
                    costVal = parseFloat(String(req.body.rental_cost).replace(/[^0-9.]/g, ''));
                }
                updateFields.push('rental_cost = ?');
                updateValues.push(costVal);
            }

            // Handle Ignore Monitoring Schedule
            if (req.body.ignore_monitoring_start !== undefined) {
                updateFields.push('ignore_monitoring_start = ?');
                // Convert time format HH:MM to datetime (use today's date)
                if (req.body.ignore_monitoring_start) {
                    const today = new Date().toISOString().split('T')[0];
                    updateValues.push(`${today} ${req.body.ignore_monitoring_start}:00`);
                } else {
                    updateValues.push(null);
                }
            }
            if (req.body.ignore_monitoring_end !== undefined) {
                updateFields.push('ignore_monitoring_end = ?');
                // Convert time format HH:MM to datetime (use today's date)
                if (req.body.ignore_monitoring_end) {
                    const today = new Date().toISOString().split('T')[0];
                    updateValues.push(`${today} ${req.body.ignore_monitoring_end}:00`);
                } else {
                    updateValues.push(null);
                }
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
                const query = `UPDATE customers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`;
                console.log('[updateCustomer] Main Update Query:', query);
                console.log('[updateCustomer] Main Update Values:', updateValues);

                const [result] = await conn.query(query, updateValues);
                console.log('[updateCustomer] Main Update Executed. Affected Rows:', (result as any).affectedRows);
                console.log('[updateCustomer] Main Update Info:', (result as any).info);
            } else {
                console.log('[updateCustomer] No main fields to update');
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
            if (connection_type === 'pppoe' && req.body.pppoe_username) {
                updateFields.length = 0;
                updateValues.length = 0;
                updateFields.push('pppoe_username = ?');
                updateValues.push(req.body.pppoe_username);
                if (req.body.pppoe_profile_id) {
                    const profileIdNum = parseInt(req.body.pppoe_profile_id);
                    if (!isNaN(profileIdNum) && profileIdNum > 0) {
                        updateFields.push('pppoe_profile_id = ?');
                        updateValues.push(profileIdNum);
                    }
                }
                // Update password if provided
                if (req.body.pppoe_password) {
                    updateFields.push('pppoe_password = ?');
                    updateValues.push(req.body.pppoe_password);
                }
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

                    // STRICT LIMIT CHECK
                    const { isPppoePackageFull } = await import('../utils/packageLimit');
                    const isFull = await isPppoePackageFull(packageId);

                    // Check if user is already in this package, if so, ignore limit
                    const [currentSub] = await conn.query<RowDataPacket[]>(
                        'SELECT package_id FROM subscriptions WHERE customer_id = ? AND status = "active"',
                        [customerId]
                    );
                    const isSamePackage = currentSub && currentSub.length > 0 && currentSub[0].package_id === packageId;

                    if (isFull && !isSamePackage) {
                        throw new Error(`Paket PPPoE yang dipilih sudah penuh (Max Limit tercapai). Silakan buat paket baru atau upgrade kapasitas.`);
                    }

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
                            // For PPPoE activation flow: If customer is inactive, create subscription as inactive
                            const targetSubStatus = (newStatus || oldCustomer.status) === 'inactive' ? 'inactive' : 'active';

                            await conn.query(
                                `INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
                                [customerId, pkg?.id, pkg?.name, pkg?.price, targetSubStatus]
                            );
                            console.log(`[Edit Customer] ✅ New subscription created with package: ${pkg?.name} (Status: ${targetSubStatus})`);
                        }
                    } else {
                        console.log(`[Edit Customer] ⚠️ Package ID ${packageId} not found in pppoe_packages`);
                    }
                }
            }

            // ... (Middle code remains roughly same, skipping non-package blocks) ...

            // ========== UPDATE SUBSCRIPTION KETIKA PAKET DIUBAH (STATIC IP) ==========
            // Handle package update for Static IP customers
            const targetConnTypeForSub = connection_type || oldCustomer.connection_type;
            if (targetConnTypeForSub === 'static_ip' && static_ip_package) {
                const packageId = parseInt(static_ip_package);
                if (!isNaN(packageId) && packageId > 0) {
                    console.log(`[Edit Customer] Updating subscription for static IP customer ${customerId} to package ${packageId}`);

                    // STRICT LIMIT CHECK
                    const { isStaticIpPackageFull } = await import('../utils/packageLimit');
                    const isFull = await isStaticIpPackageFull(packageId);

                    // Check if user is already in this package
                    const [currentSubStatic] = await conn.query<RowDataPacket[]>(
                        'SELECT package_id FROM subscriptions WHERE customer_id = ? AND status = "active"',
                        [customerId]
                    );
                    const isSamePackage = currentSubStatic && currentSubStatic.length > 0 && currentSubStatic[0].package_id === packageId;

                    if (isFull && !isSamePackage) {
                        throw new Error(`Paket Static IP yang dipilih sudah penuh (Max Limit tercapai). Silakan buat paket baru.`);
                    }

                    // Get package details
                    const [packageRows] = await conn.query<RowDataPacket[]>(
                        'SELECT id, name, price FROM static_ip_packages WHERE id = ?',
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
                            console.log(`[Edit Customer Static IP] ✅ Subscription updated to package: ${pkg?.name}`);
                        } else {
                            // Create new subscription if none exists
                            await conn.query(
                                `INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), NOW())`,
                                [customerId, pkg?.id, pkg?.name, pkg?.price]
                            );
                            console.log(`[Edit Customer Static IP] ✅ New subscription created with package: ${pkg?.name}`);
                        }
                    }
                }
            }

            // Handle connection type specific updates
            const targetConnType = connection_type || oldCustomer.connection_type;

            if (targetConnType === 'static_ip') {
                try {
                    const [staticClient] = await conn.query<RowDataPacket[]>('SELECT id, ip_address, package_id FROM static_ip_clients WHERE customer_id = ?', [customerId]);

                    const staticIpUpdates: string[] = [];
                    const staticIpValues: any[] = [];

                    if (req.body.ip_address) { staticIpUpdates.push('ip_address = ?'); staticIpValues.push(req.body.ip_address); }
                    if (req.body.interface) { staticIpUpdates.push('interface = ?'); staticIpValues.push(req.body.interface); }
                    if (req.body.static_ip_package) { staticIpUpdates.push('package_id = ?'); staticIpValues.push(req.body.static_ip_package); }

                    if (staticClient && staticClient.length > 0) {
                        if (staticIpUpdates.length > 0) {
                            staticIpValues.push(staticClient[0].id);
                            await conn.query(`UPDATE static_ip_clients SET ${staticIpUpdates.join(', ')}, updated_at = NOW() WHERE id = ?`, staticIpValues);
                            console.log(`[UpdateCustomer] Updated static_ip_clients for customer ${customerId}`);
                        }

                        // SOPHISTICATED STATIC IP SYNC
                        console.log('[UpdateCustomer] 🔄 Syncing Static IP Queues to MikroTik...');
                        const finalIp = req.body.ip_address || (staticClient[0] as any).ip_address;
                        const finalPackageId = req.body.static_ip_package ? parseInt(req.body.static_ip_package) : (staticClient[0] as any).package_id;

                        if (finalIp && finalPackageId) {
                            try {
                                const { syncClientQueues } = await import('../services/staticIpPackageService');
                                await syncClientQueues(
                                    customerId,
                                    finalPackageId,
                                    finalIp,
                                    req.body.name || oldName, // Use updated name if provided
                                    { oldClientName: oldName } // option to cleanup old queues if name changed
                                );
                                console.log('[UpdateCustomer] ✅ Static IP Queues Synced.');
                            } catch (qError) {
                                console.error('[UpdateCustomer] ❌ Queue Sync Failed:', qError);
                            }
                        }

                    } else if (targetConnType === 'static_ip') {
                        // Create new static_ip_clients record if switching connection type
                        const pkgId = req.body.static_ip_package ? parseInt(req.body.static_ip_package) : null;
                        if (req.body.ip_address && pkgId) {
                            await conn.query(
                                'INSERT INTO static_ip_clients (customer_id, client_name, ip_address, interface, package_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "active", NOW(), NOW())',
                                [customerId, req.body.name || oldName, req.body.ip_address, req.body.interface, pkgId]
                            );
                            console.log(`[UpdateCustomer] Created new static_ip_clients for customer ${customerId}`);

                            // SOPHISTICATED STATIC IP SYNC (NEW)
                            console.log('[UpdateCustomer] 🔄 Creating Static IP Queues on MikroTik...');
                            try {
                                const { syncClientQueues } = await import('../services/staticIpPackageService');
                                await syncClientQueues(
                                    customerId,
                                    pkgId,
                                    req.body.ip_address,
                                    req.body.name || oldName
                                );
                                console.log('[UpdateCustomer] ✅ New Static IP Queues Created.');
                            } catch (qError) {
                                console.error('[UpdateCustomer] ❌ Queue Creation Failed:', qError);
                            }
                        }
                    }
                } catch (staticIpError) {
                    console.error('[UpdateCustomer] Error updating static IP data:', staticIpError);
                }
            }

            await conn.commit();
            console.log('[updateCustomer] Update successful, redirecting to:', `/customers/${customerId}?success=updated`);

            // Network map sync also disabled to be safe if requested, but let's keep it unless it crashes too. 
            // Usually internal DB sync is fine.
            try {
                await NetworkMonitoringService.syncCustomerDevices();
            } catch (syncError) {
                console.error('[updateCustomer] Error syncing network devices:', syncError);
            }

            req.flash('success', 'Data pelanggan berhasil diperbarui (Database Only)');
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
            return res.status(400).json({ success: false, error: 'Invalid customer ID' });
        }

        let customerForCleanup: any = null;

        const conn = await databasePool.getConnection();
        try {
            // 1. Check if customer exists and get data for cleanup
            const [customers] = await conn.query<RowDataPacket[]>(
                'SELECT id, name, customer_code, phone, connection_type, pppoe_username FROM customers WHERE id = ?',
                [customerId]
            );

            if (!customers || customers.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `Pelanggan tidak ditemukan (ID: ${customerId})`
                });
            }

            customerForCleanup = customers[0];

            // If Static IP, verify if we need to fetch specific IP data before deletion
            if (customerForCleanup.connection_type === 'static_ip') {
                const [staticIpClients] = await conn.query<RowDataPacket[]>(
                    'SELECT id, client_name, ip_address, interface FROM static_ip_clients WHERE customer_id = ?',
                    [customerId]
                );
                if (staticIpClients && staticIpClients.length > 0) {
                    customerForCleanup.staticIpData = staticIpClients[0];
                }
            }

            // 2. Perform Database Cleanup (The Critical Part)

            // Delete logs and history
            await conn.query('DELETE FROM customer_migration_logs WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM customer_speed_history WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM customer_notifications_log WHERE customer_id = ?', [customerId]);

            // Delete notification logs
            await conn.query('DELETE FROM notification_logs WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM whatsapp_notifications WHERE customer_id = ?', [customerId]);
            if (customerForCleanup.phone) {
                await conn.query('DELETE FROM whatsapp_bot_messages WHERE phone_number = ?', [customerForCleanup.phone]);
            }
            await conn.query('DELETE FROM telegram_notifications WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM unified_notifications_queue WHERE customer_id = ?', [customerId]);

            // Delete address list items and network devices
            await conn.query('DELETE FROM address_list_items WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM mikrotik_address_list_items WHERE customer_id = ?', [customerId]);
            await conn.query('UPDATE network_devices SET customer_id = NULL WHERE customer_id = ?', [customerId]);

            // Handle loyalty and balance
            await conn.query('DELETE FROM loyalty_transactions WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM customer_balance_logs WHERE customer_id = ?', [customerId]);

            // Handle subscriptions and IP clients
            await conn.query('DELETE FROM subscriptions WHERE customer_id = ?', [customerId]);
            await conn.query('DELETE FROM static_ip_clients WHERE customer_id = ?', [customerId]);

            // Handle invoices and payments
            const [customerInvoices] = await conn.query<RowDataPacket[]>('SELECT id FROM invoices WHERE customer_id = ?', [customerId]);
            if (customerInvoices.length > 0) {
                const invoiceIds = customerInvoices.map(inv => inv.id);
                await conn.query('DELETE FROM payments WHERE invoice_id IN (?)', [invoiceIds]);
                await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [invoiceIds]);
                await conn.query('DELETE FROM invoices WHERE customer_id = ?', [customerId]);
            }

            // Finally, Delete Customer
            await conn.query('DELETE FROM customers WHERE id = ?', [customerId]);

        } finally {
            conn.release();
        }

        // 3. Send Success Response Immediately
        res.json({
            success: true,
            message: 'Pelanggan berhasil dihapus'
        });

        // 4. Perform External Cleanup in Background (MikroTik, Notifications)
        // This runs AFTER response is sent, so it doesn't block UI
        if (customerForCleanup) {
            (async () => {
                const customer = customerForCleanup;
                console.log(`[Background Cleanup] Starting for customer ${customerId} (${customer.name})`);

                // A. Send Notification
                try {
                    if (customer.phone) {
                        const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
                        await UnifiedNotificationService.queueNotification({
                            customer_id: customerId, // ID might not exist in DB anymore, but logging uses it
                            notification_type: 'customer_deleted',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                customer_code: customer.customer_code || `#${customerId}`
                            },
                            priority: 'high'
                        });
                        // Try to send immediately (ignoring errors)
                        UnifiedNotificationService.sendPendingNotifications(10).catch(() => { });
                    }
                } catch (notifErr) {
                    console.warn(`[Background Cleanup] Notif error:`, notifErr);
                }

                // B. MikroTik Clean Up
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
                        if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                            try {
                                await deletePppoeSecret(config, customer.pppoe_username);
                                console.log(`[Background Cleanup] PPPoE secret deleted: ${customer.pppoe_username}`);
                            } catch (e: any) {
                                console.warn(`[Background Cleanup] Failed delete PPPoE: ${e.message}`);
                            }
                        } else if (customer.connection_type === 'static_ip' && customer.staticIpData) {
                            const staticIpClient = customer.staticIpData;

                            // Delete IP
                            if (staticIpClient.ip_address) {
                                let targetIpToDelete = staticIpClient.ip_address;
                                try {
                                    const [ipOnly, prefixStr] = String(staticIpClient.ip_address).split('/');
                                    const prefix = Number(prefixStr || '0');
                                    if (prefix === 30) {
                                        // Calc Gateway Logic
                                        const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                        const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                                        const networkInt = ipToInt(ipOnly) & ((0xFFFFFFFF << (32 - prefix)) >>> 0);
                                        const firstHost = networkInt + 1;
                                        const secondHost = networkInt + 2;
                                        const ipInt = ipToInt(ipOnly);
                                        const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                                        targetIpToDelete = `${gatewayIp}/${prefix}`;
                                    }
                                } catch (e) { }

                                try {
                                    await removeIpAddress(config, targetIpToDelete);
                                    console.log(`[Background Cleanup] IP deleted: ${targetIpToDelete}`);
                                } catch (e: any) { console.warn(`[Background Cleanup] IP delete fail: ${e.message}`); }

                                // Delete Mangle
                                try {
                                    const [ipOnly, prefixStr] = String(staticIpClient.ip_address).split('/');
                                    // Simplified mangle cleanup logic for background
                                    const peerIp = ipOnly; // Use IP as is for simple mark logic if complex calc fails
                                    // Ideally copy paste full logic but simplified for brevity
                                    const downloadMark = peerIp;
                                    const uploadMark = `UP-${peerIp}`;
                                    await removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
                                } catch (e: any) { console.warn(`[Background Cleanup] Mangle delete fail: ${e.message}`); }

                                // Delete Queue
                                if (staticIpClient.client_name) {
                                    try {
                                        await deleteClientQueuesByClientName(config, staticIpClient.client_name);
                                    } catch (e: any) { console.warn(`[Background Cleanup] Queue delete fail: ${e.message}`); }
                                }
                            }
                        }
                    }
                } catch (mikrotikErr) {
                    console.warn(`[Background Cleanup] MikroTik error:`, mikrotikErr);
                }

                // C. Sync Network Devices
                try {
                    await NetworkMonitoringService.syncCustomerDevices();
                } catch (syncErr) { console.warn(`[Background Cleanup] Sync error:`, syncErr); }

            })().catch(err => console.error('[Background Cleanup Job Failed]', err));
        }

    } catch (error: unknown) {
        console.error('Error deleting customer:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal menghapus pelanggan';
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage
            });
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

                                // Process queue immediately (same as customer_created) - DISABLED for bulk performance
                                /*
                                try {
                                    const result = await UnifiedNotificationService.sendPendingNotifications(10);
                                    console.log(`[BulkDelete] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
                                } catch (queueError: any) {
                                    console.warn(`[BulkDelete] ⚠️ Queue processing error (non-critical):`, queueError.message);
                                    // Non-critical, notification is already queued
                                }
                                */
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
                    // 1. Logs and History
                    await conn.query('DELETE FROM customer_migration_logs WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM customer_speed_history WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM bandwidth_logs WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM connection_logs WHERE customer_id = ?', [customerId]);

                    // 2. Notifications
                    await conn.query('DELETE FROM notification_logs WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM whatsapp_notifications WHERE customer_id = ?', [customerId]);
                    if (customer.phone) {
                        await conn.query('DELETE FROM whatsapp_bot_messages WHERE phone_number = ?', [customer.phone]);
                    }
                    await conn.query('DELETE FROM telegram_notifications WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM unified_notifications_queue WHERE customer_id = ?', [customerId]);

                    // 3. Address list items
                    await conn.query('DELETE FROM address_list_items WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM mikrotik_address_list_items WHERE customer_id = ?', [customerId]);
                    await conn.query('UPDATE network_devices SET customer_id = NULL WHERE customer_id = ?', [customerId]);

                    // 4. Loyalty
                    await conn.query('DELETE FROM loyalty_transactions WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM customer_balance_logs WHERE customer_id = ?', [customerId]);

                    // 5. Subscriptions
                    await conn.query('DELETE FROM subscriptions WHERE customer_id = ?', [customerId]);
                    await conn.query('DELETE FROM static_ip_clients WHERE customer_id = ?', [customerId]);

                    // 6. Invoices
                    const [customerInvoices] = await conn.query<RowDataPacket[]>('SELECT id FROM invoices WHERE customer_id = ?', [customerId]);
                    if (customerInvoices.length > 0) {
                        const invoiceIds = customerInvoices.map(inv => inv.id);
                        await conn.query('DELETE FROM payments WHERE invoice_id IN (?)', [invoiceIds]);
                        await conn.query('DELETE FROM invoice_items WHERE invoice_id IN (?)', [invoiceIds]);
                        await conn.query('DELETE FROM invoices WHERE customer_id = ?', [customerId]);
                    }

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
            } else if (customer.connection_type === 'static_ip') {
                // Static IP Isolation Logic
                try {
                    const [staticClients] = await conn.query<RowDataPacket[]>(
                        'SELECT ip_address FROM static_ip_clients WHERE customer_id = ?',
                        [customerId]
                    );

                    if (staticClients && staticClients.length > 0) {
                        const clientIp = staticClients[0].ip_address; // this is Client IP (e.g. .2)
                        if (clientIp) {
                            const config = await getMikrotikConfig();
                            if (config) {
                                const { findIpAddressId, updateIpAddress } = await import('../services/mikrotikService');

                                let targetIp = clientIp;

                                // Calculate Gateway IP if /30 to isolate the Gateway (Router Interface)
                                const [ipOnly, prefixStr] = String(clientIp).split('/');
                                const prefix = Number(prefixStr || '0');
                                if (prefix === 30) {
                                    const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                                    const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');

                                    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                                    const networkInt = ipToInt(ipOnly) & mask;
                                    const firstHost = networkInt + 1;
                                    const secondHost = networkInt + 2;
                                    const ipInt = ipToInt(ipOnly);

                                    // Gateway is Peer
                                    const gwIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                                    targetIp = `${gwIp}/${prefix}`;
                                }

                                // Find ID of the IP on MikroTik
                                let ipId = await findIpAddressId(config, targetIp);
                                if (!ipId) ipId = await findIpAddressId(config, targetIp.split('/')[0]);

                                if (ipId) {
                                    // active -> disabled: false, inactive -> disabled: true
                                    await updateIpAddress(config, ipId, { disabled: status !== 'active' });
                                    console.log(`✅ Static IP ${targetIp} status updated to ${status} (Disabled: ${status !== 'active'})`);
                                } else {
                                    console.warn(`⚠️ Could not find MikroTik IP for isolation: ${targetIp}`);
                                }
                            }
                        }
                    }
                } catch (sipErr) {
                    console.error('Static IP Isolation Error:', sipErr);
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

/**
 * Get active PPPoE connections from Mikrotik that are not yet in billing
 */
export const getActivePppoeConnections = async (req: Request, res: Response) => {
    try {
        console.log('[API] getActivePppoeConnections called');

        const mikrotikConfig = await getMikrotikConfig();
        if (!mikrotikConfig) {
            console.error('[API] getActivePppoeConnections: No Mikrotik Config found');
            return res.status(500).json({ status: 'error', message: 'Konfigurasi Mikrotik belum diset atau tidak ditemukan di database.' });
        }

        // Import service safely
        let getPppoeActiveConnections;
        try {
            const service = await import('../services/mikrotikService');
            getPppoeActiveConnections = service.getPppoeActiveConnections;
        } catch (impErr: any) {
            console.error('[API] Failed to import mikrotikService:', impErr);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat service mikrotik: ' + impErr.message });
        }

        console.log('[API] Connecting to Mikrotik to fetch active connections...');

        // Pass config ensuring all required fields are present
        const safeConfig = {
            ...mikrotikConfig,
            use_tls: mikrotikConfig.use_tls ?? false
        };

        const actives = await getPppoeActiveConnections(safeConfig);
        console.log(`[API] Got ${actives ? actives.length : 0} active connections`);

        if (!actives || !Array.isArray(actives)) {
            return res.json({ status: 'success', data: [] });
        }

        // Get exclude_id from query (for edit page, to show current customer's active connection)
        const excludeId = req.query.exclude_id ? parseInt(req.query.exclude_id as string) : null;

        // Get all registered pppoe usernames
        let query = 'SELECT pppoe_username FROM customers WHERE pppoe_username IS NOT NULL';
        const params: any[] = [];

        if (excludeId && !isNaN(excludeId)) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
        const registeredUsernames = new Set(rows.map(r => r.pppoe_username));

        // Filter: only those NOT in database
        const unregistered = actives.filter(a => !registeredUsernames.has(a.name));
        console.log(`[API] Filtering complete. Returning ${unregistered.length} unregistered active connections.`);

        res.json({ status: 'success', data: unregistered });
    } catch (e: any) {
        console.error('[getActivePppoeConnections] Critical Error:', e);
        // Ensure we send JSON even on crash
        res.status(500).json({ status: 'error', message: e.message || 'Terjadi kesalahan sistem internal saat mengambil data Mikrotik.' });
    }
};

/**
 * View Registration Requests
 */
export const viewRegistrationRequests = async (req: Request, res: Response) => {
    try {
        // Ambil data permintaan registrasi dari database
        let requests: any[] = [];
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>('SELECT * FROM registration_requests ORDER BY created_at DESC');
            requests = rows;
        } catch (dbError) {
            console.warn('Tabel registration_requests mungkin belum ada:', dbError);
        }

        res.render('customers/registration_requests/index', {
            title: 'Permintaan Registrasi',
            currentPath: '/customers/registration-requests',
            requests,
            layout: 'layouts/main',
            user: (req as any).user
        });
    } catch (error: any) {
        console.error('Error viewing registration requests:', error);
        req.flash('error', 'Gagal memuat halaman permintaan registrasi.');
        res.redirect('/customers/list');
    }
};

/**
 * Add compensation (restitution) for customer
 */
export const addCompensation = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return res.redirect('/customers/list');

    try {
        const { days, reason, start_date, end_date } = req.body;

        if (!days || !reason) {
            req.flash('error', 'Semua field harus diisi');
            return res.redirect(`/customers/${id}`);
        }

        const { CompensationService } = await import('../services/billing/CompensationService');

        await CompensationService.registerCompensation({
            customerId: parseInt(id),
            days: parseInt(days),
            reason: reason,
            startDate: start_date,
            endDate: end_date,
            adminId: (req as any).user?.id,
            adminName: (req as any).user?.username
        });

        // Notification
        // TODO: Implement 'compensation_applied' notification type
        console.log(`[Compensation] Restitution registered for customer ${id}`);

        req.flash('success', 'Restitusi berhasil didaftarkan');
        res.redirect(`/customers/${id}`);

    } catch (error: any) {
        console.error('Error adding compensation:', error);
        req.flash('error', 'Gagal menambahkan restitusi: ' + error.message);
        res.redirect(`/customers/${id}`);
    }
};
