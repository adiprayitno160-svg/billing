import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { WhatsAppService } from '../../services/whatsapp/WhatsAppService'; // Adjust path if needed
import { CustomerIdGenerator } from '../../utils/customerIdGenerator';

export class RegistrationRequestController {

    static async index(req: Request, res: Response) {
        try {
            const [requests] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM registration_requests WHERE status != 'rejected' ORDER BY created_at DESC`
            );

            res.render('customers/registration_requests/index', {
                layout: 'layouts/main',
                title: 'Permintaan Registrasi',
                requests,
                currentPath: '/customers/registration-requests'
            });
        } catch (error) {
            console.error('Error fetching registration requests:', error);
            req.flash('error', 'Gagal memuat data registrasi.');
            res.redirect('/customers/list');
        }
    }

    static async approve(req: Request, res: Response) {
        const { id } = req.params;
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Get Request Data
            const [rows] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM registration_requests WHERE id = ? FOR UPDATE',
                [id]
            );

            if (rows.length === 0) {
                await connection.rollback();
                req.flash('error', 'Data tidak ditemukan.');
                return res.redirect('/customers/registration-requests');
            }

            const request = rows[0];

            if (request.status !== 'pending') {
                await connection.rollback();
                req.flash('error', 'Permintaan ini sudah diproses sebelumnya.');
                return res.redirect('/customers/registration-requests');
            }

            // 2. Generate Customer Code
            const customerCode = CustomerIdGenerator.generateCustomerId();

            let notesObj: any = null;
            if (request.notes) {
                try {
                    notesObj = JSON.parse(request.notes);
                } catch(e) {}
            }

            let newCustomerId: number | null = null;
            let pppoeUsername, pppoePassword;

            if (notesObj && notesObj.type === 'static_ip') {
                // Static IP uses addClientToPackage which handles Customers + Subscriptions + Static_IP + Mikrotik
                await connection.commit(); // commit early because addClientToPackage uses its own transaction
                
                const { addClientToPackage } = await import('../../services/staticIpClientService');
                const { getMikrotikConfig, getStaticIpPackageById, syncClientQueues } = await import('../../services/staticIpPackageService');
                const { addIpAddress } = await import('../../services/mikrotikService');

                let ip_address_with_cidr = notesObj.allocated_ip || '192.168.239.2/30';
                
                function ipToInt(ip: string) { return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0 }
                function intToIp(int: number) { return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.') }
                
                const [ipOnly, prefixStr] = String(ip_address_with_cidr).split('/');
                const prefix = Number(prefixStr || '30');
                const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
                const networkInt = ipToInt(ipOnly) & mask;
                const network = intToIp(networkInt);

                const resultClient = await addClientToPackage(notesObj.packageId, {
                    client_name: request.name,
                    ip_address: ip_address_with_cidr,
                    network: network,
                    interface: notesObj.interface || 'ether1',
                    customer_code: customerCode,
                    address: request.address || null,
                    phone_number: request.phone || null,
                    latitude: request.latitude ? Number(request.latitude) : null,
                    longitude: request.longitude ? Number(request.longitude) : null,
                    olt_id: null,
                    odc_id: null,
                    odp_id: null,
                    is_taxable: 0,
                    use_device_rental: 0,
                    serial_number: null,
                    billing_mode: 'postpaid',
                    activation_date: new Date().toISOString().split('T')[0],
                    custom_payment_deadline: new Date().getDate(),
                    isolation_enabled: 1
                });
                newCustomerId = resultClient.customerId;

                // Mikrotik Provisioning
                const cfg = await getMikrotikConfig();
                const pkg = await getStaticIpPackageById(notesObj.packageId);
                
                if (cfg && pkg) {
                    try {
                        let mikrotikAddress = ip_address_with_cidr;
                        if (prefix === 30) {
                            const firstHost = networkInt + 1;
                            const secondHost = networkInt + 2;
                            const ipInt = ipToInt(ipOnly);
                            const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                            mikrotikAddress = `${gatewayIp}/${prefix}`;
                        }

                        try {
                            await addIpAddress(cfg, {
                                interface: notesObj.interface || 'ether1',
                                address: mikrotikAddress,
                                comment: request.name
                            });
                        } catch(e) {}

                        try {
                            await syncClientQueues(newCustomerId, notesObj.packageId, ip_address_with_cidr, request.name);
                        } catch (e) {
                            console.error('Failed to sync client queues', e);
                        }
                    } catch (e) {
                        console.error('Mikrotik sync error for Static IP', e);
                    }
                }

                // Update request status
                const conn2 = await databasePool.getConnection();
                await conn2.query(
                    'UPDATE registration_requests SET status = ?, updated_at = NOW() WHERE id = ?',
                    ['approved', id]
                );
                conn2.release();

            } else {
                // PPPoE uses the old logic (insert manually)
                const [result] = await connection.query<ResultSetHeader>(
                    `INSERT INTO customers (
                        customer_code, name, address, phone, 
                        status, created_at, updated_at,
                        latitude, longitude
                    ) VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), ?, ?)`,
                    [customerCode, request.name, request.address, request.phone, request.latitude, request.longitude]
                );
                
                newCustomerId = result.insertId;

                if (notesObj && notesObj.type === 'pppoe') {
                    pppoeUsername = notesObj.pppoe_username || `${request.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
                    pppoePassword = notesObj.pppoe_password || Math.floor(100000 + Math.random() * 900000).toString();
                    
                    try {
                        const { getMikrotikConfig } = await import('../../utils/mikrotikConfigHelper');
                        const { createPppoeSecret } = await import('../../services/mikrotikService');
                        const config = await getMikrotikConfig();
                        if (config) {
                            await createPppoeSecret(config, {
                                name: pppoeUsername,
                                password: pppoePassword,
                                profile: 'default',
                                service: 'pppoe',
                                comment: `${request.name} - ${customerCode}`
                            });
                        }
                    } catch (e) {
                        console.error('Mikrotik sync error for PPPoE', e);
                    }

                    await connection.query(
                        `INSERT INTO subscriptions (customer_id, package_id, package_name, price, status, start_date, created_at, updated_at, pppoe_username, pppoe_password)
                         VALUES (?, ?, ?, 0, 'active', NOW(), NOW(), NOW(), ?, ?)`,
                        [newCustomerId, notesObj.packageId, notesObj.packageName, pppoeUsername, pppoePassword]
                    );
                }

