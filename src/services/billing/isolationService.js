"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsolationService = void 0;
const pool_1 = require("../../db/pool");
const UnifiedNotificationService_1 = require("../notification/UnifiedNotificationService");
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
class IsolationService {
    /**
     * Execute MikroTik isolation based on customer connection type
     */
    static async executeMikrotikIsolation(customer, action) {
        console.log(`[Isolation] 🤖 Starting executeMikrotikIsolation for ${customer.name} (ID: ${customer.id}, Type: ${customer.connection_type}, Action: ${action})`);
        try {
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
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
                let secrets = await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/secret/print', [`?name=${pppoeUsername}`]);
                let targetSecret = null;
                if (Array.isArray(secrets) && secrets.length > 0) {
                    targetSecret = secrets[0];
                }
                else {
                    const allSecrets = await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/secret/print', []);
                    targetSecret = allSecrets.find((s) => {
                        var _a;
                        return ((_a = s.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === pppoeUsername.toLowerCase() ||
                            (s.comment && s.comment.toLowerCase().includes(String(customer.customer_code).toLowerCase()));
                    });
                }
                if (!targetSecret) {
                    return { success: false, method: 'pppoe', detail: `PPPoE secret not found: ${pppoeUsername}` };
                }
                await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/secret/set', [
                    `.id=${targetSecret['.id']}`,
                    `=disabled=${disabled}`
                ]);
                if (action === 'isolate') {
                    const activeSessions = await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/active/print', [`?name=${targetSecret.name}`]);
                    if (Array.isArray(activeSessions)) {
                        for (const session of activeSessions) {
                            await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/active/remove', [`.id=${session['.id']}`]);
                        }
                    }
                }
                return {
                    success: true,
                    method: 'pppoe',
                    detail: `PPPoE ${targetSecret.name} ${action === 'isolate' ? 'disabled' : 'enabled'}`
                };
            }
            else if (connectionType === 'static_ip') {
                // ============== STATIC IP ISOLATION ==============
                const [staticIpRows] = await pool_1.databasePool.execute(`SELECT ip_address, gateway_ip, gateway_ip_id, interface FROM static_ip_clients WHERE customer_id = ? ORDER BY id DESC LIMIT 1`, [customer.id]);
                const staticIpClient = staticIpRows[0];
                if (!staticIpClient) {
                    return { success: false, method: 'static_ip', detail: 'Static IP client data not found' };
                }
                let executionSteps = [];
                let stepSuccessCount = 0;
                const pureIp = staticIpClient.ip_address ? staticIpClient.ip_address.split('/')[0] : null;
                // Step 1: Disable Gateway Entry in /ip/address
                // Step 1: Disable IP Entry in /ip/address
                // We prioritize searching for the Customer's IP (pureIp) over the Gateway IP, 
                // because the user wants to disable "ip mikrotk 192.168.238.37" which is likely the customer's IP.
                const targetIp = pureIp || staticIpClient.gateway_ip;

                if (targetIp || staticIpClient.gateway_ip_id) {
                    try {
                        let targetId = staticIpClient.gateway_ip_id;

                        if (!targetId && targetIp) {
                            console.log(`[Isolation] 🔍 Searching /ip/address ID for IP: ${targetIp}`);
                            const ips = await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ip/address/print', []);

                            if (Array.isArray(ips)) {
                                // Find entry where address starts with the target IP (handling /24 etc)
                                const found = ips.find((ip) => {
                                    const ipNoCidr = ip.address.split('/')[0];
                                    return ipNoCidr === targetIp ||
                                        (staticIpClient.gateway_ip && ipNoCidr === staticIpClient.gateway_ip) ||
                                        (ip.comment && ip.comment.includes(customer.customer_code));
                                });

                                if (found) {
                                    targetId = found['.id'];
                                    console.log(`[Isolation] ✅ Found ID ${targetId} for IP ${found.address}`);
                                }
                            }
                        }

                        if (targetId) {
                            await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ip/address/set', [
                                `=.id=${targetId}`,
                                `=disabled=${disabled}`
                            ]);
                            executionSteps.push(`IP Address ${targetIp} ${disabled === 'yes' ? 'DISABLED' : 'ENABLED'}`);
                            stepSuccessCount++;

                            // Update stored ID if it was missing and we found it based on IP
                            if (!staticIpClient.gateway_ip_id) {
                                await pool_1.databasePool.execute('UPDATE static_ip_clients SET gateway_ip_id = ? WHERE customer_id = ?', [targetId, customer.id]);
                            }
                        }
                        else {
                            console.warn(`[Isolation] ⚠️ Could not find /ip/address entry for ${targetIp} in MikroTik`);
                        }
                    }
                    catch (e) {
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
                }
                else {
                    return { success: false, method: 'static_ip', detail: 'Could not find gateway, address list, or queue to disable' };
                }
            }
            else {
                return { success: false, method: 'none', detail: `Unknown type: ${connectionType}` };
            }
        }
        catch (error) {
            console.error('[Isolation] ❌ MikroTik execution error:', error.message || error);
            return { success: false, method: 'none', detail: `Error: ${error.message}` };
        }
    }
    /**
     * Isolir pelanggan (PPPoE atau Static IP)
     */
    static async isolateCustomer(isolationData) {
        var _a;
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Security Check: Verify unpaid invoices before restore
            if (isolationData.action === 'restore') {
                const [unpaidCheck] = await connection.query("SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status != 'paid'", [isolationData.customer_id]);
                const hasUnpaidInvoices = unpaidCheck.length > 0 && unpaidCheck[0].count > 0;
                if (hasUnpaidInvoices && isolationData.performed_by === 'system') {
                    // Block AI/System from auto-restoring if there are unpaid invoices
                    throw new Error('BLOCKED: Cannot auto-restore. Customer has unpaid invoices.');
                }
                else if (hasUnpaidInvoices && isolationData.performed_by !== 'system') {
                    // Allow Admin/Operator to manually restore but log a warning
                    console.warn(`[IsolationService] ⚠️ MANUAL OVERRIDE: Admin "${isolationData.performed_by}" is restoring customer ${isolationData.customer_id} with ${unpaidCheck[0].count} unpaid invoice(s). This bypasses the payment verification.`);
                    // Log this override action for audit trail
                    await connection.execute(`INSERT INTO customer_logs (customer_id, action, description, created_by, created_at) 
                         VALUES (?, 'manual_restore_override', ?, ?, NOW())`, [
                        isolationData.customer_id,
                        `Admin manually restored customer with ${unpaidCheck[0].count} unpaid invoice(s). Reason: ${isolationData.reason}`,
                        isolationData.performed_by
                    ]);
                }
            }
            const [customerResult] = await connection.execute(`SELECT c.*, s.package_name, s.price FROM customers c 
                 LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                 WHERE c.id = ?`, [isolationData.customer_id]);
            const customer = customerResult[0];
            if (!customer)
                throw new Error('Customer not found');
            const mikrotikResult = await this.executeMikrotikIsolation(customer, isolationData.action);
            // Log it
            let mikrotikUsername = '';
            if (customer.connection_type === 'pppoe') {
                mikrotikUsername = customer.pppoe_username || customer.customer_code || '';
            }
            else if (customer.connection_type === 'static_ip') {
                const [staticRows] = await connection.execute('SELECT ip_address FROM static_ip_clients WHERE customer_id = ? LIMIT 1', [customer.id]);
                mikrotikUsername = ((_a = staticRows[0]) === null || _a === void 0 ? void 0 : _a.ip_address) || '';
            }
            await connection.execute(`INSERT INTO isolation_logs (customer_id, action, reason, performed_by, mikrotik_username, mikrotik_response) 
                 VALUES (?, ?, ?, ?, ?, ?)`, [isolationData.customer_id, isolationData.action, isolationData.reason, isolationData.performed_by === 'system' ? 0 : (isolationData.performed_by || 0), mikrotikUsername, `[${mikrotikResult.method}] ${mikrotikResult.detail}`]);
            // Update status
            if (isolationData.action === 'isolate') {
                await connection.execute('UPDATE customers SET is_isolated = TRUE, isolated_at = NOW() WHERE id = ?', [customer.id]);
            }
            else {
                await connection.execute('UPDATE customers SET is_isolated = FALSE, isolated_at = NULL WHERE id = ?', [customer.id]);
            }
            await connection.commit();
            // Notification
            if (customer.phone) {
                try {
                    const notifyType = isolationData.action === 'isolate' ? 'service_blocked' : 'service_unblocked';
                    await UnifiedNotificationService_1.UnifiedNotificationService.queueNotification({
                        customer_id: customer.id,
                        notification_type: notifyType,
                        channels: ['whatsapp'],
                        variables: { customer_name: customer.name, reason: isolationData.reason, details: `Kode: ${customer.customer_code}` },
                        priority: isolationData.action === 'isolate' ? 'high' : 'normal'
                    });
                }
                catch (e) {
                    console.error('Notification failed', e);
                }
            }
            return mikrotikResult.success;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Placeholder methods for other functionalities
     * (Re-implemented minimally to keep file compiling)
     */
    static async sendIsolationWarnings(daysBefore = 3) {
        return { warned: 0, failed: 0 };
    }
    static async sendPreBlockWarnings() {
        return { warned: 0, failed: 0 };
    }
    static async sendIsolationH1Warnings() {
        return { warned: 0, failed: 0, skipped: '' };
    }
    static async autoIsolateOverdueCustomers() {
        console.log('[Automation] 🕒 Starting Auto-Isolation check...');
        const connection = await pool_1.databasePool.getConnection();
        let result = { isolated: 0, failed: 0 };
        try {
            // Find candidates: Active customers, Not isolated, With Overdue invoices
            // We verify 'overdue' status OR purely date based (grace period optional, but assuming strict for now)
            const [candidates] = await connection.query(`
                SELECT DISTINCT c.id, c.name, c.customer_code 
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE c.status = 'active'
                AND c.is_isolated = 0
                AND (i.status = 'overdue' OR (i.status != 'paid' AND i.due_date < NOW()))
            `);
            console.log(`[Automation] Found ${candidates.length} candidates for isolation`);
            for (const customer of candidates) {
                try {
                    console.log(`[Automation] Auto-isolating customer: ${customer.name}`);
                    await this.isolateCustomer({
                        customer_id: customer.id,
                        action: 'isolate',
                        reason: 'Otomatis: Tagihan jatuh tempo',
                        performed_by: 'system'
                    });
                    result.isolated++;
                }
                catch (err) {
                    console.error(`[Automation] Failed to isolate ${customer.name}:`, err);
                    result.failed++;
                }
            }
        }
        catch (e) {
            console.error('[Automation] Auto-isolation error:', e);
        }
        finally {
            connection.release();
        }
        return result;
    }
    static async autoIsolatePreviousMonthUnpaid() {
        // Re-use standard isolation logic
        return await this.autoIsolateOverdueCustomers();
    }
    static async autoRestorePaidCustomers() {
        console.log('[Automation] 🕒 Starting Auto-Restore check...');
        const connection = await pool_1.databasePool.getConnection();
        let result = { restored: 0, failed: 0 };
        try {
            // Find isolated customers
            const [isolated] = await connection.query(`SELECT id, name, customer_code FROM customers WHERE is_isolated = 1`);
            console.log(`[Automation] Found ${isolated.length} isolated customers to check for restoration`);
            for (const customer of isolated) {
                // Check if they still have unpaid bills
                const [unpaid] = await connection.query(`
                   SELECT COUNT(*) as count FROM invoices 
                   WHERE customer_id = ? AND status IN ('unpaid', 'overdue', 'partial')
                `, [customer.id]);
                if (unpaid[0].count === 0) {
                    // No unpaid bills, SAFE TO RESTORE
                    try {
                        console.log(`[Automation] Auto-restoring customer: ${customer.name}`);
                        await this.isolateCustomer({
                            customer_id: customer.id,
                            action: 'restore',
                            reason: 'Otomatis: Semua tagihan lunas',
                            performed_by: 'system'
                        });
                        result.restored++;
                    }
                    catch (err) {
                        console.error(`[Automation] Failed to restore ${customer.name}:`, err);
                        result.failed++;
                    }
                }
            }
        }
        catch (e) {
            console.error('[Automation] Auto-restore error:', e);
        }
        finally {
            connection.release();
        }
        return result;
    }
    static async getIsolationHistory(customerId, limit = 50) {
        const [result] = await pool_1.databasePool.query('SELECT * FROM isolation_logs ORDER BY created_at DESC LIMIT ?', [limit]);
        return result;
    }
    static async getIsolatedCustomers() {
        const [result] = await pool_1.databasePool.execute('SELECT * FROM customers WHERE is_isolated = TRUE');
        return result;
    }
    static async bulkIsolateByOdc(odcId, reason) {
        return { isolated: 0, failed: 0 };
    }
    static async manualIsolate(customerId, action, reason, performedBy) {
        return await this.isolateCustomer({ customer_id: customerId, action, reason, performed_by: performedBy });
    }
    static async autoDeleteBlockedCustomers() {
        return { deleted: 0, failed: 0 };
    }
    static async getStatistics() {
        return { total_isolated: 0, pppoe_isolated: 0, static_ip_isolated: 0, isolated_today: 0, restored_today: 0 };
    }
}
exports.IsolationService = IsolationService;
