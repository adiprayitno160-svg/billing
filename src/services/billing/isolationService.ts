import { databasePool } from '../../db/pool';
import { Pool, PoolConnection } from 'mysql2/promise';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';
import { RowDataPacket } from 'mysql2';
import { mikrotikPool } from '../MikroTikConnectionPool';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';
import { NotificationTemplateService } from '../notification/NotificationTemplateService';

export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
}

const ISOLATION_SYSTEM_TEMPLATE = {
    template_code: 'service_blocked_system',
    template_name: 'Isolir Otomatis by AI',
    notification_type: 'service_blocked_system',
    channel: 'whatsapp',
    title_template: '🚨 LAYANAN TERBLOKIR OTOMATIS',
    message_template: '🚨 *PEMBERITAHUAN ISOLIR OTOMATIS* 🚨\n\nHalo *{customer_name}*,\n\nMohon maaf, layanan internet Anda telah *DIBLOKIR OTOMATIS* oleh *{performed_by}* karena adanya tagihan yang melewati batas jatuh tempo.\n\n📝 *DETAIL:* \n━━━━━━━━━━━━━━━\n👤 Nama: {customer_name}\n📦 Alasan: {reason}\n{details}\n━━━━━━━━━━━━━━━\n\n💡 *SOLUSI:* \nSegera lakukan pembayaran tagihan Anda. Layanan akan otomatis aktif kembali dalam hitungan menit setelah pembayaran diverifikasi oleh sistem.\n\nKetik *Menu* untuk cek tagihan atau bantuan lainnya.',
    variables: ['customer_name', 'reason', 'details', 'performed_by'],
    is_active: true,
    priority: 'high'
};

interface MikrotikIsolateResult {
    success: boolean;
    method: 'pppoe' | 'static_ip' | 'none';
    detail: string;
}

export class IsolationService {
    /**
     * Ensure system isolation template exists
     */
    private static async ensureIsolationTemplateExists(): Promise<void> {
        try {
            const template = await NotificationTemplateService.getTemplate('service_blocked_system', 'whatsapp');
            if (!template) {
                console.log('[Isolation] Creating default system isolation template...');
                await NotificationTemplateService.createTemplate(ISOLATION_SYSTEM_TEMPLATE as any);
            }
        } catch (e) {
            console.error('[Isolation] Failed to ensure template exists:', e);
        }
    }

