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
     */
    private static async executeMikrotikIsolation(
        customer: any,
        action: 'isolate' | 'restore'
    ): Promise<MikrotikIsolateResult> {
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
                    `.id=${targetSecret['.id']}`,
                    `=disabled=${disabled}`
                ]);

                if (action === 'isolate') {
                    const activeSessions = await mikrotikPool.execute(config, '/ppp/active/print', [`?name=${targetSecret.name}`]);
                    if (Array.isArray(activeSessions)) {
                        for (const session of activeSessions) {
                            await mikrotikPool.execute(config, '/ppp/active/remove', [`.id=${session['.id']}`]);
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
                const [staticIpRows] = await databasePool.execute(
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
                                await databasePool.execute(
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
    static async isolateCustomer(isolationData: IsolationData): Promise<boolean> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

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

            const mikrotikResult = await this.executeMikrotikIsolation(customer, isolationData.action);

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

            await connection.commit();

            // Notification
            if (customer.phone) {
                try {
                    const notifyType = isolationData.action === 'isolate' ? 'service_blocked' : 'service_unblocked';
                    await UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        notification_type: notifyType,
                        channels: ['whatsapp'],
                        variables: { customer_name: customer.name, reason: isolationData.reason, details: `Kode: ${customer.customer_code}` },
                        priority: isolationData.action === 'isolate' ? 'high' : 'normal'
                    });
                } catch (e) { console.error('Notification failed', e); }
            }

            return mikrotikResult.success;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Placeholder methods for other functionalities 
     * (Re-implemented minimally to keep file compiling)
     */
    static async sendIsolationWarnings(daysBefore: number = 3): Promise<{ warned: number, failed: number }> {
        return { warned: 0, failed: 0 };
    }
    static async sendPreBlockWarnings(): Promise<{ warned: number, failed: number }> {
        return { warned: 0, failed: 0 };
    }
    static async sendIsolationH1Warnings(): Promise<{ warned: number, failed: number, skipped: string }> {
        return { warned: 0, failed: 0, skipped: '' };
    }
    static async autoIsolateOverdueCustomers(): Promise<{ isolated: number, failed: number }> {
        return { isolated: 0, failed: 0 };
    }
    static async autoIsolatePreviousMonthUnpaid(): Promise<{ isolated: number, failed: number }> {
        return { isolated: 0, failed: 0 };
    }
    static async autoRestorePaidCustomers(): Promise<{ restored: number, failed: number }> {
        return { restored: 0, failed: 0 };
    }
    static async getIsolationHistory(customerId?: number, limit: number = 50) {
        const [result] = await databasePool.query('SELECT * FROM isolation_logs ORDER BY created_at DESC LIMIT ?', [limit]);
        return result;
    }
    static async getIsolatedCustomers() {
        const [result] = await databasePool.execute('SELECT * FROM customers WHERE is_isolated = TRUE');
        return result;
    }
    static async bulkIsolateByOdc(odcId: number, reason: string): Promise<{ isolated: number, failed: number }> {
        return { isolated: 0, failed: 0 };
    }
    static async manualIsolate(customerId: number, action: 'isolate' | 'restore', reason: string, performedBy: string): Promise<boolean> {
        return await this.isolateCustomer({ customer_id: customerId, action, reason, performed_by: performedBy });
    }
    static async autoDeleteBlockedCustomers(): Promise<{ deleted: number, failed: number }> {
        return { deleted: 0, failed: 0 };
    }
    static async getStatistics() {
        return { total_isolated: 0, pppoe_isolated: 0, static_ip_isolated: 0, isolated_today: 0, restored_today: 0 };
    }
}
