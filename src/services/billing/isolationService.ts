import { databasePool } from '../../db/pool';
import { PoolConnection, ResultSetHeader, RowDataPacket, Pool } from 'mysql2/promise';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';
import { mikrotikPool } from '../MikroTikConnectionPool';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';
import { NotificationTemplateService } from '../notification/NotificationTemplateService';
import { InvoiceService } from './invoiceService';

export interface IsolationData {
    customer_id: number;
    action: 'isolate' | 'restore';
    reason: string;
    performed_by?: string;
    invoice_id?: number;
    unpaid_periods?: string;
    skipNotification?: boolean;
}

const ISOLATION_SYSTEM_TEMPLATE = {
    template_code: 'service_blocked_system',
    template_name: 'Isolir Otomatis by AI',
    notification_type: 'service_blocked_system',
    channel: 'whatsapp',
    title_template: '🚨 LAYANAN TERBLOKIR OTOMATIS',
    message_template: '🚨 *PEMBERITAHUAN ISOLIR OTOMATIS* 🚨\n\nHalo *{customer_name}*,\n\nMohon maaf, layanan internet Anda telah *DIBLOKIR OTOMATIS* oleh *{performed_by}* karena adanya tagihan yang melewati batas jatuh tempo.\n\n📝 *DETAIL:* \n━━━━━━━━━━━━━━━\n👤 Nama: {customer_name}\n📅 Tunggakan Bulan: {unpaid_periods}\n📦 Alasan: {reason}\n{details}\n━━━━━━━━━━━━━━━\n\n💡 *SOLUSI:* \nSegera lakukan pembayaran tagihan Anda melalui menu tagihan. Layanan akan otomatis aktif kembali dalam hitungan menit setelah pembayaran diverifikasi oleh sistem.\n\nKetik *Menu* untuk cek tagihan atau bantuan lainnya.',
    variables: ['customer_name', 'reason', 'details', 'performed_by', 'unpaid_periods'],
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
            // If action is restore, we want to enable (disabled=no). 
            // If action is isolate OR customer is specifically status=inactive (and NOT a restore action), keep it disabled.
            const disabled = (action === 'isolate' || (action !== 'restore' && customer.status === 'inactive')) ? 'yes' : 'no';

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
                let gwId = staticIpClient.gateway_ip_id;
                let targetGwIp = staticIpClient.gateway_ip;

                if (!gwId) {
                    console.log(`[Isolation] 🔍 Searching gateway ID for Customer Code: ${customer.customer_code} or IP: ${targetGwIp || 'unknown'}`);
                    try {
                        const ips = await mikrotikPool.execute(config, '/ip/address/print', []);
                        if (Array.isArray(ips)) {
                            const found = ips.find((ip: any) =>
                                (targetGwIp && (ip.address === targetGwIp || ip.address.split('/')[0] === targetGwIp)) ||
                                (ip.comment && ip.comment.includes(customer.customer_code)) ||
                                (ip.comment && customer.pppoe_username && ip.comment.includes(customer.pppoe_username))
                            );
                            if (found) {
                                gwId = found['.id'];
                                targetGwIp = found.address;
                                console.log(`[Isolation] ✅ Found gateway ${targetGwIp} (ID: ${gwId}) matching customer ${customer.customer_code}`);
                            }
                        }
                    } catch (e: any) {
                        console.error('[Isolation] Failed finding IP address in Mikrotik:', e.message);
                    }
                }

                if (gwId) {
                    try {
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
                    } catch (e: any) {
                        console.error('[Isolation] GW step failed:', e.message);
                    }
                } else {
                    console.warn(`[Isolation] ⚠️ Could not find gateway entry for ${targetGwIp || customer.customer_code} in MikroTik`);
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

            const [customerResult] = await connection.execute(
                `SELECT c.*, s.package_name, s.price FROM customers c 
                 LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                 WHERE c.id = ?`,
                [isolationData.customer_id]
            );
            const customer = (customerResult as any)[0];

            if (!customer) {
                if (isNewConnection) await (connection as PoolConnection).rollback();
                console.error(`[Isolation] Customer ${isolationData.customer_id} not found`);
                return false;
            }

            // Security Check: Verify unpaid invoices before restore
            if (isolationData.action === 'restore') {
                const [unpaidCheck] = await connection.query<RowDataPacket[]>(
                    "SELECT period FROM invoices WHERE customer_id = ? AND status NOT IN ('paid', 'cancelled') AND (remaining_amount > 0 OR status != 'paid') ORDER BY period ASC",
                    [isolationData.customer_id]
                );
                
                const hasUnpaidInvoices = unpaidCheck.length > 0;
                const periods = (unpaidCheck as any[]).map(inv => InvoiceService.getMonthName(inv.period)).join(', ');

                if (hasUnpaidInvoices && (isolationData.performed_by === 'system' || isolationData.performed_by === '0')) {
                    // Notify Admin about the remaining debt that prevents un-isolation
                    const adminMsg = `⚠️ *AUTO-RESTORE BLOCKED*\n\n` +
                        `👤 Pelanggan: *${customer.name}*\n` +
                        `🆔 Kode: ${customer.customer_code}\n\n` +
                        `Sistem mencoba memulihkan koneksi, namun dibatalkan karena pelanggan *masih memiliki tunggakan* di bulan: *${periods}*.\n\n` +
                        `Akses tetap terblokir sampai semua lunas.`;
                    
                    await UnifiedNotificationService.broadcastToAdmins(adminMsg).catch(e => console.error('Failed to notify admin about remaining debt:', e));
                    
                    return false; // Silently fail return if auto
                } else if (hasUnpaidInvoices && isolationData.performed_by !== 'system') {
                    // Allow Admin/Operator to manually restore but log a warning
                    console.warn(`[IsolationService] ⚠️ MANUAL OVERRIDE: Admin "${isolationData.performed_by}" is restoring customer ${isolationData.customer_id} with unpaid periods: ${periods}`);
                    
                    const adminMsg = `💡 *INFO RESTORE MANUAL*\n\n` +
                        `Admin *${isolationData.performed_by}* melakukan pemulihan manual akses internet untuk *${customer.name}* (${customer.customer_code}).\n\n` +
                        `⚠️ *CATATAN:* Pelanggan sebenarnya masih memiliki tunggakan di bulan: *${periods}*.`;
                    
                    await UnifiedNotificationService.broadcastToAdmins(adminMsg).catch(e => console.error('Failed to notify admin about override:', e));

                    // Log this override action for audit trail
                    await connection.execute(
                        `INSERT INTO customer_logs (customer_id, action, description, created_by, created_at) 
                         VALUES (?, 'manual_restore_override', ?, ?, NOW())`,
                        [
                            isolationData.customer_id,
                            `Admin manually restored customer with ${unpaidCheck.length} unpaid period(s). Reason: ${isolationData.reason}`,
                            isolationData.performed_by
                        ]
                    );
                }
            }



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
                // If it's a system-initiated auto-isolation (likely due to overdue), we also disable the account in the system
                if (isolationData.performed_by === 'system') {
                    await connection.execute('UPDATE customers SET is_isolated = TRUE, isolated_at = NOW(), status = "inactive" WHERE id = ?', [customer.id]);
                    console.log(`[Isolation] ⛔ Customer ${customer.name} status set to INACTIVE (system auto-isolate)`);
                } else {
                    await connection.execute('UPDATE customers SET is_isolated = TRUE, isolated_at = NOW() WHERE id = ?', [customer.id]);
                }
            } else {
                // When restoring, we set status back to 'active' if they were isolated (TRUE) OR if they were inactive 
                // but we are restoring. This fixes the issue where system auto-isolate sets status="inactive".
                if (customer.is_isolated || customer.status === 'inactive') {
                    await connection.execute('UPDATE customers SET is_isolated = FALSE, isolated_at = NULL, status = "active" WHERE id = ?', [customer.id]);
                    console.log(`[Isolation] ✅ Customer ${customer.name} status set to ACTIVE (service restored and un-isolated)`);
                } else {
                    await connection.execute('UPDATE customers SET is_isolated = FALSE, isolated_at = NULL WHERE id = ?', [customer.id]);
                    console.log(`[Isolation] ✅ Customer ${customer.name} is_isolated reset, but status remains ${customer.status}`);
                }
            }

            if (isNewConnection) await (connection as PoolConnection).commit();

            // Broadcast to Admins/Operators for Un-Isolation
            if (isolationData.action === 'restore') {
                try {
                    await UnifiedNotificationService.broadcastToAdmins(`✅ *INFO UN-ISOLIR KONEKSI*\n\nPelanggan: ${customer.name} (${customer.customer_code})\nTelah aktif kembali / un-isolir.\nAlasan: ${isolationData.reason}\nOleh: ${isolationData.performed_by}`);
                } catch (e) {
                    console.error('Failed to broadcast unisolir to admins', e);
                }
            }

            // Notification (with duplicate protection to prevent spam)
            if (customer.phone && !isolationData.skipNotification) {
                try {
                    await this.ensureIsolationTemplateExists();

                    let notifyType: 'service_blocked' | 'service_unblocked' | 'service_blocked_system' = isolationData.action === 'isolate' ? 'service_blocked' : 'service_unblocked';

                    // Specific type for system auto-isolation
                    if (isolationData.action === 'isolate' && isolationData.performed_by === 'system') {
                        notifyType = 'service_blocked_system';
                    }

                    // DUPLICATE PROTECTION: Check if same notification was already sent today
                    const checkConn = existingConnection || databasePool;
                    const [existingNotif] = await checkConn.query<RowDataPacket[]>(
                        `SELECT 1 FROM unified_notifications_queue 
                         WHERE customer_id = ? AND notification_type = ? 
                         AND DATE(created_at) = CURDATE() LIMIT 1`,
                        [customer.id, notifyType]
                    );

                    if ((existingNotif as any[]).length > 0) {
                        console.log(`[Isolation] ⏭️ Skipping duplicate ${notifyType} notification for ${customer.name} (already sent today)`);
                    } else {
                        await UnifiedNotificationService.queueNotification({
                            customer_id: customer.id,
                            invoice_id: isolationData.invoice_id,
                            notification_type: notifyType,
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: customer.name,
                                reason: isolationData.reason.split('(Bulan:')[0].trim(),
                                details: `Kode: ${customer.customer_code}`,
                                performed_by: isolationData.performed_by === 'system' ? 'Asisten AI' : 'Admin',
                                unpaid_periods: isolationData.unpaid_periods || '-'
                            },
                            attachment_path: isolationData.invoice_id ? await UnifiedNotificationService.generateInvoicePdf(isolationData.invoice_id) : undefined,
                            priority: isolationData.action === 'isolate' ? 'high' : 'normal'
                        });
                    }
                } catch (e) { console.error('Notification failed', e); }
            }

            return mikrotikResult.success;

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) (connection as PoolConnection).release();
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
                    i.id as invoice_id, i.invoice_number, i.remaining_amount, i.due_date
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND i.remaining_amount > 0
                AND i.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
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
                            blocking_date: new Date(customer.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                            days_until_block: Math.ceil((new Date(customer.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)).toString()
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
            // Target customers based on their specific due date/isolation schedule
            // H-1 before deadline or custom isolation date
            const targetIsolationDate = new Date(tomorrow);
            const targetIsolationDisplay = targetIsolationDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            // Disabled fixed date check
            /*
            if (tomorrowDay !== isolateDate) {
                return { warned: 0, failed: 0, skipped: `Tomorrow (${tomorrowDay}) is not the isolation date (${isolateDate})` };
            }
            */

            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
            const isolirDateDisplay = tomorrow.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            const query = `
                SELECT DISTINCT 
                    c.id, c.name, c.phone, c.customer_code,
                    i.id as invoice_id, i.invoice_number, i.remaining_amount, i.due_date,
                    DATEDIFF(CURDATE(), i.due_date) as days_overdue
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE i.status NOT IN ('paid', 'cancelled')
                AND i.remaining_amount > 0
                AND i.due_date < CURDATE()
                AND DATEDIFF(CURDATE(), i.due_date) BETWEEN 1 AND 2
                AND c.is_isolated = FALSE
                AND c.is_deferred = FALSE
                AND c.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM payment_deferments pd
                    WHERE pd.customer_id = c.id
                    AND pd.status IN ('pending', 'approved')
                    AND pd.deferred_until_date >= CURDATE()
                )
                AND NOT EXISTS (
                    SELECT 1 FROM unified_notifications_queue nq
                    WHERE nq.customer_id = c.id
                    AND nq.notification_type = 'isolation_h1_warning'
                    AND DATE(nq.created_at) = CURDATE()
                )
            `;

            const [customers] = await connection.query<RowDataPacket[]>(query);

            for (const customer of customers) {
                try {
                    const daysLeft = 3 - customer.days_overdue;
                    const isolationDate = new Date();
                    isolationDate.setDate(isolationDate.getDate() + daysLeft);
                    const isolirDateDisplay = isolationDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

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
                            isolir_date: isolirDateDisplay,
                            days_left: daysLeft
                        },
                        attachment_path: await UnifiedNotificationService.generateInvoicePdf(customer.invoice_id),
                        priority: 'high'
                    });
                    warned++;
                } catch (e) {
                    console.error(`Failed to grace period warn customer ${customer.id}:`, e);
                    failed++;
                }
            }
        } finally {
            connection.release();
        }
        return { warned, failed };
    }

    /**
     * Auto isolate customers with overdue invoices past grace period.
     * Grace Period = 3 days after due_date.
     * Excludes: partial invoices, deferred customers, and customers with active payment deferments.
     */
    static async autoIsolateOverdueCustomers(): Promise<{ isolated: number, failed: number }> {
        const GRACE_PERIOD_DAYS = 3;

        const query = `
            SELECT 
                c.id, c.name, 
                COUNT(i.id) as unpaid_count,
                GROUP_CONCAT(i.period ORDER BY i.period ASC) as periods,
                MAX(i.id) as latest_invoice_id,
                MIN(i.due_date) as oldest_due_date
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.status NOT IN ('paid', 'partial', 'cancelled')
            AND i.due_date < DATE_SUB(CURDATE(), INTERVAL ${GRACE_PERIOD_DAYS} DAY)
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
        `;

        const [customers] = await databasePool.execute<RowDataPacket[]>(query);
        let isolated = 0;
        let failed = 0;

        for (const customer of customers) {
            try {
                const periods = customer.periods ? customer.periods.split(',').map((p: string) => {
                    const [year, month] = p.split('-');
                    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    return monthName;
                }).join(', ') : '';

                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'isolate',
                    reason: `Tagihan belum dibayar melewati batas masa tenggang ${GRACE_PERIOD_DAYS} hari (${periods}).`,
                    performed_by: 'system',
                    invoice_id: customer.latest_invoice_id,
                    unpaid_periods: periods
                });
                if (success) isolated++; else failed++;
            } catch (error) {
                console.error(`Failed to isolate customer ${customer.id}:`, error);
                failed++;
            }
        }

        // Broadcast to Admins if any customers were isolated
        if (isolated > 0) {
            try {
                await UnifiedNotificationService.broadcastToAdmins(
                    `🚨 *LAPORAN ISOLIR OTOMATIS*\n\n` +
                    `Sistem AI telah mengisolir *${isolated}* pelanggan yang melewati masa tenggang ${GRACE_PERIOD_DAYS} hari.\n\n` +
                    `Gagal: ${failed}`
                );
            } catch (e) {
                console.warn('Failed to broadcast auto-isolation report:', e);
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
                let config = settings[0].config;
                if (typeof config === 'string' && config.trim()) {
                    try {
                        config = JSON.parse(config);
                    } catch (parseError) {
                        console.warn('[Isolation] Failed to parse config JSON, using empty object', parseError);
                        config = {};
                    }
                }
                if (config && config.isolir_date) isolateDate = config.isolir_date;
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
                    reason: `Sistem AI mendeteksi penunggakan tagihan bulan ${prevPeriod} tanpa info yang jelas, koneksi diputus sementara.`,
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
            AND NOT EXISTS (
                SELECT 1 FROM invoices WHERE customer_id = customers.id AND status IN ('sent', 'partial', 'overdue') AND remaining_amount > 0
            )
            AND NOT EXISTS (
                SELECT 1 FROM isolation_logs 
                WHERE customer_id = customers.id 
                AND action = 'restore' 
                AND DATE(created_at) = CURDATE()
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

    /**
     * Restore specific customer if they have no more unpaid invoices
     */
    static async restoreIfQualified(customerId: number, existingConnection?: PoolConnection | Pool): Promise<boolean> {
        const connection = existingConnection || databasePool;

        try {
            // Check if customer is currently isolated
            const [customerResult] = await connection.query<RowDataPacket[]>(
                "SELECT id, is_isolated, name FROM customers WHERE id = ?",
                [customerId]
            );

            const customer = customerResult[0];
            if (!customer || !customer.is_isolated) {
                return false;
            }

            // Check for any truly unpaid invoices (excluding draft/cancelled)
            const [unpaidResult] = await connection.query<RowDataPacket[]>(
                "SELECT id, invoice_number, status, remaining_amount FROM invoices WHERE customer_id = ? AND status IN ('sent', 'partial', 'overdue') AND remaining_amount > 0",
                [customerId]
            );

            if (unpaidResult.length === 0) {
                console.log(`[Isolation] 🔓 Customer ${customer.name} (#${customerId}) qualified for auto-restore. No unpaid invoices remaining.`);
                try {
                    const result = await this.isolateCustomer({
                        customer_id: customerId,
                        action: 'restore',
                        reason: 'Auto restore: Tagihan telah lunas (Pembayaran Terverifikasi)',
                        performed_by: 'system'
                    }, existingConnection);
                    console.log(`[Isolation] ${result ? '✅' : '❌'} Auto-restore result for ${customer.name}: ${result}`);
                    return result;
                } catch (restoreError: any) {
                    console.error(`[Isolation] ❌ Auto-restore FAILED for ${customer.name} (#${customerId}):`, restoreError.message);
                    return false;
                }
            } else {
                console.log(`[Isolation] ⏳ Customer ${customer.name} (#${customerId}) still has ${unpaidResult.length} unpaid invoice(s): ${unpaidResult.map((i: any) => i.invoice_number).join(', ')}`);
            }

            return false;
        } catch (error: any) {
            console.error(`[Isolation] Error in restoreIfQualified for customer ${customerId}:`, error.message);
            return false;
        }
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

    /**
     * Restore all isolated customers without sending notifications
     */
    static async bulkRestoreAllSilent(performedBy: string = 'admin'): Promise<{ restored: number, failed: number }> {
        const [customers] = await databasePool.execute<RowDataPacket[]>(
            'SELECT id, name FROM customers WHERE is_isolated = TRUE'
        );

        let restored = 0;
        let failed = 0;

        console.log(`[Isolation] 🔓 Starting BULK SILENT RESTORE for ${customers.length} customers...`);

        for (const customer of customers) {
            try {
                const success = await this.isolateCustomer({
                    customer_id: customer.id,
                    action: 'restore',
                    reason: 'Bulk Silent Restore: Pemulihan massal tanpa notifikasi.',
                    performed_by: performedBy,
                    skipNotification: true
                });

                if (success) restored++; else failed++;
            } catch (error) {
                console.error(`[Isolation] Failed to bulk restore customer ${customer.id}:`, error);
                failed++;
            }
        }

        return { restored, failed };
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
     * Get customers who are at risk of isolation or in manual bypass
     */
    static async getIsolationWatchlist() {
        const GRACE_PERIOD_DAYS = 3;
        const query = `
            SELECT 
                c.id, c.name, c.customer_code, c.phone, c.connection_type, c.is_isolated,
                COUNT(i.id) as unpaid_count,
                GROUP_CONCAT(i.period ORDER BY i.period ASC SEPARATOR ', ') as periods,
                MIN(i.due_date) as oldest_due_date,
                DATEDIFF(CURDATE(), MIN(i.due_date)) as days_overdue,
                il.created_at as last_restore_at,
                il.performed_by as restored_by,
                il.reason as restore_reason,
                CASE 
                    WHEN DATEDIFF(CURDATE(), MIN(i.due_date)) > ${GRACE_PERIOD_DAYS} THEN 'manual_bypass'
                    WHEN DATEDIFF(CURDATE(), MIN(i.due_date)) >= ${GRACE_PERIOD_DAYS} THEN 'at_risk_urgent'
                    ELSE 'at_risk_warning'
                END as risk_level
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            LEFT JOIN isolation_logs il ON c.id = il.customer_id AND il.action = 'restore' 
                AND il.created_at = (SELECT MAX(created_at) FROM isolation_logs WHERE customer_id = c.id AND action = 'restore')
            WHERE i.status NOT IN ('paid', 'partial', 'cancelled', 'overdue_not_handled')
            AND i.due_date <= CURDATE()
            AND c.is_isolated = FALSE
            AND c.status = 'active'
            AND c.is_deferred = FALSE
            GROUP BY c.id
            ORDER BY risk_level DESC, oldest_due_date ASC
        `;
        const [result] = await databasePool.execute(query);
        return result;
    }

    /**
     * Get customers who are whitelisted (exempt from auto-isolation)
     */
    static async getIsolationWhitelist() {
        const query = `
            SELECT 
                c.id, c.name, c.customer_code, c.phone, c.connection_type, c.is_isolated,
                c.is_deferred,
                pd.deferred_until_date,
                pd.reason as defer_reason,
                pd.created_at as deferred_at,
                (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND status NOT IN ('paid', 'cancelled') AND remaining_amount > 0) as unpaid_count
            FROM customers c
            LEFT JOIN payment_deferments pd ON c.id = pd.customer_id AND pd.status IN ('pending', 'approved')
            WHERE c.is_deferred = TRUE
            ORDER BY c.name ASC
        `;
        const [result] = await databasePool.execute(query);
        return result;
    }

    /**
     * Remove customer from isolation whitelist (cancel deferment)
     */
    static async removeIsolationDeferment(customerId: number, performedBy: string = 'admin'): Promise<boolean> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Update active deferments to cancelled
            await connection.execute(
                `UPDATE payment_deferments 
                 SET status = 'cancelled', updated_at = NOW() 
                 WHERE customer_id = ? AND status IN ('pending', 'approved')`,
                [customerId]
            );

            // 2. Clear flag in customers table
            await connection.execute(
                'UPDATE customers SET is_deferred = FALSE WHERE id = ?',
                [customerId]
            );

            // 3. Log the action
            await connection.execute(
                `INSERT INTO customer_logs (customer_id, action, description, created_by) 
                 VALUES (?, 'deferment_cancelled', 'Penagguhan (Whitelist) dibatalkan secara manual.', ?)`,
                [customerId, performedBy]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            console.error('[Isolation] Failed to remove deferment:', error);
            return false;
        } finally {
            connection.release();
        }
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

    /**
     * Mass isolate customers based on unpaid invoices in a specific period
     */
    static async massIsolateSpecificPeriod(period: string): Promise<{ isolated: number, failed: number }> {
        const query = `
            SELECT DISTINCT i.customer_id, i.id as latest_invoice_id, i.period
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.period = ?
            AND i.status NOT IN ('paid', 'cancelled')
            AND c.is_isolated = FALSE
            AND c.status = 'active'
        `;

        const [results] = await databasePool.execute<RowDataPacket[]>(query, [period]);
        let isolated = 0;
        let failed = 0;

        console.log(`[Isolation] 🚨 MASS ISOLATION START for period ${period}. Targets: ${results.length}`);

        for (const row of results) {
            try {
                const monthName = InvoiceService.getMonthName(row.period);
                const success = await this.isolateCustomer({
                    customer_id: row.customer_id,
                    action: 'isolate',
                    reason: `ISOLASI MASSAL: Tagihan bulan ${monthName} belum dilunasi.`,
                    performed_by: 'system',
                    invoice_id: row.latest_invoice_id,
                    unpaid_periods: monthName
                });
                
                if (success) isolated++; else failed++;
            } catch (error) {
                console.error(`[Isolation] Failed to mass isolate customer ${row.customer_id}:`, error);
                failed++;
            }
        }

        // Broadcast to Admins
        if (isolated > 0 || failed > 0) {
            try {
                await UnifiedNotificationService.broadcastToAdmins(
                    `🚨 *LAPORAN ISOLASI MASSAL*\n\n` +
                    `Layanan otomatis telah mengisolir penunggak periode *${period}*.\n\n` +
                    `✅ Berhasil: *${isolated}*\n` +
                    `❌ Gagal: *${failed}*\n` +
                    `📅 Penjadwalan: 1 April 01:00 pagi`
                );
            } catch (e) {
                console.warn('Failed to broadcast mass isolation report:', e);
            }
        }

        return { isolated, failed };
    }
}