    /**
     * Execute MikroTik isolation based on customer connection type
     */
    private static async executeMikrotikIsolation(
        customer: any,
        action: 'isolate' | 'restore',
        existingConnection?: PoolConnection | Pool
    ): Promise<MikrotikIsolateResult> {
        const connection = existingConnection || databasePool;
        console.log(`[Isolation] 🤖 Starting executeMikrotikIsolation for ${customer.name} (ID: ${customer.id}, Type: ${customer.connection_type}, Action: ${action})`);

        try {
            const mikrotikConfig = await getMikrotikConfig();
            if (!mikrotikConfig) {
                console.error('[Isolation] ❌ MikroTik config not found in database');
                return { success: false, method: 'none', detail: 'MikroTik config not found' };
            }

            const config = {
                host: mikrotikConfig.host,
                port: mikrotikConfig.port || mikrotikConfig.api_port || 8728,
                username: mikrotikConfig.username,
                password: mikrotikConfig.password
            };

            const connectionType = customer.connection_type;
            const disabled = action === 'isolate' ? 'yes' : 'no';

            if (connectionType === 'pppoe') {
                // ============== PPPoE ISOLATION ==============
                const pppoeUsername = customer.pppoe_username || customer.customer_code || customer.phone;
                if (!pppoeUsername) {
                    return { success: false, method: 'pppoe', detail: 'No PPPoE username found' };
                }

                let secrets = await mikrotikPool.execute(config, '/ppp/secret/print', [`?name=${pppoeUsername}`]);
                let targetSecret: any = null;

                if (Array.isArray(secrets) && secrets.length > 0) {
                    targetSecret = secrets[0];
                } else {
                    const allSecrets = await mikrotikPool.execute(config, '/ppp/secret/print', []);
                    targetSecret = (allSecrets as any[]).find((s: any) =>
                        s.name?.toLowerCase() === pppoeUsername.toLowerCase() ||
                        (s.comment && s.comment.toLowerCase().includes(String(customer.customer_code).toLowerCase()))
                    );
                }

                if (!targetSecret) {
                    return { success: false, method: 'pppoe', detail: `PPPoE secret not found: ${pppoeUsername}` };
                }

                await mikrotikPool.execute(config, '/ppp/secret/set', [
                    `=.id=${targetSecret['.id']}`,
                    `=disabled=${disabled}`
                ]);

                if (action === 'isolate') {
                    const activeSessions = await mikrotikPool.execute(config, '/ppp/active/print', [`?name=${targetSecret.name}`]);
                    if (Array.isArray(activeSessions)) {
                        for (const session of activeSessions) {
                            await mikrotikPool.execute(config, '/ppp/active/remove', [`=.id=${session['.id']}`]);
                        }
                    }
                }

                return {
                    success: true,
                    method: 'pppoe',
                    detail: `PPPoE ${targetSecret.name} ${action === 'isolate' ? 'disabled' : 'enabled'}`
                };

            } else if (connectionType === 'static_ip') {
                // ============== STATIC IP ISOLATION ==============
                const [staticIpRows] = await connection.execute(
                    `SELECT ip_address, gateway_ip, gateway_ip_id, interface FROM static_ip_clients WHERE customer_id = ? ORDER BY id DESC LIMIT 1`,
                    [customer.id]
                );
                const staticIpClient = (staticIpRows as any[])[0];

                if (!staticIpClient) {
                    return { success: false, method: 'static_ip', detail: 'Static IP client data not found' };
                }

                let executionSteps: string[] = [];
                let stepSuccessCount = 0;

                const pureIp = staticIpClient.ip_address ? staticIpClient.ip_address.split('/')[0] : null;

                // Step 1: Disable Gateway Entry in /ip/address
                if (staticIpClient.gateway_ip_id || staticIpClient.gateway_ip) {
                    try {
                        let gwId = staticIpClient.gateway_ip_id;
                        const targetGwIp = staticIpClient.gateway_ip;

                        if (!gwId && targetGwIp) {
                            console.log(`[Isolation] 🔍 Searching gateway ID for IP: ${targetGwIp}`);
                            const ips = await mikrotikPool.execute(config, '/ip/address/print', []);
                            if (Array.isArray(ips)) {
                                const found = ips.find((ip: any) =>
                                    ip.address === targetGwIp ||
                                    ip.address.split('/')[0] === targetGwIp ||
                                    (ip.comment && ip.comment.includes(customer.customer_code))
                                );
                                if (found) gwId = found['.id'];
                            }
                        }

                        if (gwId) {
                            await mikrotikPool.execute(config, '/ip/address/set', [
                                `=.id=${gwId}`,
                                `=disabled=${disabled}`
                            ]);
                            executionSteps.push(`Gateway ${targetGwIp} ${disabled === 'yes' ? 'DISABLED' : 'ENABLED'}`);
                            stepSuccessCount++;

                            // Update stored ID if it was missing
                            if (!staticIpClient.gateway_ip_id) {
                                await connection.execute(
                                    'UPDATE static_ip_clients SET gateway_ip_id = ? WHERE customer_id = ?',
                                    [gwId, customer.id]
                                );
                            }
                        } else {
                            console.warn(`[Isolation] ⚠️ Could not find gateway entry for ${targetGwIp} in MikroTik`);
                        }
                    } catch (e: any) {
                        console.error('[Isolation] GW step failed:', e.message);
                    }
                }

                /* 
                // Step 2: Address List ISOLIR (Disabled by user request)
                if (pureIp) {
                    try {
                        if (action === 'isolate') {
                            await mikrotikPool.execute(config, '/ip/firewall/address-list/add', [
                                '=list=ISOLIR', `=address=${pureIp}`, `=comment=ISOLASI: ${customer.name}`
                            ]);
                        } else {
                            const lists = await mikrotikPool.execute(config, '/ip/firewall/address-list/print', [`?address=${pureIp}`, '?list=ISOLIR']);
                            if (Array.isArray(lists)) {
                                for (const l of lists) await mikrotikPool.execute(config, '/ip/firewall/address-list/remove', [`=.id=${l['.id']}`]);
                            }
                        }
                        executionSteps.push(`AddressList ISOLIR ${action === 'isolate' ? 'ADDED' : 'REMOVED'}`);
                        stepSuccessCount++;
                    } catch (e) { console.error('[Isolation] Address List step failed', e); }
                }

                // Step 3: Simple Queue Disable (Disabled by user request)
                if (pureIp) {
                    try {
                        const queues = await mikrotikPool.execute(config, '/queue/simple/print', [`?target=${pureIp}/32`]);
                        if (Array.isArray(queues) && queues.length > 0) {
                            for (const q of queues) await mikrotikPool.execute(config, '/queue/simple/set', [`=.id=${q['.id']}`, `=disabled=${disabled}`]);
                            executionSteps.push(`SimpleQueue ${disabled === 'yes' ? 'OFF' : 'ON'}`);
                            stepSuccessCount++;
                        }
                    } catch (e) { console.error('[Isolation] Queue step failed', e); }
                }
                */

                if (stepSuccessCount > 0) {
                    return { success: true, method: 'static_ip', detail: executionSteps.join(', ') };
                } else {
                    return { success: false, method: 'static_ip', detail: 'Could not find gateway, address list, or queue to disable' };
                }

            } else {
                return { success: false, method: 'none', detail: `Unknown type: ${connectionType}` };
            }

        } catch (error: any) {
            console.error('[Isolation] ❌ MikroTik execution error:', error.message || error);
            return { success: false, method: 'none', detail: `Error: ${error.message}` };
        }
    }

