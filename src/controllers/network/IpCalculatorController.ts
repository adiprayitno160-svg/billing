import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

function ip2long(ip: string): number {
    let parts = ip.split('.');
    return (parseInt(parts[0], 10) << 24) |
        (parseInt(parts[1], 10) << 16) |
        (parseInt(parts[2], 10) << 8) |
        parseInt(parts[3], 10);
}

function long2ip(long: number): string {
    return [
        (long >>> 24) & 0xff,
        (long >>> 16) & 0xff,
        (long >>> 8) & 0xff,
        long & 0xff
    ].join('.');
}

export class IpCalculatorController {
    static async renderPage(req: Request, res: Response) {
        try {
            // Get all static IP packages with their clients
            const [packages] = await databasePool.query<RowDataPacket[]>(`
                SELECT sp.id, sp.name, sp.price, sp.max_clients,
                       sp.max_limit_upload, sp.max_limit_download,
                       COUNT(sc.id) as used_clients
                FROM static_ip_packages sp
                LEFT JOIN static_ip_clients sc ON sp.id = sc.package_id AND sc.status = 'active'
                GROUP BY sp.id
                ORDER BY sp.name ASC
            `);

            // Get all static IP clients with customer info
            const [clients] = await databasePool.query<RowDataPacket[]>(`
                SELECT sc.id, sc.ip_address, sc.interface, sc.status as client_status,
                       sc.package_id, sc.customer_id,
                       c.name as customer_name, c.phone, c.address, c.status as customer_status,
                       sp.name as package_name
                FROM static_ip_clients sc
                LEFT JOIN customers c ON sc.customer_id = c.id
                LEFT JOIN static_ip_packages sp ON sc.package_id = sp.id
                ORDER BY sc.package_id, sc.ip_address
            `);

            // Get customers with static IP from customers table
            const [staticCustomers] = await databasePool.query<RowDataPacket[]>(`
                SELECT id, name, static_ip as static_ip_address, ip_address, phone as phone_number, address, status
                FROM customers
                WHERE connection_type = 'static_ip'
                   OR (static_ip IS NOT NULL AND static_ip != '')
                ORDER BY COALESCE(static_ip, ip_address)
            `);

            // Group clients by package
            const packageMap = new Map<number, any>();
            packages.forEach((pkg: any) => {
                packageMap.set(pkg.id, { ...pkg, clients: [] });
            });
            clients.forEach((client: any) => {
                const pkg = packageMap.get(client.package_id);
                if (pkg) pkg.clients.push(client);
            });

            // Get unique subnets
            const allSubnets = new Set<string>();
            clients.forEach((c: any) => {
                if (c.client_subnet) allSubnets.add(c.client_subnet);
            });

            // Load saved subnet tabs from settings
            let savedTabs: string[] = ['192.168.239'];
            try {
                const [tabRows] = await databasePool.query<RowDataPacket[]>(
                    "SELECT setting_value FROM settings WHERE setting_key = 'ip_checker_tabs'"
                );
                if (tabRows && tabRows.length > 0 && tabRows[0].setting_value) {
                    try { savedTabs = JSON.parse(tabRows[0].setting_value); } catch { }
                }
            } catch { }

            res.render('network/ip-calculator', {
                title: 'IP Address Checker',
                currentPath: req.path,
                user: (req as any).user,
                packages: Array.from(packageMap.values()),
                staticCustomers,
                savedSubnets: Array.from(allSubnets),
                savedTabs,
                totalClients: clients.length,
                totalPackages: packages.length
            });
        } catch (error: any) {
            console.error('Error rendering IP calculator page:', error?.message || error);
            res.render('network/ip-calculator', {
                title: 'DEBUG ERROR: ' + (error?.message || error),
                currentPath: req.path,
                user: (req as any).user,
                packages: [],
                staticCustomers: [],
                savedSubnets: [],
                savedTabs: ['192.168.239'],
                totalClients: 0,
                totalPackages: 0
            });
        }
    }

