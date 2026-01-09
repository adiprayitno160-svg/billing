import { Request, Response } from 'express';
import { StaticIpImportService } from '../services/mikrotik/StaticIpImportService';
import { databasePool } from '../db/pool';
import { listStaticIpPackages } from '../services/staticIpPackageService';

const importService = new StaticIpImportService();

export class StaticIpImportController {

    // Render halaman Import (Tabel Massal - Mode Lama)
    async renderPage(req: Request, res: Response) {
        try {
            const [customers] = await databasePool.execute(`
                SELECT id, name, customer_code 
                FROM customers 
                WHERE status = 'active'
                ORDER BY name ASC
            `);

            const packages = await listStaticIpPackages();

            res.render('settings/import-static-ip', {
                title: 'Import Static IP MikroTik',
                user: req.user,
                customers: customers,
                packages: packages,
                layout: 'layouts/main'
            });
        } catch (error) {
            console.error('Error rendering import page:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    }

    // API: Scan Candidates dari MikroTik
    async scan(req: Request, res: Response) {
        try {
            const candidates = await importService.scanCandidates();

            // Tandai kandidat yang sudah terdaftar di DB (berdasarkan IP)
            const [existingClients] = await databasePool.execute('SELECT ip_address FROM static_ip_clients');
            const registeredIps = new Set((existingClients as any[]).map(c => c.ip_address));

            const processedCandidates = candidates.map(c => ({
                ...c,
                isRegistered: c.ipAddress ? registeredIps.has(c.ipAddress) : false
            }));

            res.json({ success: true, data: processedCandidates });
        } catch (error) {
            console.error('Scan error:', error);
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Scan failed' });
        }
    }

    // API: Link Customer yang Sudah Ada ke Queue MikroTik
    async linkCustomer(req: Request, res: Response) {
        const { queueId, mangleId, ipAddress, customerId, packageId } = req.body;

        if (!queueId || !ipAddress || !customerId || !packageId) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Ambil Data Customer & Paket
            const [custRows] = await conn.execute('SELECT name, customer_code FROM customers WHERE id = ?', [customerId]);
            const customer = (custRows as any)[0];

            const [pkgRows] = await conn.execute('SELECT name, max_limit_download as max_limit FROM static_ip_packages WHERE id = ?', [packageId]);
            const pkg = (pkgRows as any)[0];

            if (!customer || !pkg) throw new Error('Customer atau Paket tidak valid');

            // 2. Insert ke tabel static_ip_clients (jika belum ada)
            const [exist] = await conn.execute('SELECT id FROM static_ip_clients WHERE ip_address = ?', [ipAddress]);
            if ((exist as any[]).length > 0) {
                console.log(`IP ${ipAddress} sudah ada di DB, melakukan update sync saja.`);
            } else {
                await conn.execute(`
                    INSERT INTO static_ip_clients 
                    (package_id, client_name, ip_address, customer_id, customer_code, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())
                `, [packageId, customer.name, ipAddress, customerId, customer.customer_code]);
            }

            // 3. Update MikroTik (Standardize Name & Limit)
            const uniqueSuffix = customer.customer_code.slice(-4);
            const cleanName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
            const newMikrotikName = `${cleanName}_${uniqueSuffix}`;

            await importService.renameQueue(queueId, newMikrotikName, pkg.max_limit);

            if (mangleId) {
                await importService.tagMangle(mangleId, `[BILLING] ${newMikrotikName}`);
            }

            await conn.commit();
            res.json({ success: true, message: 'Berhasil ditautkan dan disinkronisasi' });

        } catch (error) {
            await conn.rollback();
            console.error('Link error:', error);
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Link failed' });
        } finally {
            conn.release();
        }
    }

    // Render Halaman Form Import (Adopsi Pelanggan Baru)
    async renderFormImport(req: Request, res: Response) {
        try {
            const packages = await listStaticIpPackages();

            res.render('customers/import_mikrotik', {
                title: 'Import Pelanggan dari MikroTik',
                user: req.user,
                packages: packages,
                layout: 'layouts/main'
            });
        } catch (error) {
            console.error('Error rendering import form:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    }

    // API: Create New Customer & Link (Adopsi)
    async createAndLink(req: Request, res: Response) {
        const { queueId, mangleId, name, phone, address, ipAddress, packageId, gatewayIp, gatewayIpId, interface: iface } = req.body;

        if (!queueId || !ipAddress || !name || !packageId) {
            return res.status(400).json({ success: false, message: 'Data wajib diisi (Nama, IP, Paket)' });
        }

        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Generate Customer Code (Format: CUST + Timestamp + Random)
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const customerCode = `CUST${timestamp}${random}`;

            // 2. Insert Customer Baru (dengan gateway info)
            const [custResult] = await conn.execute(`
                INSERT INTO customers (
                    customer_code, name, phone, address, ip_address,
                    gateway_ip, gateway_ip_id, interface,
                    connection_type, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'static_ip', 'active', NOW(), NOW())
            `, [customerCode, name, phone || null, address || null, ipAddress,
                gatewayIp || null, gatewayIpId || null, iface || null]);

            const newCustomerId = (custResult as any).insertId;
            console.log(`[Import] Customer Created ID: ${newCustomerId}, Code: ${customerCode}`);

            // 3. Get Package Limit
            const [pkgRows] = await conn.execute('SELECT max_limit_download as max_limit FROM static_ip_packages WHERE id = ?', [packageId]);
            const pkgLimit = (pkgRows as any)[0]?.max_limit || '0M';

            // 4. Insert Static IP Client (dengan gateway info untuk isolir)
            await conn.execute(`
                INSERT INTO static_ip_clients 
                (package_id, client_name, ip_address, customer_id, customer_code, 
                 interface, gateway_ip, gateway_ip_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
            `, [packageId, name, ipAddress, newCustomerId, customerCode,
                iface || null, gatewayIp || null, gatewayIpId || null]);

            // 5. Update MikroTik (Standardize)
            const uniqueSuffix = customerCode.slice(-4);
            const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
            const newMikrotikName = `${cleanName}_${uniqueSuffix}`;

            const renameSuccess = await importService.renameQueue(queueId, newMikrotikName, pkgLimit);

            if (mangleId) {
                await importService.tagMangle(mangleId, `[CUST] ${newMikrotikName}`);
            }

            if (!renameSuccess) {
                throw new Error('Gagal update MikroTik. Transaksi dibatalkan.');
            }

            await conn.commit();
            res.json({ success: true, message: 'Pelanggan berhasil diadopsi!', customerId: newCustomerId });

        } catch (error) {
            await conn.rollback();
            console.error('Create-Link error:', error);
            res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Import gagal' });
        } finally {
            conn.release();
        }
    }
}