    /**
     * Isolir pelanggan (PPPoE atau Static IP)
     */
    static async isolateCustomer(isolationData: IsolationData, existingConnection?: PoolConnection | Pool): Promise<boolean> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) await (connection as PoolConnection).beginTransaction();

            // Security Check: Verify unpaid invoices before restore
            if (isolationData.action === 'restore') {
                const [unpaidCheck] = await connection.query<RowDataPacket[]>(
                    "SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status != 'paid'",
                    [isolationData.customer_id]
                );

                const hasUnpaidInvoices = unpaidCheck.length > 0 && unpaidCheck[0].count > 0;

                if (hasUnpaidInvoices && isolationData.performed_by === 'system') {
                    // Block AI/System from auto-restoring if there are unpaid invoices
                    throw new Error('BLOCKED: Cannot auto-restore. Customer has unpaid invoices.');
                } else if (hasUnpaidInvoices && isolationData.performed_by !== 'system') {
                    // Allow Admin/Operator to manually restore but log a warning
                    console.warn(`[IsolationService] ⚠️ MANUAL OVERRIDE: Admin "${isolationData.performed_by}" is restoring customer ${isolationData.customer_id} with ${unpaidCheck[0].count} unpaid invoice(s). This bypasses the payment verification.`);

                    // Log this override action for audit trail
                    await connection.execute(
                        `INSERT INTO customer_logs (customer_id, action, description, created_by, created_at) 
                         VALUES (?, 'manual_restore_override', ?, ?, NOW())`,
                        [
                            isolationData.customer_id,
                            `Admin manually restored customer with ${unpaidCheck[0].count} unpaid invoice(s). Reason: ${isolationData.reason}`,
                            isolationData.performed_by
                        ]
                    );
                }
            }

            const [customerResult] = await connection.execute(
                `SELECT c.*, s.package_name, s.price FROM customers c 
                 LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                 WHERE c.id = ?`,
                [isolationData.customer_id]
            );
            const customer = (customerResult as any)[0];

            if (!customer) throw new Error('Customer not found');

            const mikrotikResult = await this.executeMikrotikIsolation(customer, isolationData.action, connection);

            // Log it
            let mikrotikUsername = '';
            if (customer.connection_type === 'pppoe') {
                mikrotikUsername = customer.pppoe_username || customer.customer_code || '';
            } else if (customer.connection_type === 'static_ip') {
                const [staticRows] = await connection.execute('SELECT ip_address FROM static_ip_clients WHERE customer_id = ? LIMIT 1', [customer.id]);
                mikrotikUsername = (staticRows as any)[0]?.ip_address || '';
            }

            await connection.execute(
                `INSERT INTO isolation_logs (customer_id, action, reason, performed_by, mikrotik_username, mikrotik_response) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [isolationData.customer_id, isolationData.action, isolationData.reason, isolationData.performed_by === 'system' ? 0 : (isolationData.performed_by || 0), mikrotikUsername, `[${mikrotikResult.method}] ${mikrotikResult.detail}`]
            );

            // Update status
            if (isolationData.action === 'isolate') {
                await connection.execute('UPDATE customers SET is_isolated = TRUE, isolated_at = NOW() WHERE id = ?', [customer.id]);
            } else {
                await connection.execute('UPDATE customers SET is_isolated = FALSE, isolated_at = NULL WHERE id = ?', [customer.id]);
            }

            if (isNewConnection) await (connection as PoolConnection).commit();

            // Notification
            if (customer.phone) {
                try {
                    await this.ensureIsolationTemplateExists();

                    let notifyType: 'service_blocked' | 'service_unblocked' | 'service_blocked_system' = isolationData.action === 'isolate' ? 'service_blocked' : 'service_unblocked';

                    // Specific type for system auto-isolation
                    if (isolationData.action === 'isolate' && isolationData.performed_by === 'system') {
                        notifyType = 'service_blocked_system';
                    }

                    await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        notification_type: notifyType,
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name,
                            reason: isolationData.reason,
                            details: `Kode: ${customer.customer_code}`,
                            performed_by: isolationData.performed_by === 'system' ? 'Asisten AI' : 'Admin'
                        },
                        priority: isolationData.action === 'isolate' ? 'high' : 'normal'
                    });
                } catch (e) { console.error('Notification failed', e); }
            }

            return mikrotikResult.success;

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Placeholder methods for other functionalities 
     * (Re-implemented minimally to keep file compiling)
     */
    /**
     * Send isolation warnings to customers who will be isolated soon
     */
    static async sendIsolationWarnings(daysBefore: number = 3): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            const warningDate = new Date();
            warningDate.setDate(warningDate.getDate() + daysBefore);
            const warningDateStr = warningDate.toISOString().split('T')[0];

            const query = `
                SELECT DISTINCT 
                    c.id, c.name, c.phone, c.customer_code,
                    i.id as invoice_id, i.invoice_number, i.remaining_amount, i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND DATE(i.due_date) = ?
                AND NOT EXISTS (
                    SELECT 1 FROM unified_notifications_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'isolation_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [warningDateStr]);

            for (const customer of customers) {
                try {
                    await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'isolation_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name,
                            invoice_number: customer.invoice_number,
                            amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            total_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            remaining_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            due_date: NotificationTemplateService.formatDate(new Date(customer.due_date)),
                            days_remaining: daysBefore.toString()
                        },
                        attachment_path: await UnifiedNotificationService.generateInvoicePdf(customer.invoice_id),
                        priority: 'high'
                    });
                    warned++;
                } catch (e) {
                    console.error(`Failed to warn customer ${customer.id}:`, e);
                    failed++;
                }
            }
        } finally {
            connection.release();
        }
        return { warned, failed };
    }

    /**
     * Send pre-block warnings (warning about block on the 1st)
     */
    static async sendPreBlockWarnings(): Promise<{ warned: number, failed: number }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            const now = new Date();
            const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const blockingDate = nextMonth.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            const query = `
                SELECT DISTINCT 
                    c.id, c.name, c.phone, c.customer_code,
                    i.id as invoice_id, i.invoice_number, i.remaining_amount
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.period = ?
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
                AND c.is_isolated = FALSE
                AND c.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM unified_notifications_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'pre_block_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [currentPeriod]);

            for (const customer of customers) {
                try {
                    const daysUntilBlock = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'pre_block_warning',
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name,
                            customer_code: customer.customer_code,
                            amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            total_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            remaining_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            blocking_date: blockingDate,
                            days_until_block: daysUntilBlock.toString()
                        },
                        attachment_path: await UnifiedNotificationService.generateInvoicePdf(customer.invoice_id),
                        priority: 'high'
                    });
                    warned++;
                } catch (e) {
                    console.error(`Failed to pre-block warn customer ${customer.id}:`, e);
                    failed++;
                }
            }
        } finally {
            connection.release();
        }
        return { warned, failed };
    }

    /**
     * Send H-1 isolation warnings (1 day before mass isolation date)
     */
    static async sendIsolationH1Warnings(): Promise<{ warned: number, failed: number, skipped?: string }> {
        const connection = await databasePool.getConnection();
        let warned = 0;
        let failed = 0;

        try {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const tomorrowDay = tomorrow.getDate();

            // Get isolation date from settings
            let isolateDate = 1;
            try {
                const [settings] = await databasePool.query<RowDataPacket[]>(
                    "SELECT config FROM scheduler_settings WHERE task_name = 'auto_isolation'"
                );
                if (settings.length > 0 && settings[0].config) {
                    const config = typeof settings[0].config === 'string' ? JSON.parse(settings[0].config) : settings[0].config;
                    if (config.isolir_date) isolateDate = config.isolir_date;
                }
            } catch (e) { console.warn('Could not fetch isolir_date', e); }

            // Only run if tomorrow is the isolation date
            if (tomorrowDay !== isolateDate) {
                return { warned: 0, failed: 0, skipped: `Tomorrow (${tomorrowDay}) is not the isolation date (${isolateDate})` };
            }

            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            const isolirDateDisplay = tomorrow.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            const query = `
                SELECT DISTINCT 
                    c.id, c.name, c.phone, c.customer_code,
                    i.id as invoice_id, i.invoice_number, i.remaining_amount
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.period = ?
                AND i.status != 'paid'
                AND c.is_isolated = FALSE
                AND c.is_deferred = FALSE
                AND c.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM unified_notifications_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'isolation_h1_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query, [prevPeriod]);

            for (const customer of customers) {
                try {
                    await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        invoice_id: customer.invoice_id,
                        notification_type: 'isolation_h1_warning' as any,
                        channels: ['whatsapp'],
                        variables: {
                            customer_name: customer.name,
                            customer_code: customer.customer_code,
                            amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            total_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            remaining_amount: NotificationTemplateService.formatCurrency(parseFloat(customer.remaining_amount)),
                            isolir_date: isolirDateDisplay
                        },
                        attachment_path: await UnifiedNotificationService.generateInvoicePdf(customer.invoice_id),
                        priority: 'high'
                    });
                    warned++;
                } catch (e) {
                    console.error(`Failed to H1 warn customer ${customer.id}:`, e);
                    failed++;
                }
            }
        } finally {
            connection.release();
        }
        return { warned, failed };
    }

    /**
     * Auto isolate customers with 1 or more unpaid/overdue invoices.
     * Excludes: partial invoices, deferred customers, and customers with active payment deferments.
     */
    static async autoIsolateOverdueCustomers(): Promise<{ isolated: number, failed: number }> {
        const query = `
            SELECT c.id, c.name, COUNT(i.id) as unpaid_count
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status NOT IN ('paid', 'partial')
            AND i.due_date < CURDATE()
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            AND c.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM payment_deferments pd 
                WHERE pd.customer_id = c.id 
                AND pd.status IN ('pending', 'approved') 
                AND pd.deferred_until_date >= CURDATE()
            )
            GROUP BY c.id
            HAVING unpaid_count >= 1
        `;

        const [customers] = await databasePool.execute<RowDataPacket[]>(query);
        let isolated = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'isolate',
                    reason: `Auto Lock system: Terdeteksi ${customer.unpaid_count} tagihan belum lunas`,
                    performed_by: 'system'
                });
                if (success) isolated++; else failed++;
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id}:`, error);
                failed++;
            }
        }
        return { isolated, failed };
    }

    /**
     * Auto isolate customers with previous month unpaid invoices (on configured date)
     */
    static async autoIsolatePreviousMonthUnpaid(): Promise<{ isolated: number, failed: number }> {
        const now = new Date();
        const currentDay = now.getDate();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

        // Get isolation date from settings
        let isolateDate = 1;
        try {
            const [settings] = await databasePool.query<RowDataPacket[]>(
                "SELECT config FROM scheduler_settings WHERE task_name = 'auto_isolation'"
            );
            if (settings.length > 0 && settings[0].config) {
                const config = typeof settings[0].config === 'string' ? JSON.parse(settings[0].config) : settings[0].config;
                if (config.isolir_date) isolateDate = config.isolir_date;
            }
        } catch (e) { console.warn('Could not fetch isolir_date, defaulting to 1', e); }

        if (currentDay < isolateDate) return { isolated: 0, failed: 0 };

        const query = `
            SELECT DISTINCT c.id, c.name
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.period = ?
            AND i.status NOT IN ('paid', 'partial')
            AND (i.due_date IS NULL OR i.due_date < CURDATE())
            AND c.is_isolated = FALSE
            AND c.is_deferred = FALSE
            AND c.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM payment_deferments pd 
                WHERE pd.customer_id = c.id 
                AND pd.status IN ('pending', 'approved') 
                AND pd.deferred_until_date >= CURDATE()
            )
        `;

        const [customers] = await databasePool.execute<RowDataPacket[]>(query, [prevPeriod]);
        let isolated = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'isolate',
                    reason: `Auto isolation: Tagihan bulan ${prevPeriod} belum lunas.`,
                    performed_by: 'system'
                });
                if (success) isolated++; else failed++;
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id}:`, error);
                failed++;
            }
        }
        return { isolated, failed };
    }

    /**
     * Auto isolate customers whose payment deferment (janji bayar) has expired.
     * When deferred_until_date has passed and invoice is still unpaid, isolate them.
     */
    static async autoIsolateDeferredExpired(): Promise<{ isolated: number, failed: number }> {
        const query = `
            SELECT DISTINCT c.id, c.name, pd.deferred_until_date
            FROM customers c
            JOIN payment_deferments pd ON pd.customer_id = c.id
            JOIN invoices i ON c.id = i.customer_id
            WHERE pd.status IN ('pending', 'approved')
            AND pd.deferred_until_date < CURDATE()
            AND i.status NOT IN ('paid')
            AND c.is_isolated = FALSE
            AND c.status = 'active'
        `;

        const [customers] = await databasePool.execute<RowDataPacket[]>(query);
        let isolated = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                // Update deferment status to 'completed' since date has passed
                await databasePool.execute(
                    `UPDATE payment_deferments SET status = 'completed' WHERE customer_id = ? AND status IN ('pending', 'approved') AND deferred_until_date < CURDATE()`,
                    [customer.id]
                );

                // Reset is_deferred flag
                await databasePool.execute(
                    'UPDATE customers SET is_deferred = FALSE WHERE id = ?',
                    [customer.id]
                );

                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'isolate',
                    reason: `Auto isolasi: Janji bayar (${new Date(customer.deferred_until_date).toLocaleDateString('id-ID')}) sudah lewat dan tagihan belum lunas.`,
                    performed_by: 'system'
                });
                if (success) isolated++; else failed++;
            } catch (error) {
                console.error(`Failed to isolate deferred customer ${customer.id}:`, error);
                failed++;
            }
        }
        return { isolated, failed };
    }

    /**
     * Auto restore customers who have paid all invoices
     */
    static async autoRestorePaidCustomers(): Promise<{ restored: number, failed: number }> {
        const query = `
            SELECT id, name FROM customers 
            WHERE is_isolated = TRUE 
            AND status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM invoices WHERE customer_id = customers.id AND status != 'paid'
            )
        `;

        const [customers] = await databasePool.execute<RowDataPacket[]>(query);
        let restored = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'restore',
                    reason: 'Auto restore: Semua tagihan telah lunas.',
                    performed_by: 'system'
                });
                if (success) restored++; else failed++;
            } catch (error) {
                console.error(`Failed to restore customer ${customer.id}:`, error);
                failed++;
            }
        }
        return { restored, failed };
    }

    static async getIsolationHistory(customerId?: number, limit: number = 50) {
        let query = 'SELECT il.*, c.name as customer_name FROM isolation_logs il JOIN customers c ON il.customer_id = c.id';
        const params: any[] = [];
        if (customerId) {
            query += ' WHERE il.customer_id = ?';
            params.push(customerId);
        }
        query += ' ORDER BY il.created_at DESC LIMIT ?';
        params.push(limit);
        const [result] = await databasePool.query(query, params);
        return result;
    }

    static async getIsolatedCustomers() {
        const [result] = await databasePool.execute('SELECT c.*, il.reason, il.created_at as isolated_at FROM customers c JOIN isolation_logs il ON c.id = il.customer_id WHERE c.is_isolated = TRUE AND il.action = "isolate" ORDER BY il.created_at DESC');
        return result;
    }

    static async bulkIsolateByOdc(odcId: number, reason: string): Promise<{ isolated: number, failed: number }> {
        const [customers] = await databasePool.execute<RowDataPacket[]>(
            'SELECT id FROM customers WHERE odc_id = ? AND is_isolated = FALSE AND status = "active"',
            [odcId]
        );
        let isolated = 0;
        let failed = 0;
        for (const customer of customers) {
            try {
                const success = await this.isolateCustomer({ customer_id: customer.id, action: 'isolate', reason, performed_by: 'admin' });
                if (success) isolated++; else failed++;
            } catch (e) { failed++; }
        }
        return { isolated, failed };
    }

    static async manualIsolate(customerId: number, action: 'isolate' | 'restore', reason: string, performedBy: string): Promise<boolean> {
        return await this.isolateCustomer({ customer_id: customerId, action, reason, performed_by: performedBy });
    }

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
            const [customers] = await connection.query<RowDataPacket[]>(query);
            console.log(`[AutoDelete] Found ${customers.length} customers blocked > 7 days`);
            for (const customer of customers) {
                try {
                    await connection.beginTransaction();
                    // Soft delete customer
                    await connection.query('UPDATE customers SET status = "deleted", deleted_at = NOW() WHERE id = ?', [customer.id]);
                    // Terminate subscription
                    await connection.query('UPDATE subscriptions SET status = "terminated", end_date = NOW() WHERE customer_id = ? AND status = "active"', [customer.id]);
                    // Log action
                    await connection.query(`
                        INSERT INTO customer_logs (customer_id, action, description, created_by, created_at)
                        VALUES (?, 'auto_delete', ?, 0, NOW())
                    `, [customer.id, `Auto deleted after 7 days of isolation (${customer.connection_type})`]);
                    await connection.commit();
                    // Send notification
                    try {
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
                    }
                    catch (e) {
                        console.error('Failed to send delete notification:', e);
                    }
                    deleted++;
                    console.log(`[AutoDelete] Soft deleted customer ${customer.name} (${customer.id}, ${customer.connection_type})`);
                }
                catch (err) {
                    await connection.rollback();
                    console.error(`[AutoDelete] Failed to delete customer ${customer.id}:`, err);
                    failed++;
                }
            }
            return { deleted, failed };
        }
        catch (error) {
            console.error('[AutoDelete] Error in auto delete process:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }

    static async getStatistics() {
        const [result]: any = await databasePool.query(`
            SELECT 
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE) as total_isolated,
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE AND connection_type = 'pppoe') as pppoe_isolated,
                (SELECT COUNT(*) FROM customers WHERE is_isolated = TRUE AND connection_type = 'static_ip') as static_ip_isolated,
                (SELECT COUNT(*) FROM isolation_logs WHERE action = 'isolate' AND DATE(created_at) = CURDATE()) as isolated_today,
                (SELECT COUNT(*) FROM isolation_logs WHERE action = 'restore' AND DATE(created_at) = CURDATE()) as restored_today
        `);
        return result[0];
    }

    /**
     * Startup Catch-Up Isolation
     * Dijalankan saat server start/restart untuk menangkap customer yang
     * seharusnya sudah terisolir tapi terlewat (misal server down saat jadwal cron).
     * Menggabungkan logika autoIsolateOverdueCustomers + autoIsolatePreviousMonthUnpaid.
     */
    static async startupCatchUpIsolation(): Promise<{ isolated: number, failed: number, skipped: number }> {
        console.log('[Startup Catch-Up] 🔍 Checking for customers that should be isolated...');

        let totalIsolated = 0;
        let totalFailed = 0;
        let totalSkipped = 0;

        try {
            // 1. Isolir customer yang punya invoice overdue (>= 1 invoice yang due_date sudah lewat)
            console.log('[Startup Catch-Up] Step 1: Checking overdue invoices (>= 1, exclude partial/deferred)...');
            const overdueResult = await this.autoIsolateOverdueCustomers();
            totalIsolated += overdueResult.isolated;
            totalFailed += overdueResult.failed;
            console.log(`[Startup Catch-Up] Step 1 done: ${overdueResult.isolated} isolated, ${overdueResult.failed} failed`);

            // 2. Isolir customer yang punya tagihan bulan sebelumnya belum lunas
            console.log('[Startup Catch-Up] Step 2: Checking previous month unpaid...');
            const prevMonthResult = await this.autoIsolatePreviousMonthUnpaid();
            totalIsolated += prevMonthResult.isolated;
            totalFailed += prevMonthResult.failed;
            console.log(`[Startup Catch-Up] Step 2 done: ${prevMonthResult.isolated} isolated, ${prevMonthResult.failed} failed`);

            // 3. Isolir customer yang janji bayar sudah lewat (deferred expired)
            console.log('[Startup Catch-Up] Step 3: Checking expired payment deferments...');
            const deferredResult = await this.autoIsolateDeferredExpired();
            totalIsolated += deferredResult.isolated;
            totalFailed += deferredResult.failed;
            console.log(`[Startup Catch-Up] Step 3 done: ${deferredResult.isolated} isolated, ${deferredResult.failed} failed`);

            // 4. Auto-restore customer yang sudah bayar semua (jaga konsistensi)
            console.log('[Startup Catch-Up] Step 4: Checking paid customers for auto-restore...');
            const restoreResult = await this.autoRestorePaidCustomers();
            console.log(`[Startup Catch-Up] Step 4 done: ${restoreResult.restored} restored, ${restoreResult.failed} failed`);

            console.log(`[Startup Catch-Up] ✅ Complete: ${totalIsolated} isolated, ${totalFailed} failed, ${restoreResult.restored} restored`);
        } catch (error) {
            console.error('[Startup Catch-Up] ❌ Error during catch-up isolation:', error);
        }

        return { isolated: totalIsolated, failed: totalFailed, skipped: totalSkipped };
    }
}