    /**
     * Scan subnet in /30 increments (client IPs: .2, .6, .10, .14, ... .254)
     */
    static async scanSubnet30(req: Request, res: Response) {
        try {
            const { baseNetwork } = req.body;
            if (!baseNetwork) {
                return res.status(400).json({ success: false, message: 'Base network diperlukan (contoh: 192.168.239)' });
            }

            const octets = baseNetwork.split('.');
            if (octets.length !== 3 || octets.some((o: string) => isNaN(parseInt(o)) || parseInt(o) < 0 || parseInt(o) > 255)) {
                return res.status(400).json({ success: false, message: 'Format network tidak valid. Contoh: 192.168.239' });
            }

            // Generate /30 IP list: client IPs are .2, .6, .10, .14, ..., .254
            const ips: { ip: string, ipWithCidr: string, gateway: string, subnet: string, status: 'available' | 'used', owner?: any }[] = [];

            for (let i = 2; i <= 254; i += 4) {
                const clientIp = `${baseNetwork}.${i}`;
                const gatewayIp = `${baseNetwork}.${i - 1}`;
                const networkIp = `${baseNetwork}.${i - 2}`;
                const broadcastIp = `${baseNetwork}.${i + 1}`;
                ips.push({
                    ip: clientIp,
                    ipWithCidr: `${clientIp}/30`,
                    gateway: gatewayIp,
                    subnet: `${networkIp}/30`,
                    status: 'available'
                });
            }

            // Fetch all static IP clients in this network range
            const [staticClients] = await databasePool.query<RowDataPacket[]>(`
                SELECT sc.ip_address, sc.client_name, c.name as customer_name, c.id as customer_id,
                       c.phone, c.status as customer_status, c.customer_code,
                       sp.name as package_name
                FROM static_ip_clients sc
                LEFT JOIN customers c ON sc.customer_id = c.id
                LEFT JOIN static_ip_packages sp ON sc.package_id = sp.id
                WHERE sc.ip_address LIKE ?
            `, [`${baseNetwork}.%`]);

            // Build IP-to-owner map
            const ownerMap = new Map<string, any>();
            staticClients.forEach((client: any) => {
                if (client.ip_address) {
                    const ipOnly = String(client.ip_address).split('/')[0];
                    ownerMap.set(ipOnly, {
                        customer_name: client.customer_name || client.client_name,
                        customer_id: client.customer_id,
                        customer_code: client.customer_code,
                        phone: client.phone,
                        customer_status: client.customer_status,
                        package_name: client.package_name,
                        raw_ip: client.ip_address
                    });
                }
            });

            // Also check customers table directly
            const [directCustomers] = await databasePool.query<RowDataPacket[]>(`
                SELECT id, name, customer_code, phone, status, ip_address, static_ip
                FROM customers
                WHERE (ip_address LIKE ? OR static_ip LIKE ?)
                AND connection_type = 'static_ip'
            `, [`${baseNetwork}.%`, `${baseNetwork}.%`]);

            directCustomers.forEach((cust: any) => {
                const checkIps = [cust.ip_address, cust.static_ip].filter(Boolean);
                checkIps.forEach((ip: string) => {
                    const ipOnly = String(ip).split('/')[0];
                    if (!ownerMap.has(ipOnly)) {
                        ownerMap.set(ipOnly, {
                            customer_name: cust.name,
                            customer_id: cust.id,
                            customer_code: cust.customer_code,
                            phone: cust.phone,
                            customer_status: cust.status,
                            package_name: '-',
                            raw_ip: ip
                        });
                    }
                });
            });

            // Fetch manual labels from ip_checker_manual_labels
            try {
                const [manualLabels] = await databasePool.query<RowDataPacket[]>(
                    `SELECT ip_address, label FROM ip_checker_manual_labels WHERE ip_address LIKE ?`,
                    [`${baseNetwork}.%`]
                );
                manualLabels.forEach((ml: any) => {
                    const ipOnly = String(ml.ip_address).split('/')[0].trim();
                    if (!ownerMap.has(ipOnly)) {
                        ownerMap.set(ipOnly, {
                            customer_name: ml.label,
                            customer_id: null,
                            customer_code: null,
                            phone: null,
                            customer_status: 'manual',
                            package_name: 'Manual',
                            raw_ip: ml.ip_address,
                            is_manual: true
                        });
                    }
                });
            } catch (e) {
                // Table might not exist yet, ignore
            }

            // Mark IPs as used
            let usedCount = 0;
            ips.forEach(item => {
                if (ownerMap.has(item.ip)) {
                    item.status = 'used';
                    item.owner = ownerMap.get(item.ip);
                    usedCount++;
                }
            });

            return res.json({
                success: true,
                data: {
                    baseNetwork,
                    totalSlots: ips.length,
                    usedCount,
                    availableCount: ips.length - usedCount,
                    ips
                }
            });
        } catch (error: any) {
            console.error('Scan /30 Error:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
        }
    }

    /**
     * Save a new subnet tab
     */
    static async saveTab(req: Request, res: Response) {
        try {
            const { subnet } = req.body;
            if (!subnet) return res.status(400).json({ success: false, message: 'Subnet diperlukan' });

            let tabs: string[] = ['192.168.239'];
            try {
                const [rows] = await databasePool.query<RowDataPacket[]>(
                    "SELECT setting_value FROM settings WHERE setting_key = 'ip_checker_tabs'"
                );
                if (rows && rows.length > 0 && rows[0].setting_value) {
                    try { tabs = JSON.parse(rows[0].setting_value); } catch { }
                }
            } catch { }

            if (!tabs.includes(subnet)) {
                tabs.push(subnet);
            }

            await databasePool.query(
                `INSERT INTO settings (setting_key, setting_value, updated_at) 
                 VALUES ('ip_checker_tabs', ?, NOW())
                 ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
                [JSON.stringify(tabs), JSON.stringify(tabs)]
            );

            return res.json({ success: true, tabs });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Delete a subnet tab
     */
    static async deleteTab(req: Request, res: Response) {
        try {
            const { subnet } = req.body;
            if (!subnet) return res.status(400).json({ success: false, message: 'Subnet diperlukan' });

            let tabs: string[] = ['192.168.239'];
            try {
                const [rows] = await databasePool.query<RowDataPacket[]>(
                    "SELECT setting_value FROM settings WHERE setting_key = 'ip_checker_tabs'"
                );
                if (rows && rows.length > 0 && rows[0].setting_value) {
                    try { tabs = JSON.parse(rows[0].setting_value); } catch { }
                }
            } catch { }

            tabs = tabs.filter(t => t !== subnet);
            if (tabs.length === 0) tabs = ['192.168.239'];

            await databasePool.query(
                `INSERT INTO settings (setting_key, setting_value, updated_at) 
                 VALUES ('ip_checker_tabs', ?, NOW())
                 ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
                [JSON.stringify(tabs), JSON.stringify(tabs)]
            );

            return res.json({ success: true, tabs });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    static async scanSubnet(req: Request, res: Response) {
        try {
            const { subnet } = req.body;
            if (!subnet) {
                return res.status(400).json({ success: false, message: 'Harap masukkan Subnet (192.168.../24) atau Range IP (192.168.1.1-192.168.1.50)' });
            }

            let usableStart = 0;
            let usableEnd = 0;
            let networkInfo = "-";
            let broadcastInfo = "-";
            const inputStr = subnet.trim();

            if (inputStr.includes('/')) {
                const parts = inputStr.split('/');
                if (parts.length !== 2) {
                    return res.status(400).json({ success: false, message: 'Format subnet tidak valid.' });
                }
                const baseIp = parts[0];
                const maskBits = parseInt(parts[1], 10);
                if (maskBits < 16 || maskBits > 32) {
                    return res.status(400).json({ success: false, message: 'Masking subnet harus antara /16 sampai /32.' });
                }
                const ipParts = baseIp.split('.');
                if (ipParts.length !== 4 || ipParts.some((p: string) => isNaN(parseInt(p)) || parseInt(p) < 0 || parseInt(p) > 255)) {
                    return res.status(400).json({ success: false, message: 'Format IP Address tidak valid.' });
                }
                const ipLong = ip2long(baseIp);
                if (maskBits === 32) {
                    usableStart = ipLong;
                    usableEnd = ipLong;
                    networkInfo = "Single IP";
                    broadcastInfo = "Single IP";
                } else {
                    const mask = (0xffffffff << (32 - maskBits)) >>> 0;
                    const network = ipLong & mask;
                    const broadcast = network | (~mask >>> 0);
                    usableStart = network + 1;
                    usableEnd = broadcast - 1;
                    networkInfo = long2ip(network);
                    broadcastInfo = long2ip(broadcast);
                }
            } else if (inputStr.includes('-')) {
                const parts = inputStr.split('-');
                if (parts.length !== 2) {
                    return res.status(400).json({ success: false, message: 'Format range tidak valid.' });
                }
                const startIp = parts[0].trim();
                const endIp = parts[1].trim();
                if (startIp.split('.').length !== 4 || endIp.split('.').length !== 4) {
                    return res.status(400).json({ success: false, message: 'Format IP Address Range tidak valid.' });
                }
                usableStart = ip2long(startIp);
                usableEnd = ip2long(endIp);
                if (usableStart > usableEnd) {
                    const temp = usableStart;
                    usableStart = usableEnd;
                    usableEnd = temp;
                }
                networkInfo = "Range Start";
                broadcastInfo = "Range End";
            } else {
                const ipParts = inputStr.split('.');
                if (ipParts.length !== 4 || ipParts.some((p: string) => isNaN(parseInt(p)) || parseInt(p) < 0 || parseInt(p) > 255)) {
                    return res.status(400).json({ success: false, message: 'Format input tidak dikenali.' });
                }
                usableStart = ip2long(inputStr);
                usableEnd = usableStart;
                networkInfo = "Single IP";
                broadcastInfo = "Single IP";
            }

            const totalUsable = usableEnd - usableStart + 1;
            if (totalUsable > 4096) {
                return res.status(400).json({ success: false, message: 'Range/Subnet terlalu besar (> 4096 IP).' });
            }

            const allIPs: { ip: string, status: 'available' | 'used', user?: any }[] = [];
            for (let i = usableStart; i <= usableEnd; i++) {
                allIPs.push({ ip: long2ip(i), status: 'available' });
            }

            const [staticClients] = await databasePool.query<RowDataPacket[]>(`
                SELECT sc.ip_address, c.name, c.id as customer_id, 'Static IP Client' as source
                FROM static_ip_clients sc
                JOIN customers c ON sc.customer_id = c.id
                WHERE sc.ip_address IS NOT NULL AND sc.ip_address != ''
            `);

            const [generalCustomers] = await databasePool.query<RowDataPacket[]>(`
                SELECT ip_address, static_ip as static_ip_address, name, id as customer_id
                FROM customers
                WHERE connection_type = 'static_ip' OR ip_address != '' OR static_ip != ''
            `);

            const usedIPsMap = new Map<string, any>();
            staticClients.forEach(client => {
                if (client.ip_address) usedIPsMap.set(client.ip_address.trim(), client);
            });
            generalCustomers.forEach(cust => {
                const ip1 = cust.static_ip_address?.trim();
                const ip2 = cust.ip_address?.trim();
                if (ip1 && !usedIPsMap.has(ip1)) usedIPsMap.set(ip1, { name: cust.name, customer_id: cust.customer_id, source: 'Customer (Static IP Field)' });
                if (ip2 && !usedIPsMap.has(ip2)) usedIPsMap.set(ip2, { name: cust.name, customer_id: cust.customer_id, source: 'Customer (IP Field)' });
            });

            let usedCount = 0;
            allIPs.forEach(item => {
                if (usedIPsMap.has(item.ip)) {
                    item.status = 'used';
                    item.user = usedIPsMap.get(item.ip);
                    usedCount++;
                }
            });

            return res.json({
                success: true,
                data: {
                    subnet,
                    network: networkInfo,
                    broadcast: broadcastInfo,
                    totalUsable,
                    usedCount,
                    availableCount: totalUsable - usedCount,
                    ips: allIPs
                }
            });
        } catch (error: any) {
            console.error('Scan Subnet Error:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
        }
    }

    /**
     * Update IP comment/label - save to DB and optionally sync to MikroTik
     */
    static async updateComment(req: Request, res: Response) {
        try {
            const { ip_address, comment } = req.body;
            if (!ip_address || !comment) {
                return res.status(400).json({ success: false, message: 'IP Address dan Nama/Komentar wajib diisi' });
            }

            const ipClean = String(ip_address).split('/')[0].trim();

            // Ensure table exists
            await databasePool.query(`
                CREATE TABLE IF NOT EXISTS ip_checker_manual_labels (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(50) NOT NULL UNIQUE,
                    label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Upsert manual label
            await databasePool.query<ResultSetHeader>(
                `INSERT INTO ip_checker_manual_labels (ip_address, label) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE label = ?, updated_at = NOW()`,
                [ipClean, comment.trim(), comment.trim()]
            );

            // Try to update MikroTik comment too
            let mikrotikUpdated = false;
            try {
                const { getMikrotikConfig } = await import('../../services/staticIpPackageService');
                const { findIpAddressId, updateIpAddress } = await import('../../services/mikrotikService');
                const cfg = await getMikrotikConfig();
                if (cfg) {
                    const addressId = await findIpAddressId(cfg, ipClean);
                    if (addressId) {
                        await updateIpAddress(cfg, addressId, { comment: comment.trim() });
                        mikrotikUpdated = true;
                    }
                }
            } catch (mkErr: any) {
                console.warn('[updateComment] MikroTik update failed (non-critical):', mkErr.message);
            }

            return res.json({
                success: true,
                message: `Label untuk ${ipClean} berhasil disimpan${mikrotikUpdated ? ' dan di-sync ke MikroTik' : ''}`,
                data: { ip_address: ipClean, label: comment.trim(), mikrotik_synced: mikrotikUpdated }
            });
        } catch (error: any) {
            console.error('[updateComment] Error:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
        }
    }

    /**
     * Delete manual IP label
     */
    static async deleteComment(req: Request, res: Response) {
        try {
            const { ip_address } = req.body;
            if (!ip_address) {
                return res.status(400).json({ success: false, message: 'IP Address wajib diisi' });
            }

            const ipClean = String(ip_address).split('/')[0].trim();

            await databasePool.query(
                `DELETE FROM ip_checker_manual_labels WHERE ip_address = ?`,
                [ipClean]
            );

            return res.json({
                success: true,
                message: `Label untuk ${ipClean} berhasil dihapus`
            });
        } catch (error: any) {
            console.error('[deleteComment] Error:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
        }
    }
}
