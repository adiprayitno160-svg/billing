import { databasePool } from '../../db/pool';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';
import { RowDataPacket } from 'mysql2';
import { mikrotikPool } from '../MikroTikConnectionPool';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';

export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
}

interface MikrotikIsolateResult {
    success: boolean;
    method: 'pppoe' | 'static_ip' | 'none';
    detail: string;
}

export class IsolationService {
    /**
     * Execute MikroTik isolation based on customer connection type
     * PPPoE: Disable/Enable PPPoE secret
     * Static IP: Disable/Enable IP Address (gateway)
     */
    private static async executeMikrotikIsolation(
        customer: any,
        action: 'isolate' | 'restore'
    ): Promise<MikrotikIsolateResult> {
        try {
            const mikrotikConfig = await getMikrotikConfig();
            if (!mikrotikConfig) {
                return { success: false, method: 'none', detail: 'MikroTik config not found' };
            }

            const config = {
                host: mikrotikConfig.host,
                port: mikrotikConfig.port || mikrotikConfig.api_port || 8728,
                username: mikrotikConfig.username,
                password: mikrotikConfig.password
            };

            const connectionType = customer.connection_type;

            if (connectionType === 'pppoe') {
                // ============== PPPoE ISOLATION ==============
                // Get PPPoE secret by username (usually customer_code or phone)
                const pppoeUsername = customer.pppoe_username || customer.customer_code || customer.phone;

                if (!pppoeUsername) {
                    return { success: false, method: 'pppoe', detail: 'No PPPoE username found' };
                }

                // Find the secret
                const secrets = await mikrotikPool.execute(config, '/ppp/secret/print', [
                    `?name=${pppoeUsername}`
                ]);

                if (!Array.isArray(secrets) || secrets.length === 0) {
                    // Try alternative: search by comment containing customer code
                    const allSecrets = await mikrotikPool.execute(config, '/ppp/secret/print', []);
                    const matchedSecret = (allSecrets as any[]).find((s: any) =>
                        s.name === pppoeUsername ||
                        (s.comment && s.comment.includes(customer.customer_code))
                    );

                    if (!matchedSecret) {
                        return { success: false, method: 'pppoe', detail: `PPPoE secret not found: ${pppoeUsername}` };
                    }

                    // Disable/enable the matched secret
                    const disabled = action === 'isolate' ? 'yes' : 'no';
                    await mikrotikPool.execute(config, '/ppp/secret/set', [
                        `.id=${matchedSecret['.id']}`,
                        `=disabled=${disabled}`
                    ]);

                    // Force disconnect active session if isolating
                    if (action === 'isolate') {
                        try {
                            const activeSessions = await mikrotikPool.execute(config, '/ppp/active/print', [
                                `?name=${matchedSecret.name}`
                            ]);
                            for (const session of (activeSessions as any[])) {
                                await mikrotikPool.execute(config, '/ppp/active/remove', [
                                    `.id=${session['.id']}`
                                ]);
                            }
                        } catch (e) {
                            console.log('[Isolation] Could not disconnect active PPPoE session:', e);
                        }
                    }

                    return {
                        success: true,
                        method: 'pppoe',
                        detail: `PPPoE ${matchedSecret.name} ${action === 'isolate' ? 'disabled' : 'enabled'}`
                    };
                }

                // Disable/enable the secret
                const secret = secrets[0];
                const disabled = action === 'isolate' ? 'yes' : 'no';
                await mikrotikPool.execute(config, '/ppp/secret/set', [
                    `.id=${secret['.id']}`,
                    `=disabled=${disabled}`
                ]);

                // Force disconnect if isolating
                if (action === 'isolate') {
                    try {
                        const activeSessions = await mikrotikPool.execute(config, '/ppp/active/print', [
                            `?name=${pppoeUsername}`
                        ]);
                        for (const session of (activeSessions as any[])) {
                            await mikrotikPool.execute(config, '/ppp/active/remove', [
                                `.id=${session['.id']}`
                            ]);
                        }
                    } catch (e) {
                        console.log('[Isolation] Could not disconnect active PPPoE session:', e);
                    }
                }

                return {
                    success: true,
                    method: 'pppoe',
                    detail: `PPPoE ${pppoeUsername} ${action === 'isolate' ? 'disabled' : 'enabled'}`
                };

            } else if (connectionType === 'static_ip') {
                // ============== STATIC IP ISOLATION ==============
                // Get static IP client info
                const [staticIpRows] = await databasePool.execute(
                    `SELECT ip_address, gateway_ip, gateway_ip_id, interface 
                     FROM static_ip_clients 
                     WHERE customer_id = ? 
                     ORDER BY id DESC LIMIT 1`,
                    [customer.id]
                );

                const staticIpClient = (staticIpRows as any[])[0];

                if (!staticIpClient) {
                    return { success: false, method: 'static_ip', detail: 'Static IP client data not found' };
                }

                // Strategy 1: Use stored gateway_ip_id
                if (staticIpClient.gateway_ip_id) {
                    const disabled = action === 'isolate' ? 'yes' : 'no';
                    try {
                        await mikrotikPool.execute(config, '/ip/address/set', [
                            `.id=${staticIpClient.gateway_ip_id}`,
                            `=disabled=${disabled}`
                        ]);

                        return {
                            success: true,
                            method: 'static_ip',
                            detail: `Gateway ${staticIpClient.gateway_ip} ${action === 'isolate' ? 'disabled' : 'enabled'} (ID: ${staticIpClient.gateway_ip_id})`
                        };
                    } catch (e) {
                        console.log('[Isolation] Gateway ID failed, trying by address...');
                    }
                }

                // Strategy 2: Find gateway by IP address
                if (staticIpClient.gateway_ip) {
                    const ipAddresses = await mikrotikPool.execute(config, '/ip/address/print', []);
                    const matchedGateway = (ipAddresses as any[]).find((ip: any) =>
                        ip.address === staticIpClient.gateway_ip
                    );

                    if (matchedGateway) {
                        const disabled = action === 'isolate' ? 'yes' : 'no';
                        await mikrotikPool.execute(config, '/ip/address/set', [
                            `.id=${matchedGateway['.id']}`,
                            `=disabled=${disabled}`
                        ]);

                        // Update stored gateway_ip_id
                        await databasePool.execute(
                            'UPDATE static_ip_clients SET gateway_ip_id = ? WHERE customer_id = ?',
                            [matchedGateway['.id'], customer.id]
                        );

                        return {
                            success: true,
                            method: 'static_ip',
                            detail: `Gateway ${staticIpClient.gateway_ip} ${action === 'isolate' ? 'disabled' : 'enabled'}`
                        };
                    }
                }

                // Strategy 3: Find by customer IP and matching network
                if (staticIpClient.ip_address) {
                    const customerIp = staticIpClient.ip_address;
                    const ipAddresses = await mikrotikPool.execute(config, '/ip/address/print', []);

                    // Find gateway in same network
                    const matchedGateway = (ipAddresses as any[]).find((ipEntry: any) => {
                        const address = ipEntry.address;
                        if (!address || !address.includes('/')) return false;

                        const [gwIp, cidrStr] = address.split('/');
                        const cidr = parseInt(cidrStr, 10);

                        // Calculate if in same network
                        const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                        const mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
                        const custNetwork = ipToInt(customerIp) & mask;
                        const gwNetwork = ipToInt(gwIp) & mask;

                        return custNetwork === gwNetwork && gwIp !== customerIp;
                    });

                    if (matchedGateway) {
                        const disabled = action === 'isolate' ? 'yes' : 'no';
                        await mikrotikPool.execute(config, '/ip/address/set', [
                            `.id=${matchedGateway['.id']}`,
                            `=disabled=${disabled}`
                        ]);

                        // Store for future use
                        await databasePool.execute(
                            'UPDATE static_ip_clients SET gateway_ip = ?, gateway_ip_id = ? WHERE customer_id = ?',
                            [matchedGateway.address, matchedGateway['.id'], customer.id]
                        );

                        return {
                            success: true,
                            method: 'static_ip',
                            detail: `Gateway ${matchedGateway.address} ${action === 'isolate' ? 'disabled' : 'enabled'} (auto-detected)`
                        };
                    }
                }

                return { success: false, method: 'static_ip', detail: 'Gateway IP not found in MikroTik' };

            } else {
                return { success: false, method: 'none', detail: `Unknown connection type: ${connectionType}` };
            }

        } catch (error) {
            console.error('[Isolation] MikroTik execution error:', error);
            return {
                success: false,
                method: 'none',
                detail: `Error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Isolir pelanggan (PPPoE atau Static IP)
     */
    static async isolateCustomer(isolationData: IsolationData): Promise<boolean> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Security Check: Prevent manual restore if debt exists
            if (isolationData.action === 'restore' && isolationData.performed_by !== 'system') {
                const [unpaidCheck] = await connection.query<RowDataPacket[]>(
                    "SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status != 'paid'",
                    [isolationData.customer_id]
                );

                if (unpaidCheck.length > 0 && unpaidCheck[0].count > 0) {
                    throw new Error('BLOCKED: Pelanggan masih memiliki tagihan belum lunas. Admin tidak diizinkan membuka isolir manual. Wajib lunas via Transfer untuk verifikasi AI.');
                }
            }

            // Get customer details
            const customerQuery = `
                SELECT c.*, s.package_name, s.price
                FROM customers c
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                WHERE c.id = ?
            `;

            const [customerResult] = await connection.execute(customerQuery, [isolationData.customer_id]);
            const customer = (customerResult as any)[0];

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Execute MikroTik isolation based on connection type
            console.log(`[Isolation] Processing ${isolationData.action} for customer ${customer.name} (type: ${customer.connection_type})`);

            const mikrotikResult = await this.executeMikrotikIsolation(customer, isolationData.action);

            console.log(`[Isolation] MikroTik result: ${mikrotikResult.success ? '✅' : '❌'} ${mikrotikResult.method} - ${mikrotikResult.detail}`);

            // Determine MikroTik username for logging
            let mikrotikUsername = '';
            if (customer.connection_type === 'pppoe') {
                mikrotikUsername = customer.pppoe_username || customer.customer_code || customer.phone || '';
            } else if (customer.connection_type === 'static_ip') {
                const [staticRows] = await connection.execute(
                    'SELECT ip_address, gateway_ip FROM static_ip_clients WHERE customer_id = ? LIMIT 1',
                    [isolationData.customer_id]
                );
                const staticClient = (staticRows as any[])[0];
                mikrotikUsername = staticClient ? `IP:${staticClient.ip_address} GW:${staticClient.gateway_ip}` : '';
            }

            // Log isolation action
            const logQuery = `
                INSERT INTO isolation_logs (
                    customer_id, action, reason, performed_by, 
                    mikrotik_username, mikrotik_response
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await connection.execute(logQuery, [
                isolationData.customer_id,
                isolationData.action,
                isolationData.reason,
                isolationData.performed_by || 'system',
                mikrotikUsername,
                `[${mikrotikResult.method}] ${mikrotikResult.detail}`
            ]);

            // Update customer isolation status
            if (isolationData.action === 'isolate') {
                await connection.execute(
                    'UPDATE customers SET is_isolated = TRUE, isolated_at = NOW() WHERE id = ?',
                    [isolationData.customer_id]
                );
            } else {
                await connection.execute(
                    'UPDATE customers SET is_isolated = FALSE, isolated_at = NULL WHERE id = ?',
                    [isolationData.customer_id]
                );
            }

            await connection.commit();

            // Send notification to customer
            try {
                if (customer.phone) {
                    if (isolationData.action === 'isolate') {
                        // Get invoice details for blocked notification
                        const [invoiceRows] = await connection.query<RowDataPacket[]>(
                            `SELECT invoice_number, total_amount, due_date, period 
                             FROM invoices 
                             WHERE customer_id = ? AND status != 'paid' 
                             ORDER BY due_date DESC LIMIT 2`,
                            [isolationData.customer_id]
                        );

                        let details = `Kode Pelanggan: ${customer.customer_code}`;
                        details += `\nTipe Koneksi: ${customer.connection_type === 'pppoe' ? 'PPPoE' : 'Static IP'}`;
                        if (invoiceRows.length > 0) {
                            details += `\n⚠️ LAYANAN DIBLOKIR SEMENTARA\n`;
                            details += `Terdeteksi tunggakan ${invoiceRows.length} tagihan belum lunas.\n`;
                            details += `Total Tagihan Terakhir: Rp ${parseFloat(invoiceRows[0].total_amount).toLocaleString('id-ID')}\n`;
                            details += `\n⛔ Admin tidak dapat membuka blokir manual.\n`;
                            details += `✅ CARA BUKA BLOKIR:\n`;
                            details += `1. Transfer total tagihan ke rekening terdaftar.\n`;
                            details += `2. Kirim BUKTI TRANSFER via WhatsApp ini.\n`;
                            details += `3. Sistem AI akan memverifikasi dan membuka blokir otomatis.\n`;
                        }

                        await UnifiedNotificationService.queueNotification({
                            customer_id: isolationData.customer_id,
                            notification_type: 'service_blocked',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                reason: isolationData.reason,
                                details: details
                            },
                            priority: 'high'
                        });

                        console.log(`[IsolationService] ✅ Block notification queued for customer ${customer.name}`);
                    } else {
                        // Restore notification
                        const [invoiceRows] = await connection.query<RowDataPacket[]>(
                            `SELECT invoice_number, total_amount, payment_date 
                             FROM invoices 
                             WHERE customer_id = ? AND status = 'paid' 
                             ORDER BY payment_date DESC LIMIT 1`,
                            [isolationData.customer_id]
                        );

                        let details = `Kode Pelanggan: ${customer.customer_code}`;
                        details += `\nTipe Koneksi: ${customer.connection_type === 'pppoe' ? 'PPPoE' : 'Static IP'}`;
                        if (invoiceRows.length > 0) {
                            details += `\n✅ Pembayaran diterima & Terverifikasi AI.\nLayanan internet Anda telah AKTIF kembali.`;
                        } else {
                            details += `\n✅ Layanan telah diaktifkan kembali`;
                        }

                        await UnifiedNotificationService.queueNotification({
                            customer_id: isolationData.customer_id,
                            notification_type: 'service_unblocked',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name || 'Pelanggan',
                                details: details
                            },
                            priority: 'normal'
                        });

                        console.log(`[IsolationService] ✅ Unblock notification queued for customer ${customer.name}`);
                    }
                }
            } catch (notifError) {
                console.error('[IsolationService] Failed to send notification (non-critical):', notifError);
            }

            return mikrotikResult.success;

        } catch (error) {
            await connection.rollback();
            console.error('Error in isolation service:', error);
            if (error instanceof Error && error.message.includes('BLOCKED')) {
                throw error;
            }
            return false;
        } finally {
            connection.release();
        }
    }