                // Update Request Status
                await connection.query(
                    'UPDATE registration_requests SET status = ?, updated_at = NOW() WHERE id = ?',
                    ['approved', id]
                );

                await connection.commit();
            }

            // 5. Notify User via WhatsApp
            if (newCustomerId) {
                try {
                    const { CustomerNotificationService } = await import('../../services/customer/CustomerNotificationService');
                    const notificationService = new CustomerNotificationService();
                    
                    await notificationService.sendWelcomeNotification({
                        customerId: newCustomerId,
                        customerName: request.name,
                        customerCode: customerCode,
                        phone: request.phone,
                        connectionType: notesObj?.type === 'static_ip' ? 'static_ip' : 'pppoe',
                        address: request.address,
                        packageName: notesObj?.packageName,
                        pppoeUsername: pppoeUsername,
                        pppoePassword: pppoePassword,
                        staticIp: notesObj?.allocated_ip
                    });
                } catch (waError) {
                    console.error('Error sending WhatsApp welcome message:', waError);
                }
            }

            req.flash('success', 'Permintaan registrasi berhasil disetujui.');
            res.redirect('/customers/registration-requests');

        } catch (error: any) {
            await connection.rollback();
            console.error('Error approving registration request:', error);
            req.flash('error', 'Terjadi kesalahan saat memproses data: ' + error.message);
            res.redirect('/customers/registration-requests');
        } finally {
            connection.release();
        }
    }

    static async reject(req: Request, res: Response) {
        const { id } = req.params;
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            const [rows] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM registration_requests WHERE id = ? FOR UPDATE',
                [id]
            );

            if (rows.length === 0) {
                await connection.rollback();
                req.flash('error', 'Data tidak ditemukan.');
                return res.redirect('/customers/registration-requests');
            }

            if (rows[0].status !== 'pending') {
                await connection.rollback();
                req.flash('error', 'Permintaan ini sudah diproses sebelumnya.');
                return res.redirect('/customers/registration-requests');
            }

            await connection.query(
                'UPDATE registration_requests SET status = ?, updated_at = NOW() WHERE id = ?',
                ['rejected', id]
            );

            await connection.commit();

            req.flash('success', 'Permintaan registrasi berhasil ditolak.');
            res.redirect('/customers/registration-requests');
        } catch (error) {
            await connection.rollback();
            console.error('Error rejecting registration request:', error);
            req.flash('error', 'Terjadi kesalahan saat menolak permintaan.');
            res.redirect('/customers/registration-requests');
        } finally {
            connection.release();
        }
    }
}
