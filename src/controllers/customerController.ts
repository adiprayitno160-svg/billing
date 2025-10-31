import { Request, Response } from 'express';
import { databasePool } from '../db/pool';
import * as XLSX from 'xlsx';
import { CustomerIdGenerator } from '../utils/customerIdGenerator';
import MigrationService from '../services/customer/MigrationService';
import { MikrotikService } from '../services/mikrotik/MikrotikService';
import { getMikrotikConfig } from '../services/staticIpPackageService';

export const getCustomerList = async (req: Request, res: Response) => {
    try {
        console.log('=== GET CUSTOMER LIST ===');
        console.log('Query params:', req.query);
        
        const { status, odc_id, search, billing_mode, page = 1, limit = 20 } = req.query;
        
        let query = `
            SELECT c.*, ftth_odc.name as odc_name,
                   pc.portal_id,
                   CASE 
                       WHEN c.connection_type = 'pppoe' THEN 'PPPOE'
                       WHEN c.connection_type = 'static_ip' THEN 'IP Static'
                       ELSE 'PPPOE'
                   END as connection_type_display,
                   CASE 
                       WHEN sub.package_name IS NOT NULL AND sub.package_name != '' THEN sub.package_name
                       WHEN c.connection_type = 'pppoe' AND pppoe_pkg.name IS NOT NULL THEN pppoe_pkg.name
                       WHEN c.connection_type = 'static_ip' AND static_pkg.name IS NOT NULL THEN static_pkg.name
                       ELSE NULL
                   END as package_name
            FROM customers c
            LEFT JOIN ftth_odc ON c.odc_id = ftth_odc.id
            LEFT JOIN portal_customers pc ON c.id = pc.customer_id
            LEFT JOIN subscriptions sub ON c.id = sub.customer_id AND sub.status = 'active'
            LEFT JOIN pppoe_packages pppoe_pkg ON sub.package_id = pppoe_pkg.id AND c.connection_type = 'pppoe'
            LEFT JOIN static_ip_clients static_client ON c.id = static_client.customer_id AND c.connection_type = 'static_ip'
            LEFT JOIN static_ip_packages static_pkg ON static_client.package_id = static_pkg.id AND c.connection_type = 'static_ip'
            WHERE 1=1
        `;
        
        const params: any[] = [];
        
        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        
        if (odc_id) {
            query += ` AND c.odc_id = ?`;
            params.push(odc_id);
        }
        
        if (billing_mode) {
            query += ` AND c.billing_mode = ?`;
            params.push(billing_mode);
        }
        
        if (search) {
            query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += ` ORDER BY c.created_at DESC`;
        
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), offset);
        
        console.log('Final query:', query);
        console.log('Query params:', params);
        
        const [result] = await databasePool.query(query, params);
        
        console.log('Query result:', result);
        console.log('Number of customers found:', Array.isArray(result) ? result.length : 0);
        
        // Check if result is valid
        if (!Array.isArray(result)) {
            console.error('Query result is not an array:', typeof result);
            return res.status(500).send('Database error');
        }
        
        console.log('Rendering template with customers:', result.length);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM customers c
            WHERE 1=1
        `;
        
        const countParams: any[] = [];
        
        if (status) {
            countQuery += ` AND c.status = ?`;
            countParams.push(status);
        }
        
        if (odc_id) {
            countQuery += ` AND c.odc_id = ?`;
            countParams.push(odc_id);
        }
        
        if (billing_mode) {
            countQuery += ` AND c.billing_mode = ?`;
            countParams.push(billing_mode);
        }
        
        if (search) {
            countQuery += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        const [countResult] = await databasePool.query(countQuery, countParams);
        const total = parseInt((countResult as any)[0].total);
        
        // Get statistics
        let totalActive = 0;
        let totalInactive = 0;
        
        try {
            const [activeStats] = await databasePool.query('SELECT COUNT(*) as total FROM customers WHERE status = "active"');
            totalActive = parseInt((activeStats as any)[0].total);
        } catch (statError) {
            console.error('Error getting active stats:', statError);
        }
        
        try {
            const [inactiveStats] = await databasePool.query('SELECT COUNT(*) as total FROM customers WHERE status = "inactive"');
            totalInactive = parseInt((inactiveStats as any)[0].total);
        } catch (statError) {
            console.error('Error getting inactive stats:', statError);
        }
        
        console.log('About to render template with:');
        console.log('- customers:', result.length);
        console.log('- total:', total);
        console.log('- page:', page);
        console.log('- totalActive:', totalActive);
        console.log('- totalInactive:', totalInactive);
        
        // Validate data before rendering
        if (!Array.isArray(result)) {
            console.error('Result is not an array:', typeof result);
            throw new Error('Database result is not an array');
        }
        
        console.log('Rendering customers/list template...');
        
        res.render('customers/list', {
            title: 'Daftar Pelanggan',
            customers: result,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            },
            statistics: {
                totalActive,
                totalInactive
            },
            filters: { status, odc_id, search, billing_mode }
        });
        
    } catch (error: any) {
        console.error('Error getting customer list:', error);
        console.error('Error details:', error?.message || 'Unknown error');
        console.error('Error stack:', error?.stack || 'No stack trace');
        
        res.status(500).render('customers/list', {
            title: 'Daftar Pelanggan',
            customers: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            statistics: { totalActive: 0, totalInactive: 0 },
            filters: {},
            error: 'Gagal memuat data pelanggan: ' + (error?.message || 'Unknown error')
        });
    }
};

export const getCustomerDetail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // Validasi ID parameter
        if (!id || isNaN(Number(id))) {
            req.flash('error', 'ID pelanggan tidak valid');
            return res.redirect('/customers/list');
        }
        
        console.log(`Mencoba memuat detail pelanggan dengan ID: ${id}`);
        
        // Query dasar untuk mendapatkan data customer
        const customerQuery = `
            SELECT c.*, 
                   ftth_odc.name as odc_name
            FROM customers c
            LEFT JOIN ftth_odc ON c.odc_id = ftth_odc.id
            WHERE c.id = ?
        `;
        
        console.log('Executing customer query...');
        const [customerResult] = await databasePool.execute(customerQuery, [id]);
        const customer = (customerResult as any)[0];
        
        if (!customer) {
            console.log(`Customer dengan ID ${id} tidak ditemukan`);
            req.flash('error', 'Pelanggan tidak ditemukan');
            return res.redirect('/customers/list');
        }
        
        console.log(`Customer ditemukan: ${customer.name}`);
        
        // Coba mendapatkan data tambahan jika ada
        let additionalData: {
            odp_name?: string;
            olt_name?: string;
            pppoe_package_name?: string;
            static_ip_package_name?: string;
        } = {};
        
        try {
            // Cek apakah ada data ODP
            if (customer.odp_id) {
                const odpQuery = `SELECT name FROM ftth_odp WHERE id = ?`;
                const [odpResult] = await databasePool.execute(odpQuery, [customer.odp_id]);
                if (odpResult && (odpResult as any).length > 0) {
                    additionalData.odp_name = (odpResult as any)[0].name;
                }
            }
            
            // Cek apakah ada data OLT
            if (customer.odc_id) {
                const oltQuery = `
                    SELECT ftth_olt.name as olt_name 
                    FROM ftth_olt 
                    JOIN ftth_odc ON ftth_olt.id = ftth_odc.olt_id 
                    WHERE ftth_odc.id = ?
                `;
                const [oltResult] = await databasePool.execute(oltQuery, [customer.odc_id]);
                if (oltResult && (oltResult as any).length > 0) {
                    additionalData.olt_name = (oltResult as any)[0].olt_name;
                }
            }
            
            // Cek package berdasarkan connection type
            if (customer.connection_type === 'pppoe' && customer.package_id) {
                const pppoeQuery = `SELECT name FROM pppoe_packages WHERE id = ?`;
                const [pppoeResult] = await databasePool.execute(pppoeQuery, [customer.package_id]);
                if (pppoeResult && (pppoeResult as any).length > 0) {
                    additionalData.pppoe_package_name = (pppoeResult as any)[0].name;
                }
            }
            
            if (customer.connection_type === 'static_ip' && customer.package_id) {
                const staticIpQuery = `SELECT name FROM static_ip_packages WHERE id = ?`;
                const [staticIpResult] = await databasePool.execute(staticIpQuery, [customer.package_id]);
                if (staticIpResult && (staticIpResult as any).length > 0) {
                    additionalData.static_ip_package_name = (staticIpResult as any)[0].name;
                }
            }
        } catch (additionalError) {
            console.warn('Warning: Gagal memuat data tambahan:', additionalError);
            // Lanjutkan tanpa data tambahan
        }
        
        // Gabungkan data customer dengan data tambahan
        const customerWithAdditionalData = { ...customer, ...additionalData };
        
        // Get customer invoices
        console.log('Mencoba memuat invoice...');
        let invoices = [];
        try {
            const invoiceQuery = `
                SELECT * FROM invoices 
                WHERE customer_id = ? 
                ORDER BY created_at DESC
            `;
            const [invoiceResult] = await databasePool.execute(invoiceQuery, [id]);
            invoices = invoiceResult as any[];
            console.log(`Ditemukan ${invoices.length} invoice`);
        } catch (invoiceError) {
            console.warn('Warning: Gagal memuat invoice:', invoiceError);
            // Lanjutkan tanpa invoice
        }
        
        console.log('Rendering customer detail page...');
        res.render('customers/detail', {
            title: 'Detail Pelanggan',
            customer: customerWithAdditionalData,
            invoices
        });
        
    } catch (error: any) {
        console.error('Error getting customer detail:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno
        });
        req.flash('error', `Gagal memuat detail pelanggan: ${error.message}`);
        res.redirect('/customers/list');
    }
};

export const getCustomerEdit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const query = `SELECT * FROM customers WHERE id = ?`;
        const [result] = await databasePool.execute(query, [id]);
        const customer = (result as any)[0];
        
        if (!customer) {
            req.flash('error', 'Pelanggan tidak ditemukan');
            return res.redirect('/customers/list');
        }
        
        // Get static IP data if customer has static IP connection
        let staticIpData = null;
        if (customer.connection_type === 'static_ip') {
            const staticIpQuery = `SELECT * FROM static_ip_clients WHERE customer_id = ?`;
            const [staticIpResult] = await databasePool.execute(staticIpQuery, [id]);
            staticIpData = (staticIpResult as any)[0];
        }
        
        // Get available packages based on connection type
        let packages = [];
        if (customer.connection_type === 'static_ip') {
            const [staticPackages] = await databasePool.execute(
                'SELECT id, name, price, max_limit_upload, max_limit_download FROM static_ip_packages WHERE status = "active" ORDER BY name'
            );
            packages = staticPackages as any[];
        } else {
            const [pppoePackages] = await databasePool.execute(
                'SELECT id, name, price, rate_limit_rx, rate_limit_tx FROM pppoe_packages WHERE status = "active" ORDER BY name'
            );
            packages = pppoePackages as any[];
        }
        
        // Merge static IP data with customer data
        const customerWithStaticIp = {
            ...customer,
            ...(staticIpData && {
                ip_address: staticIpData.ip_address,
                interface: staticIpData.interface,
                gateway: staticIpData.gateway,
                package_id: staticIpData.package_id
            })
        };
        
        res.render('customers/edit', {
            title: 'Edit Pelanggan',
            customer: customerWithStaticIp,
            packages: packages
        });
        
    } catch (error) {
        console.error('Error getting customer edit form:', error);
        req.flash('error', 'Gagal memuat form edit pelanggan');
        res.redirect('/customers/list');
    }
};

export const postCustomerUpdate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { 
            name, phone, email, address, customer_code, connection_type, status, 
            latitude, longitude, pppoe_username, pppoe_password, pppoe_profile_id,
            ip_address, interface: interface_name, gateway, pppoe_package, static_ip_package
        } = req.body;
        
        // Build dynamic query based on connection type
        let query = `
            UPDATE customers 
            SET name = ?, phone = ?, email = ?, address = ?, customer_code = ?, 
                connection_type = ?, status = ?, latitude = ?, longitude = ?, updated_at = NOW()
        `;
        
        let params = [
            name, phone, email, address, customer_code, 
            connection_type, status, latitude || null, longitude || null
        ];
        
        // Add PPPOE specific fields if connection type is pppoe
        if (connection_type === 'pppoe') {
            query += `, pppoe_username = ?, pppoe_profile_id = ?`;
            params.push(pppoe_username || null, pppoe_profile_id || null);
        } else if (connection_type === 'static_ip') {
            // For static IP, we might need to update related tables
            // For now, we'll just clear PPPOE fields
            query += `, pppoe_username = NULL, pppoe_profile_id = NULL`;
        }
        
        query += ` WHERE id = ?`;
        params.push(id);
        
        await databasePool.execute(query, params);
        
        // Update MikroTik if PPPoE credentials changed
        if (connection_type === 'pppoe' && pppoe_username && pppoe_password) {
            try {
                const cfg = await getMikrotikConfig();
                if (cfg) {
                    const mikrotik = new MikrotikService({
                        host: cfg.host,
                        username: cfg.username,
                        password: cfg.password,
                        port: cfg.port || 8728
                    });
                    
                    // Try to get existing user
                    const existingUser = await mikrotik.getPPPoEUserByUsername(pppoe_username);
                    
                    if (existingUser && existingUser['.id']) {
                        // Update existing user
                        console.log(`🔄 Updating PPPoE user in MikroTik: ${pppoe_username}`);
                        const updateSuccess = await mikrotik.updatePPPoEUserByUsername(pppoe_username, {
                            password: pppoe_password
                        });
                        if (updateSuccess) {
                            console.log(`✅ PPPoE user updated in MikroTik`);
                        } else {
                            console.error(`❌ Failed to update PPPoE user in MikroTik`);
                        }
                    } else {
                        // User doesn't exist in MikroTik, create new one
                        console.log(`➕ Creating new PPPoE user in MikroTik: ${pppoe_username}`);
                        const createSuccess = await mikrotik.createPPPoEUser({
                            name: pppoe_username,
                            password: pppoe_password,
                            profile: 'default'
                        });
                        if (createSuccess) {
                            console.log(`✅ PPPoE user created in MikroTik`);
                        } else {
                            console.error(`❌ Failed to create PPPoE user in MikroTik`);
                        }
                    }
                }
            } catch (mkError: any) {
                console.error('⚠️ MikroTik update error:', mkError.message);
            }
        }
        
        // If static IP, we might need to update static_ip_clients table
        if (connection_type === 'static_ip' && ip_address) {
            // Check if static IP client exists
            const [existingClient] = await databasePool.execute(
                'SELECT id FROM static_ip_clients WHERE customer_id = ?', 
                [id]
            );
            
            if ((existingClient as any).length > 0) {
                // Update existing static IP client
                await databasePool.execute(
                    'UPDATE static_ip_clients SET ip_address = ?, interface = ?, gateway = ? WHERE customer_id = ?',
                    [ip_address, interface_name, gateway || null, id]
                );
            } else {
                // Create new static IP client
                await databasePool.execute(
                    'INSERT INTO static_ip_clients (customer_id, ip_address, interface, gateway, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [id, ip_address, interface_name, gateway || null]
                );
            }
        }
        
        req.flash('success', 'Pelanggan berhasil diperbarui');
        res.redirect('/customers/list');
        
    } catch (error) {
        console.error('Error updating customer:', error);
        req.flash('error', 'Gagal memperbarui pelanggan');
        res.redirect(`/customers/${req.params.id}/edit`);
    }
};

export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // Check if customer exists and get details
        const [customerResult] = await databasePool.execute(
            'SELECT id, name, connection_type, pppoe_username, ip_address FROM customers WHERE id = ?', 
            [id]
        );
        
        if ((customerResult as any).length === 0) {
            if (req.xhr || req.headers['content-type'] === 'application/json' || (req.headers.accept || '').includes('application/json')) {
                return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan' });
            }
            req.flash('error', 'Pelanggan tidak ditemukan');
            return res.redirect('/customers/list');
        }
        
        const customer = (customerResult as any)[0];
        
        // Check if customer has active invoices
        const [invoiceResult] = await databasePool.execute(
            'SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status IN ("sent", "partial", "overdue")',
            [id]
        );
        
        const invoiceCount = (invoiceResult as any)[0].count;
        if (invoiceCount > 0) {
            if (req.xhr || req.headers['content-type'] === 'application/json' || (req.headers.accept || '').includes('application/json')) {
                return res.status(400).json({ success: false, error: 'Tidak dapat menghapus pelanggan yang memiliki tagihan aktif' });
            }
            req.flash('error', 'Tidak dapat menghapus pelanggan yang memiliki tagihan aktif');
            return res.redirect('/customers/list');
        }
        
        // Delete from MikroTik if connection exists
        try {
            const cfg = await getMikrotikConfig();
            if (cfg) {
                const mikrotik = new MikrotikService({
                    host: cfg.host,
                    username: cfg.username,
                    password: cfg.password,
                    port: cfg.port || 8728
                });
                
                // Delete PPPoE user if exists
                if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                    console.log(`🗑️ Deleting PPPoE user from MikroTik: ${customer.pppoe_username}`);
                    try {
                        // Find user by username first
                        const user = await mikrotik.getPPPoEUserByUsername(customer.pppoe_username);
                        if (user && user['.id']) {
                            await mikrotik.deletePPPoEUser(user['.id']);
                            console.log(`✅ PPPoE user deleted from MikroTik`);
                        } else {
                            console.log(`⚠️ PPPoE user not found in MikroTik: ${customer.pppoe_username}`);
                        }
                    } catch (mkError: any) {
                        console.error('⚠️ Failed to delete PPPoE user from MikroTik:', mkError.message);
                        // Continue with database deletion even if MikroTik deletion fails
                    }
                }
                
                // Note: Static IP deletion is handled in staticIpClientController
                if (customer.connection_type === 'static_ip') {
                    console.log('⚠️ Static IP customer - deletion handled by staticIpClientController');
                }
            }
        } catch (mkError: any) {
            console.error('⚠️ MikroTik deletion error:', mkError.message);
            // Continue with database deletion even if MikroTik deletion fails
        }
        
        // Delete customer from database
        await databasePool.execute('DELETE FROM customers WHERE id = ?', [id]);
        
        if (req.xhr || req.headers['content-type'] === 'application/json' || (req.headers.accept || '').includes('application/json')) {
            return res.json({ success: true });
        }
        req.flash('success', 'Pelanggan berhasil dihapus');
        res.redirect('/customers/list');
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        if (req.xhr || req.headers['content-type'] === 'application/json' || (req.headers.accept || '').includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Gagal menghapus pelanggan' });
        }
        req.flash('error', 'Gagal menghapus pelanggan');
        res.redirect('/customers/list');
    }
};

export const bulkDeleteCustomers = async (req: Request, res: Response) => {
    try {
        console.log('🗑️ Bulk delete request received:', req.body);
        
        const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((v: any) => parseInt(v, 10)).filter((n: number) => !Number.isNaN(n)) : [];
        console.log('📋 Parsed IDs:', ids);
        
        if (!ids.length) {
            console.error('❌ No valid IDs provided');
            return res.status(400).json({ success: false, error: 'Daftar ID tidak valid' });
        }

        const results = {
            deleted: [] as number[],
            skipped: [] as { id: number; reason: string }[]
        };

        for (const id of ids) {
            try {
                console.log(`\n🔍 Processing customer ID: ${id}`);
                
                // Check if customer exists
                const [customerResult] = await databasePool.execute('SELECT id, name, connection_type, pppoe_username, ip_address FROM customers WHERE id = ?', [id]);
                if ((customerResult as any).length === 0) {
                    console.log(`   ❌ Customer ${id} not found`);
                    results.skipped.push({ id, reason: 'Tidak ditemukan' });
                    continue;
                }
                
                const customer = (customerResult as any)[0];
                console.log(`   ✅ Customer found: ${customer.name}`);

                // Check for active invoices
                const [invoiceResult] = await databasePool.execute(
                    'SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status IN ("sent", "partial", "overdue")',
                    [id]
                );
                const invoiceCount = (invoiceResult as any)[0].count;
                if (invoiceCount > 0) {
                    console.log(`   ⚠️  Customer ${id} has ${invoiceCount} active invoice(s)`);
                    results.skipped.push({ id, reason: 'Memiliki tagihan aktif' });
                    continue;
                }

                // Check for related records
                const [subscriptionResult] = await databasePool.execute(
                    'SELECT COUNT(*) as count FROM subscriptions WHERE customer_id = ?',
                    [id]
                );
                const subscriptionCount = (subscriptionResult as any)[0].count;
                if (subscriptionCount > 0) {
                    console.log(`   ⚠️  Customer ${id} has ${subscriptionCount} active subscription(s)`);
                    results.skipped.push({ id, reason: 'Memiliki subscription aktif' });
                    continue;
                }

                // Check for static IP clients
                const [staticIpResult] = await databasePool.execute(
                    'SELECT COUNT(*) as count FROM static_ip_clients WHERE customer_id = ?',
                    [id]
                );
                const staticIpCount = (staticIpResult as any)[0].count;
                if (staticIpCount > 0) {
                    console.log(`   ⚠️  Customer ${id} has static IP configuration`);
                    results.skipped.push({ id, reason: 'Memiliki konfigurasi IP Static' });
                    continue;
                }

                // Check for portal customers
                const [portalResult] = await databasePool.execute(
                    'SELECT COUNT(*) as count FROM portal_customers WHERE customer_id = ?',
                    [id]
                );
                const portalCount = (portalResult as any)[0].count;
                if (portalCount > 0) {
                    console.log(`   ⚠️  Customer ${id} has portal account`);
                    results.skipped.push({ id, reason: 'Memiliki akun portal' });
                    continue;
                }

                // Delete from MikroTik if connection exists
                try {
                    const cfg = await getMikrotikConfig();
                    if (cfg) {
                        const mikrotik = new MikrotikService({
                            host: cfg.host,
                            username: cfg.username,
                            password: cfg.password,
                            port: cfg.port || 8728
                        });
                        
                        // Delete PPPoE user if exists
                        if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                            console.log(`   🗑️ Deleting PPPoE user from MikroTik: ${customer.pppoe_username}`);
                            try {
                                const user = await mikrotik.getPPPoEUserByUsername(customer.pppoe_username);
                                if (user && user['.id']) {
                                    await mikrotik.deletePPPoEUser(user['.id']);
                                    console.log(`   ✅ PPPoE user deleted from MikroTik`);
                                } else {
                                    console.log(`   ⚠️ PPPoE user not found in MikroTik`);
                                }
                            } catch (mkError: any) {
                                console.error(`   ⚠️ Failed to delete PPPoE user from MikroTik:`, mkError.message);
                            }
                        }
                        
                        // Static IP deletion handled separately
                        if (customer.connection_type === 'static_ip') {
                            console.log(`   ⚠️ Static IP customer - deletion handled by staticIpClientController`);
                        }
                    }
                } catch (mkError: any) {
                    console.error(`   ⚠️ MikroTik deletion error:`, mkError.message);
                }
                
                // Delete customer from database
                console.log(`   🗑️  Attempting to delete customer ${id}...`);
                await databasePool.execute('DELETE FROM customers WHERE id = ?', [id]);
                console.log(`   ✅ Customer ${id} deleted successfully`);
                results.deleted.push(id);
                
            } catch (innerErr: any) {
                console.error(`   ❌ Error deleting customer ${id}:`, innerErr.message);
                results.skipped.push({ id, reason: `Gagal menghapus: ${innerErr.message || 'Unknown error'}` });
            }
        }

        console.log(`\n📊 Bulk delete completed: ${results.deleted.length} deleted, ${results.skipped.length} skipped`);
        return res.json({ success: true, results });
        
    } catch (error: any) {
        console.error('❌ Error bulk deleting customers:', error);
        return res.status(500).json({ success: false, error: `Gagal melakukan hapus massal: ${error.message || 'Unknown error'}` });
    }
};

export const exportCustomersToExcel = async (req: Request, res: Response) => {
    try {
        const { status, odc_id, search } = req.query;
        
        let query = `
            SELECT c.id, c.name, c.phone, c.email, c.address, c.customer_code,
                   c.connection_type, c.status, c.latitude, c.longitude,
                   c.pppoe_username, c.created_at, c.updated_at,
                   ftth_odc.name as odc_name,
                   (SELECT COUNT(*) FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status IN ('sent', 'partial', 'overdue')) as overdue_invoices,
                   (SELECT SUM(i.remaining_amount) FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status IN ('sent', 'partial', 'overdue')) as total_debt
            FROM customers c
            LEFT JOIN ftth_odc ON c.odc_id = ftth_odc.id
            WHERE 1=1
        `;
        
        const params: any[] = [];
        
        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        
        if (odc_id) {
            query += ` AND c.odc_id = ?`;
            params.push(odc_id);
        }
        
        if (search) {
            query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += ` ORDER BY c.created_at DESC`;
        
        const [result] = await databasePool.query(query, params);
        const customers = result as any[];
        
        // Prepare data for Excel
        const excelData = customers.map(customer => ({
            'Kode Pelanggan': customer.customer_code || '',
            'Nama': customer.name,
            'Email': customer.email || '',
            'Telepon': customer.phone || '',
            'Alamat': customer.address || '',
            'Tipe Koneksi': customer.connection_type === 'pppoe' ? 'PPPOE' : 
                           customer.connection_type === 'static_ip' ? 'IP Static' : 'PPPOE',
            'Status': customer.status === 'active' ? 'Aktif' : 'Tidak Aktif',
            'ODC': customer.odc_name || '',
            'PPPoE Username': customer.pppoe_username || '',
            'Latitude': customer.latitude || '',
            'Longitude': customer.longitude || '',
            'Tagihan Tertunda': customer.overdue_invoices || 0,
            'Total Hutang': customer.total_debt || 0,
            'Tanggal Dibuat': customer.created_at ? new Date(customer.created_at).toLocaleDateString('id-ID') : '',
            'Tanggal Diupdate': customer.updated_at ? new Date(customer.updated_at).toLocaleDateString('id-ID') : ''
        }));
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        const columnWidths = [
            { wch: 15 },  // Kode Pelanggan
            { wch: 25 },  // Nama
            { wch: 30 },  // Email
            { wch: 15 },  // Telepon
            { wch: 40 },  // Alamat
            { wch: 12 },  // Tipe Koneksi
            { wch: 12 },  // Status
            { wch: 20 },  // ODC
            { wch: 20 },  // PPPoE Username
            { wch: 12 },  // Latitude
            { wch: 12 },  // Longitude
            { wch: 15 },  // Tagihan Tertunda
            { wch: 15 },  // Total Hutang
            { wch: 15 },  // Tanggal Dibuat
            { wch: 15 }   // Tanggal Diupdate
        ];
        worksheet['!cols'] = columnWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pelanggan');
        
        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        const filename = `data_pelanggan_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Error exporting customers to Excel:', error);
        res.status(500).json({ error: 'Gagal mengexport data pelanggan' });
    }
};