    /**
     * Send isolation warning 3 days before isolation
     */
    static async sendIsolationWarnings(daysBefore: number = 3): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            // Get customers with unpaid invoices that will be isolated in X days
            const warningDate = new Date();
            warningDate.setDate(warningDate.getDate() + daysBefore);

            const query = `
                SELECT DISTINCT 
                    c.id, 
                    c.name, 
                    c.phone, 
                    c.customer_code,
                    c.connection_type,
                    i.id as invoice_id,
                    i.invoice_number,
                    i.total_amount,
                    i.remaining_amount,
                    i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND DATE(i.due_date) = DATE(?)
                AND NOT EXISTS (
                    SELECT 1 FROM notification_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'isolation_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [warningDate.toISOString().split('T')[0]]);

            console.log(`[IsolationService] Found ${customers.length} customers to warn about isolation in ${daysBefore} days`);

            for (const customer of customers) {
                try {
                    if (!customer.phone) {
                        console.log(`[IsolationService] ⚠️ No phone number for customer ${customer.name}, skipping warning`);
                        continue;
                    }

                    const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');

                    // Calculate days remaining
                    const dueDate = new Date(customer.due_date);
                    const today = new Date();
                    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    console.log(`[IsolationService] 📱 Sending isolation warning to customer ${customer.name} (${daysRemaining} days remaining, type: ${customer.connection_type})...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'isolation_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name || 'Pelanggan',
                            invoice_number: customer.invoice_number || '',
                            total_amount: parseFloat(customer.total_amount || 0).toLocaleString('id-ID'),
                            remaining_amount: parseFloat(customer.remaining_amount || 0).toLocaleString('id-ID'),
                            due_date: customer.due_date ? new Date(customer.due_date).toLocaleDateString('id-ID') : '-',
                            days_remaining: daysRemaining.toString()
                        },
                        priority: 'high'
                    });

                    console.log(`[IsolationService] ✅ Isolation warning queued (IDs: ${notificationIds.join(', ')})`);

                    // Process queue immediately
                    try {
                        const result = await UnifiedNotificationService.sendPendingNotifications(10);
                        console.log(`[IsolationService] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
                    } catch (queueError: any) {
                        console.warn(`[IsolationService] ⚠️ Queue processing error (non-critical):`, queueError.message);
                    }

                    warned++;
                } catch (error: any) {
                    console.error(`[IsolationService] Failed to send warning to customer ${customer.id}:`, error.message);
                    failed++;
                }
            }

        } catch (error) {
            console.error('[IsolationService] Error sending isolation warnings:', error);
            throw error;
        } finally {
            connection.release();
        }

        return { warned, failed };
    }

    /**
     * Send pre-block warnings to customers with unpaid invoices
     * Called from 25th to end of month, warning about blocking on the 1st
     */
    static async sendPreBlockWarnings(): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Get current month period (YYYY-MM)
            const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

            // Calculate blocking date (1st of next month)
            const nextMonth = new Date(currentYear, currentMonth + 1, 1);
            const blockingDate = nextMonth.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            // Get customers with unpaid invoices for current month
            const query = `
                SELECT DISTINCT 
                    c.id, 
                    c.name, 
                    c.phone, 
                    c.customer_code,
                    c.connection_type,
                    i.id as invoice_id,
                    i.invoice_number,
                    i.total_amount,
                    i.remaining_amount,
                    i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.period = ?
                AND i.status IN ('sent', 'partial', 'overdue', 'draft')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND c.phone IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM notification_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'pre_block_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [currentPeriod]);

            console.log(`[Pre-Block Warning] Found ${customers.length} customers with unpaid invoices for period ${currentPeriod}`);

            for (const customer of customers) {
                try {
                    if (!customer.phone) {
                        console.log(`[Pre-Block Warning] ⚠️ No phone number for customer ${customer.name}, skipping`);
                        continue;
                    }

                    const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');

                    // Calculate days until blocking
                    const daysUntilBlock = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    console.log(`[Pre-Block Warning] 📱 Sending warning to ${customer.name} (${customer.connection_type}) - ${daysUntilBlock} days until block...`);

                    const notificationIds = await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'pre_block_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name || 'Pelanggan',
                            customer_code: customer.customer_code || '',
                            invoice_number: customer.invoice_number || '',
                            total_amount: parseFloat(customer.total_amount || 0).toLocaleString('id-ID'),
                            remaining_amount: parseFloat(customer.remaining_amount || 0).toLocaleString('id-ID'),
                            due_date: customer.due_date ? new Date(customer.due_date).toLocaleDateString('id-ID') : '-',
                            blocking_date: blockingDate,
                            days_until_block: daysUntilBlock.toString()
                        },
                        priority: 'high'
                    });

                    console.log(`[Pre-Block Warning] ✅ Warning queued for ${customer.name} (IDs: ${notificationIds.join(', ')})`);

                    // Process queue immediately
                    try {
                        const result = await UnifiedNotificationService.sendPendingNotifications(10);
                        console.log(`[Pre-Block Warning] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
                    } catch (queueError: any) {
                        console.warn(`[Pre-Block Warning] ⚠️ Queue processing error (non-critical):`, queueError.message);
                    }

                    warned++;
                } catch (error: any) {
                    console.error(`[Pre-Block Warning] Failed to send warning to customer ${customer.id}:`, error.message);
                    failed++;
                }
            }

        } catch (error) {
            console.error('[Pre-Block Warning] Error sending pre-block warnings:', error);
            throw error;
        } finally {
            connection.release();
        }

        return { warned, failed };
    }

    /**
     * Auto isolir pelanggan dengan 2x tagihan belum lunas
     * Supports both PPPoE and Static IP customers
     */
    static async autoIsolateOverdueCustomers(): Promise<{ isolated: number, failed: number }> {
        // Get customers with >= 2 overdue/unpaid invoices
        const query = `
            SELECT c.id, c.name, c.phone, c.email, c.connection_type, COUNT(i.id) as unpaid_count
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status != 'paid' 
            AND i.due_date < CURDATE()
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            GROUP BY c.id
            HAVING unpaid_count >= 2
        `;

        const [result] = await databasePool.execute(query);
        let isolated = 0;
        let failed = 0;
        const customers = result as any[];

        console.log(`[Auto Isolation] Found ${customers.length} customers with 2+ unpaid invoices`);

        for (const customer of customers) {
            try {
                console.log(`[Auto Isolation] Processing: ${customer.name} (${customer.connection_type}, ${customer.unpaid_count} unpaid)`);

                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: `Auto Lock system: Terdeteksi ${customer.unpaid_count} tagihan belum lunas (Min 2)`,
                    performed_by: 'system'
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                    console.log(`[Auto Isolation] ✅ ${customer.name} isolated successfully`);
                } else {
                    failed++;
                    console.log(`[Auto Isolation] ❌ ${customer.name} isolation failed`);
                }
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { isolated, failed };
    }

    /**
     * Auto isolir pelanggan dengan tagihan bulan sebelumnya yang belum lunas
     * Dipanggil setiap hari untuk isolir berdasarkan tanggal yang ditentukan
     * Supports both PPPoE and Static IP customers
     */
    static async autoIsolatePreviousMonthUnpaid(): Promise<{ isolated: number, failed: number }> {
        // Get previous month period (YYYY-MM)
        const now = new Date();
        const currentDate = now.getDate();
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

        // Get scheduler settings for isolation date
        let targetIsolateDate = 1;
        try {
            // Fetch config from scheduler_settings. We check invoice_generation as that's where isolir settings are stored
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'"
            );

            if (rows.length > 0) {
                const row = rows[0];
                // Parse config JSON
                if (row.config) {
                    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                    if (config.isolir_date) {
                        targetIsolateDate = config.isolir_date;
                    }
                }
            }
        } catch (err) {
            console.warn("Could not fetch isolation settings, defaulting to date 1", err);
        }

        // Only run if today is the target isolation date
        if (currentDate !== targetIsolateDate) {
            return { isolated: 0, failed: 0 };
        }

        // Get customers with unpaid invoices from previous month
        const query = `
            SELECT DISTINCT 
                c.id, 
                c.name, 
                c.phone, 
                c.email,
                c.connection_type,
                i.due_date
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.period = ?
            AND i.status != 'paid'
            AND (i.due_date IS NULL OR i.due_date < CURDATE())
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            AND c.status = 'active'
        `;

        const [result] = await databasePool.execute(query, [previousPeriod]);
        let isolated = 0;
        let failed = 0;

        console.log(`[Auto Isolation] Checking unpaid invoices for period ${previousPeriod}`);
        console.log(`[Auto Isolation] Found ${(result as any[]).length} customers with unpaid invoices`);

        for (const customer of (result as any)) {
            try {
                console.log(`[Auto Isolation] Processing: ${customer.name} (${customer.connection_type})`);

                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: `Auto isolation: Unpaid invoice for period ${previousPeriod}`,
                    performed_by: 'system'
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                    console.log(`[Auto Isolation] ✓ Isolated customer: ${customer.name} (ID: ${customer.id}, Type: ${customer.connection_type})`);
                } else {
                    failed++;
                    console.log(`[Auto Isolation] ✗ Failed to isolate customer: ${customer.name} (ID: ${customer.id})`);
                }
            } catch (error) {
                console.error(`[Auto Isolation] ✗ Error isolating customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        console.log(`[Auto Isolation] Summary: ${isolated} isolated, ${failed} failed`);
        return { isolated, failed };
    }

    /**
     * Auto restore pelanggan yang sudah lunas
     * Supports both PPPoE and Static IP customers
     */
    static async autoRestorePaidCustomers(): Promise<{ restored: number, failed: number }> {
        // Get isolated customers with all invoices paid
        const query = `
            SELECT DISTINCT c.id, c.name, c.phone, c.email, c.connection_type
            FROM customers c
            WHERE c.is_isolated = TRUE
            AND c.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM invoices i 
                WHERE i.customer_id = c.id 
                AND i.status != 'paid'
                AND i.remaining_amount > 0
            )
        `;

        const [result] = await databasePool.execute(query);
        let restored = 0;
        let failed = 0;

        console.log(`[Auto Restore] Found ${(result as any[]).length} isolated customers with all invoices paid`);

        for (const customer of (result as any)) {
            try {
                console.log(`[Auto Restore] Processing: ${customer.name} (${customer.connection_type})`);

                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'restore',
                    reason: 'Auto restore: All invoices paid',
                    performed_by: 'system'
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    restored++;
                    console.log(`[Auto Restore] ✅ Restored: ${customer.name} (${customer.connection_type})`);
                } else {
                    failed++;
                    console.log(`[Auto Restore] ❌ Failed to restore: ${customer.name}`);
                }
            } catch (error) {
                console.error(`Failed to restore customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { restored, failed };
    }

    /**
     * Get isolation history
     */
    static async getIsolationHistory(customerId?: number, limit: number = 50) {
        let query = `
            SELECT il.*, c.name as customer_name, c.phone, c.connection_type
            FROM isolation_logs il
            JOIN customers c ON il.customer_id = c.id
        `;

        const params: any[] = [];

        if (customerId) {
            query += ' WHERE il.customer_id = ?';
            params.push(customerId);
        }

        query += ' ORDER BY il.created_at DESC LIMIT ?';
        params.push(limit);

        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Get isolated customers
     */
    static async getIsolatedCustomers() {
        const query = `
            SELECT c.*, il.reason, il.created_at as isolated_at
            FROM customers c
            JOIN isolation_logs il ON c.id = il.customer_id
            WHERE c.is_isolated = TRUE
            AND il.action = 'isolate'
            ORDER BY il.created_at DESC
        `;

        const [result] = await databasePool.execute(query);
        return result;
    }

    /**
     * Bulk isolate customers by ODC
     */
    static async bulkIsolateByOdc(odcId: number, reason: string): Promise<{ isolated: number, failed: number }> {
        const query = `
            SELECT id, connection_type FROM customers 
            WHERE odc_id = ? AND is_isolated = FALSE AND status = 'active'
        `;

        const [result] = await databasePool.execute(query, [odcId]);
        let isolated = 0;
        let failed = 0;

        for (const customer of (result as any)) {
            try {
                const isolationData: IsolationData = {
                    customer_id: customer.id || 0,
                    action: 'isolate',
                    reason: reason,
                    performed_by: 'admin'
                };

                const success = await this.isolateCustomer(isolationData);
                if (success) {
                    isolated++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id || 0}:`, error);
                failed++;
            }
        }

        return { isolated, failed };
    }

    /**
     * Manual isolate/restore from admin UI
     */
    static async manualIsolate(customerId: number, action: 'isolate' | 'restore', reason: string, performedBy: string): Promise<boolean> {
        const isolationData: IsolationData = {
            customer_id: customerId,
            action: action,
            reason: reason,
            performed_by: performedBy
        };

        return await this.isolateCustomer(isolationData);
    }

    /**
     * Auto delete (soft delete) customers blocked > 7 days
     */
    static async autoDeleteBlockedCustomers(): Promise<{ deleted: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let deleted = 0;
        let failed = 0;

        try {
            const query = `
                SELECT c.id, c.name, c.connection_type, MAX(il.created_at) as last_isolation_date
                FROM customers c
                JOIN isolation_logs il ON c.id = il.customer_id
                WHERE c.is_isolated = 1
                AND c.status != 'deleted'
                AND il.action = 'isolate'
                GROUP BY c.id
                HAVING last_isolation_date < DATE_SUB(NOW(), INTERVAL 7 DAY)
            `;

            const [customers] = await connection.query(query);

            console.log(`[AutoDelete] Found ${(customers as any[]).length} customers blocked > 7 days`);

            for (const customer of (customers as any[])) {
                try {
                    await connection.beginTransaction();

                    // Soft delete customer
                    await connection.query('UPDATE customers SET status = "deleted", deleted_at = NOW() WHERE id = ?', [customer.id]);

                    // Terminate subscription
                    await connection.query('UPDATE subscriptions SET status = "terminated", end_date = NOW() WHERE customer_id = ? AND status = "active"', [customer.id]);

                    // Log action
                    await connection.query(`
                        INSERT INTO customer_logs (customer_id, action, description, created_by, created_at)
                        VALUES (?, 'auto_delete', 'Auto deleted after 7 days of isolation (${customer.connection_type})', 0, NOW())
                    `, [customer.id]);

                    await connection.commit();

                    // Send notification
                    try {
                        const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');
                        await UnifiedNotificationService.queueNotification({
                            customer_id: customer.id,
                            notification_type: 'customer_deleted',
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name,
                                reason: 'Tidak ada pembayaran setelah 7 hari isolir.'
                            },
                            priority: 'normal'
                        });
                    } catch (e) {
                        console.error('Failed to send delete notification:', e);
                    }

                    deleted++;
                    console.log(`[AutoDelete] Soft deleted customer ${customer.name} (${customer.id}, ${customer.connection_type})`);

                } catch (err) {
                    await connection.rollback();
                    console.error(`[AutoDelete] Failed to delete customer ${customer.id}:`, err);
                    failed++;
                }
            }

            return { deleted, failed };

        } catch (error) {
            console.error('[AutoDelete] Error in auto delete process:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get isolation statistics
     */
    static async getStatistics(): Promise<{
        total_isolated: number,
        pppoe_isolated: number,
        static_ip_isolated: number,
        isolated_today: number,
        restored_today: number
    }> {
        const [result] = await databasePool.query<RowDataPacket[]>(`
            SELECT 
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE) as total_isolated,
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE AND connection_type = 'pppoe') as pppoe_isolated,
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE AND connection_type = 'static_ip') as static_ip_isolated,
                (SELECT COUNT(*) FROM isolation_logs WHERE action = 'isolate' AND DATE(created_at) = CURDATE()) as isolated_today,
                (SELECT COUNT(*) FROM isolation_logs WHERE action = 'restore' AND DATE(created_at) = CURDATE()) as restored_today
        `);

        return result[0] as any;
    }
}