export const downloadExcelTemplate = async (req: Request, res: Response) => {
    try {
        // Create template data
        const templateData = [
            {
                'ID': 'AUTO',
                'Kode Pelanggan': '20250121120000',
                'Nama': 'John Doe',
                'Email': 'john@example.com',
                'Telepon': '081234567890',
                'Alamat': 'Jl. Contoh No. 123',
                'Tipe Koneksi': 'PPPOE',
                'Status': 'Aktif',
                'ODC': 'ODC-001',
                'PPPoE Username': 'john.doe',
                'Latitude': '-6.200000',
                'Longitude': '106.816666',
                'Tagihan Tertunda': '0',
                'Total Hutang': '0',
                'Tanggal Dibuat': '',
                'Tanggal Diupdate': ''
            }
        ];
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        
        // Set column widths
        const columnWidths = [
            { wch: 8 },   // ID
            { wch: 15 },  // Kode Pelanggan
            { wch: 25 },  // Nama
            { wch: 30 },  // Email
            { wch: 15 },  // Telepon
            { wch: 40 },  // Alamat
            { wch: 12 },  // Tipe Koneksi
            { wch: 12 },  // Status
            { wch: 20 },  // ODC
            { wch: 20 },  // PPPoE Username
            { wch: 12 },  // Latitude
            { wch: 12 },  // Longitude
            { wch: 15 },  // Tagihan Tertunda
            { wch: 15 },  // Total Hutang
            { wch: 15 },  // Tanggal Dibuat
            { wch: 15 }   // Tanggal Diupdate
        ];
        worksheet['!cols'] = columnWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Import');
        
        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Set headers for download
        const filename = `template_import_pelanggan.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Error downloading Excel template:', error);
        res.status(500).json({ error: 'Gagal mengunduh template Excel' });
    }
};

export const importCustomersFromExcel = async (req: Request, res: Response) => {
    try {
        console.log('📥 importCustomersFromExcel started');
        console.log('Request file:', req.file ? 'File present' : 'No file');
        
        if (!req.file) {
            console.error('❌ No file in request');
            return res.status(400).json({ 
                success: false,
                error: 'File Excel tidak ditemukan' 
            });
        }
        
        console.log('📄 File details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            bufferLength: req.file.buffer?.length
        });
        
        // Read Excel file with error handling
        let workbook;
        try {
            workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            console.log('✅ Excel file read successfully');
        } catch (xlsxError) {
            console.error('❌ XLSX read error:', xlsxError);
            return res.status(400).json({ 
                success: false,
                error: 'File Excel tidak valid atau corrupt' 
            });
        }
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('Nama sheet tidak ditemukan pada file Excel');
        }
        const worksheet = workbook.Sheets[String(sheetName)];
        if (!worksheet) {
            throw new Error('Worksheet tidak ditemukan');
        }
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`📊 Found ${jsonData.length} rows in Excel`);
        
        if (jsonData.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'File Excel kosong atau tidak valid' 
            });
        }
        
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };
        
        // Process each row
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as any;
            const rowNumber = i + 2; // +2 because Excel starts from row 1 and we skip header
            
            try {
                console.log(`\n📝 Processing row ${rowNumber}:`, {
                    'Nama': row['Nama'] || 'EMPTY',
                    'Telepon': row['Telepon'] || 'EMPTY',
                    'Alamat': row['Alamat'] || 'EMPTY',
                    'All keys in Excel': Object.keys(row).join(', ')
                });
                
                // Validate required fields - SIMPLE FORMAT: Nama, Telepon, Alamat
                if (!row['Nama']) {
                    const error = `Kolom "Nama" kosong atau tidak ditemukan`;
                    console.log(`  ❌ Validation failed: ${error}`);
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: ${error}`);
                    continue;
                }
                
                if (!row['Telepon']) {
                    const error = `Kolom "Telepon" kosong atau tidak ditemukan`;
                    console.log(`  ❌ Validation failed: ${error}`);
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: ${error}`);
                    continue;
                }
                
                console.log(`  ✅ Validation passed: Nama dan Telepon OK`);
                
                // Clean phone number (remove spaces, dashes, dots)
                const cleanPhone = String(row['Telepon']).replace(/[\s\-.]/g, '');
                console.log(`  🔍 Checking phone: "${row['Telepon']}" -> "${cleanPhone}"`);
                
                // Check if customer already exists by phone (cleaned)
                const [existingCustomer] = await databasePool.execute(
                    'SELECT id, name FROM customers WHERE phone = ? OR phone = ?',
                    [row['Telepon'], cleanPhone]
                );
                
                if ((existingCustomer as any).length > 0) {
                    const existingName = (existingCustomer as any)[0].name;
                    const error = `Pelanggan dengan telepon "${row['Telepon']}" sudah ada atas nama "${existingName}"`;
                    console.log(`  ❌ Duplicate phone: ${error}`);
                    results.failed++;
                    results.errors.push(`Baris ${rowNumber}: ${error}`);
                    continue;
                }
                console.log(`  ✅ Phone OK - No duplicate found`);
                
                // Insert customer - SIMPLE FORMAT (hanya 3 field utama)
                // Generate safe default customer_code to satisfy NOT NULL constraints on some servers
                const generatedCode = CustomerIdGenerator.generateCustomerId();
                const insertQuery = `
                    INSERT INTO customers (
                        name, phone, address, email, customer_code, 
                        connection_type, status, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 'pppoe', 'inactive', NOW(), NOW())
                `;
                
                console.log(`  💾 Inserting customer (SIMPLE):`, {
                    name: row['Nama'],
                    phone: cleanPhone,
                    address: row['Alamat'] || '(kosong)'
                });
                
                await databasePool.execute(insertQuery, [
                    row['Nama'],
                    cleanPhone, // Use cleaned phone
                    row['Alamat'] || '',
                    row['Email'] || '', // gunakan string kosong jika tidak ada email
                    generatedCode       // isi customer_code agar tidak null pada server live
                ]);
                
                results.success++;
                console.log(`  ✅ SUCCESS: Row ${rowNumber} imported!`);
                
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Error tidak diketahui';
                console.log(`  ❌ ERROR at row ${rowNumber}:`, errorMsg);
                results.failed++;
                results.errors.push(`Baris ${rowNumber}: ${errorMsg}`);
            }
        }
        
        console.log(`\n📊 Import completed: ${results.success} success, ${results.failed} failed`);
        if (results.errors.length > 0) {
            console.log(`📋 Errors:`, results.errors);
        }
        
        res.json({
            success: true,
            message: `Import selesai. Berhasil: ${results.success}, Gagal: ${results.failed}`,
            totalRows: jsonData.length,
            details: results
        });
        
    } catch (error) {
        console.error('❌ Error importing customers from Excel:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ 
            success: false,
            error: 'Gagal mengimport data pelanggan: ' + errorMessage 
        });
    }
};

// =======================
// MIGRATION ENDPOINTS
// =======================

/**
 * Migrasi customer dari Postpaid ke Prepaid
 */
export const migrateToPrepaid = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req.session as any)?.userId;
        
        const result = await MigrationService.migrateToPrepaid(parseInt(id), adminId);
        
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                portal_id: result.portal_id,
                portal_pin: result.portal_pin
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error || result.message
            });
        }
    } catch (error) {
        console.error('Error in migrate to prepaid endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat migrasi'
        });
    }
};

/**
 * Migrasi customer dari Prepaid ke Postpaid
 */
export const migrateToPostpaid = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req.session as any)?.userId;
        
        const result = await MigrationService.migrateToPostpaid(parseInt(id), adminId);
        
        if (result.success) {
            return res.json({
                success: true,
                message: result.message
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error || result.message
            });
        }
    } catch (error) {
        console.error('Error in migrate to postpaid endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat migrasi'
        });
    }
};

/**
 * Get migration history
 */
export const getMigrationHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const history = await MigrationService.getMigrationHistory(parseInt(id));
        
        return res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('Error getting migration history:', error);
        return res.status(500).json({
            success: false,
            error: 'Gagal memuat riwayat migrasi'
        });
    }
};
