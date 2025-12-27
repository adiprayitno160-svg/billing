"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const AddressListService_1 = __importDefault(require("./AddressListService"));
const MikrotikService_1 = require("../mikrotik/MikrotikService");
const MikrotikAddressListService_1 = __importDefault(require("../mikrotik/MikrotikAddressListService"));
const PrepaidQueueService_1 = require("./PrepaidQueueService");
/**
 * Service untuk aktivasi dan deaktivasi paket prepaid
 * Handle full workflow dari purchase sampai aktif di MikroTik
 */
class PrepaidActivationService {
    /**
     * Activate prepaid package for customer
     */
    async activatePackage(data) {
        const connection = await pool_1.default.getConnection();
        try {
            await connection.beginTransaction();
            // 1. Get package details
            const [packageRows] = await connection.query(`SELECT pp.*, sp.* 
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`, [data.package_id]);
            if (packageRows.length === 0) {
                throw new Error('Package not found');
            }
            const packageData = packageRows[0];
            // 2. Get customer details
            const [customerRows] = await connection.query('SELECT * FROM customers WHERE id = ?', [data.customer_id]);
            if (customerRows.length === 0) {
                throw new Error('Customer not found');
            }
            const customer = customerRows[0];
            // 3. Check for existing active subscription
            const [existingSubs] = await connection.query(`SELECT * FROM prepaid_package_subscriptions 
         WHERE customer_id = ? AND status = 'active' AND expiry_date > NOW()`, [data.customer_id]);
            if (existingSubs.length > 0) {
                // Expire existing subscription
                await connection.query(`UPDATE prepaid_package_subscriptions 
           SET status = 'cancelled', updated_at = NOW() 
           WHERE id = ?`, [existingSubs[0].id]);
            }
            // 4. Calculate activation and expiry dates
            const activationDate = new Date();
            const expiryDate = new Date();
            // Add duration based on package type or duration_days
            if (packageData.package_type === 'daily' && packageData.duration_hours) {
                expiryDate.setDate(expiryDate.getDate() + (packageData.duration_hours / 24));
            }
            else if (packageData.package_type === 'weekly') {
                expiryDate.setDate(expiryDate.getDate() + 7);
            }
            else if (packageData.package_type === 'monthly') {
                expiryDate.setDate(expiryDate.getDate() + 30);
            }
            else if (packageData.duration_days) {
                // Use duration_days from package
                expiryDate.setDate(expiryDate.getDate() + packageData.duration_days);
            }
            else {
                // Default 30 days
                expiryDate.setDate(expiryDate.getDate() + 30);
            }
            // 5. Determine actual speed to use (custom or from package)
            const actualDownloadMbps = data.custom_download_mbps || packageData.download_mbps;
            const actualUploadMbps = data.custom_upload_mbps || packageData.upload_mbps;
            // 5. Create subscription record
            const [subscriptionResult] = await connection.query(`INSERT INTO prepaid_package_subscriptions 
         (customer_id, package_id, activation_date, expiry_date, status, auto_renew, purchase_price, invoice_id, pppoe_username, custom_download_mbps, custom_upload_mbps)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`, [
                data.customer_id,
                data.package_id,
                activationDate,
                expiryDate,
                data.auto_renew || 0,
                data.purchase_price,
                data.invoice_id || null,
                customer.pppoe_username,
                data.custom_download_mbps || null,
                data.custom_upload_mbps || null
            ]);
            const subscriptionId = subscriptionResult.insertId;
            // 6. Update customer status
            await connection.query(`UPDATE customers 
         SET status = 'active', is_isolated = 0, billing_mode = 'prepaid'
         WHERE id = ?`, [data.customer_id]);
            // 7. Log speed change
            if (packageData.speed_profile_id) {
                await connection.query(`INSERT INTO customer_speed_history 
           (customer_id, subscription_id, new_speed_profile_id, new_speed_mbps, change_reason)
           VALUES (?, ?, ?, ?, 'purchase')`, [
                    data.customer_id,
                    subscriptionId,
                    packageData.speed_profile_id,
                    `${packageData.download_mbps}/${packageData.upload_mbps} Mbps`
                ]);
            }
            await connection.commit();
            // 8. Activate in MikroTik (after commit)
            try {
                // Pass custom speed to activation
                const activationPackageData = {
                    ...packageData,
                    download_mbps: actualDownloadMbps,
                    upload_mbps: actualUploadMbps
                };
                await this.activateInMikrotik(data.customer_id, activationPackageData);
            }
            catch (error) {
                console.error('MikroTik activation failed:', error);
                // Don't rollback, just log error
            }
            // 9. Remove from portal-redirect list
            try {
                await AddressListService_1.default.removeFromPortalRedirect(data.customer_id);
            }
            catch (error) {
                console.error('Failed to remove from portal-redirect:', error);
            }
            // 10. Send activation notification
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../../services/notification/UnifiedNotificationService')));
                await UnifiedNotificationService.notifyPackageActivated(subscriptionId);
                // Schedule expiry notifications
                await UnifiedNotificationService.schedulePackageExpiryNotifications(subscriptionId);
            }
            catch (notifError) {
                console.error('Error sending activation notification:', notifError);
                // Don't fail activation if notification fails
            }
            return {
                success: true,
                subscription_id: subscriptionId,
                message: `Package activated successfully until ${expiryDate.toLocaleDateString()}`
            };
        }
        catch (error) {
            await connection.rollback();
            console.error('Activation error:', error);
            return {
                success: false,
                message: 'Failed to activate package',
                error: error.message
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Activate customer in MikroTik
     */
    async activateInMikrotik(customerId, packageData) {
        // Get customer details
        const [customerRows] = await pool_1.default.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (customerRows.length === 0 || !customerRows[0]) {
            throw new Error('Customer not found');
        }
        const customer = customerRows[0];
        // Get IP address from static_ip_clients if static IP customer
        let customerIP = null;
        if (customer.connection_type === 'static_ip' || customer.connection_type === 'static') {
            const [ipRows] = await pool_1.default.query(`SELECT ip_address FROM static_ip_clients WHERE customer_id = ? AND status = 'active' LIMIT 1`, [customerId]);
            if (ipRows.length > 0 && ipRows[0]?.ip_address) {
                customerIP = ipRows[0].ip_address;
            }
        }
        // Add IP to customer object for later use
        customer.ip_address = customerIP;
        // Get Mikrotik settings
        const [mikrotikSettings] = await pool_1.default.query('SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
        if (mikrotikSettings.length === 0 || !mikrotikSettings[0]) {
            console.warn('⚠️ No active Mikrotik settings found');
            return;
        }
        const settings = mikrotikSettings[0];
        const mikrotikService = new MikrotikService_1.MikrotikService({
            host: settings.host,
            username: settings.username,
            password: settings.password,
            port: settings.port || 8728
        });
        const addressListService = new MikrotikAddressListService_1.default({
            host: settings.host,
            username: settings.username,
            password: settings.password,
            port: settings.port || 8728
        });
        try {
            // ===== PPPOE: Change profile and disconnect =====
            if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
                const profileName = packageData.mikrotik_profile_name ||
                    `prepaid-${packageData.download_mbps}mbps`;
                console.log(`🔄 Activating PPPoE: ${customer.pppoe_username} → ${profileName}`);
                // Update PPPoE profile
                const updateSuccess = await mikrotikService.updatePPPoEUserByUsername(customer.pppoe_username, {
                    profile: profileName,
                    comment: `Prepaid Active - Package: ${packageData.name}`,
                    disabled: false
                });
                if (updateSuccess) {
                    // Disconnect to force reconnect with new profile
                    await mikrotikService.disconnectPPPoEUser(customer.pppoe_username);
                    console.log(`✅ PPPoE user ${customer.pppoe_username} activated with profile ${profileName}`);
                }
                else {
                    console.error(`❌ Failed to activate PPPoE user ${customer.pppoe_username}`);
                }
            }
            // ===== STATIC IP: Create/update Queue Tree =====
            else if ((customer.connection_type === 'static' || customer.connection_type === 'static_ip') && customer.ip_address) {
                console.log(`🔄 Activating Static IP: ${customer.ip_address}`);
                // Initialize queue service
                const queueService = new PrepaidQueueService_1.PrepaidQueueService({
                    host: settings.host,
                    username: settings.username,
                    password: settings.password,
                    port: settings.port || 8728
                });
                // Check if mangle rules exist (should exist from postpaid setup)
                const hasMangle = await queueService.checkMangleRules(customer.ip_address);
                if (!hasMangle) {
                    console.warn(`⚠️ Warning: Mangle rules not found for ${customer.ip_address}. Queue may not work properly.`);
                }
                // Create or update queue tree
                await queueService.createOrUpdateQueue({
                    customerId: customer.id,
                    customerName: customer.name,
                    ipAddress: customer.ip_address,
                    parentDownloadQueue: packageData.parent_download_queue || 'DOWNLOAD ALL',
                    parentUploadQueue: packageData.parent_upload_queue || 'UPLOAD ALL',
                    downloadSpeedMbps: packageData.download_mbps,
                    uploadSpeedMbps: packageData.upload_mbps
                });
                // Remove from prepaid-no-package
                try {
                    await addressListService.removeFromAddressList('prepaid-no-package', customer.ip_address);
                }
                catch (removeError) {
                    console.warn(`⚠️ Failed to remove from prepaid-no-package (non-critical):`, removeError);
                }
                // Add to prepaid-active
                try {
                    const addSuccess = await addressListService.addToAddressList('prepaid-active', customer.ip_address, `Prepaid Active - ${customer.name} - Package: ${packageData.name}`);
                    if (addSuccess) {
                        console.log(`✅ Static IP ${customer.ip_address} activated with queue tree`);
                    }
                }
                catch (addError) {
                    const errorMsg = addError?.userFriendlyMessage || addError?.message || 'Unknown error';
                    console.error(`❌ Failed to activate Static IP ${customer.ip_address}: ${errorMsg}`);
                    throw addError; // Re-throw so outer catch can handle it
                }
            }
            // Update sync status
            await pool_1.default.query(`UPDATE prepaid_package_subscriptions 
         SET mikrotik_synced = 1 
         WHERE customer_id = ? AND status = 'active'`, [customerId]);
        }
        catch (error) {
            console.error('MikroTik activation error:', error);
            throw error;
        }
    }
    /**
     * Deactivate/suspend customer package
     */
    async deactivatePackage(subscriptionId, reason = 'Expired') {
        const connection = await pool_1.default.getConnection();
        try {
            await connection.beginTransaction();
            // 1. Get subscription details
            const [subsRows] = await connection.query(`SELECT pps.*, c.pppoe_username, c.connection_type, c.name 
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         WHERE pps.id = ?`, [subscriptionId]);
            if (subsRows.length === 0 || !subsRows[0]) {
                throw new Error('Subscription not found');
            }
            const subscription = subsRows[0];
            // Get IP address from static_ip_clients if static IP customer
            let customerIP = null;
            if (subscription.connection_type === 'static_ip' || subscription.connection_type === 'static') {
                const [ipRows] = await connection.query(`SELECT ip_address FROM static_ip_clients WHERE customer_id = ? AND status = 'active' LIMIT 1`, [subscription.customer_id]);
                if (ipRows.length > 0 && ipRows[0]?.ip_address) {
                    customerIP = ipRows[0].ip_address;
                }
            }
            // Add IP to subscription object for later use
            subscription.ip_address = customerIP;
            // 2. Update subscription status
            await connection.query(`UPDATE prepaid_package_subscriptions 
         SET status = 'expired', updated_at = NOW() 
         WHERE id = ?`, [subscriptionId]);
            // 3. Update customer status
            await connection.query(`UPDATE customers 
         SET status = 'suspended', is_isolated = 1 
         WHERE id = ?`, [subscription.customer_id]);
            await connection.commit();
            // 4. Revert MikroTik configuration
            try {
                // Get Mikrotik settings
                const [mikrotikSettings] = await pool_1.default.query('SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1');
                if (mikrotikSettings.length > 0 && mikrotikSettings[0]) {
                    const settings = mikrotikSettings[0];
                    const mikrotikService = new MikrotikService_1.MikrotikService({
                        host: settings.host,
                        username: settings.username,
                        password: settings.password,
                        port: settings.port || 8728
                    });
                    const addressListService = new MikrotikAddressListService_1.default({
                        host: settings.host,
                        username: settings.username,
                        password: settings.password,
                        port: settings.port || 8728
                    });
                    // ===== PPPOE: Revert to prepaid-no-package profile =====
                    if (subscription.connection_type === 'pppoe' && subscription.pppoe_username) {
                        console.log(`🔄 Deactivating PPPoE: ${subscription.pppoe_username}`);
                        const updateSuccess = await mikrotikService.updatePPPoEUserByUsername(subscription.pppoe_username, {
                            profile: 'prepaid-no-package',
                            comment: `Prepaid ${reason} - Need to purchase package`,
                            disabled: false
                        });
                        if (updateSuccess) {
                            // Disconnect to force reconnect
                            await mikrotikService.disconnectPPPoEUser(subscription.pppoe_username);
                            console.log(`✅ PPPoE user ${subscription.pppoe_username} reverted to no-package profile`);
                        }
                    }
                    // ===== STATIC IP: Remove queue tree & move to no-package list =====
                    else if ((subscription.connection_type === 'static' || subscription.connection_type === 'static_ip') && subscription.ip_address) {
                        console.log(`🔄 Deactivating Static IP: ${subscription.ip_address}`);
                        // Initialize queue service
                        const queueService = new PrepaidQueueService_1.PrepaidQueueService({
                            host: settings.host,
                            username: settings.username,
                            password: settings.password,
                            port: settings.port || 8728
                        });
                        // Remove queue tree
                        try {
                            await queueService.removeQueue(subscription.name);
                            console.log(`✅ Queue tree removed for ${subscription.name}`);
                        }
                        catch (error) {
                            console.error(`⚠️ Failed to remove queue tree:`, error);
                        }
                        // Remove from prepaid-active
                        await addressListService.removeFromAddressList('prepaid-active', subscription.ip_address);
                        // Add to prepaid-no-package
                        await addressListService.addToAddressList('prepaid-no-package', subscription.ip_address, `Prepaid ${reason} - ${subscription.name} - Need to purchase`);
                        console.log(`✅ Static IP ${subscription.ip_address} deactivated and moved to no-package list`);
                    }
                }
            }
            catch (error) {
                console.error('MikroTik deactivation failed:', error);
            }
            return true;
        }
        catch (error) {
            await connection.rollback();
            console.error('Deactivation error:', error);
            return false;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get active subscription for customer
     */
    async getActiveSubscription(customerId) {
        const [rows] = await pool_1.default.query(`SELECT 
        pps.*,
        pp.name as package_name,
        pp.package_type,
        pp.price,
        sp.download_mbps,
        sp.upload_mbps,
        DATEDIFF(pps.expiry_date, NOW()) as days_remaining
       FROM prepaid_package_subscriptions pps
       INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
       LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
       WHERE pps.customer_id = ? AND pps.status = 'active' AND pps.expiry_date > NOW()
       ORDER BY pps.created_at DESC
       LIMIT 1`, [customerId]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Get subscription history for customer
     */
    async getSubscriptionHistory(customerId, limit = 10) {
        const [rows] = await pool_1.default.query(`SELECT 
        pps.*,
        pp.name as package_name,
        pp.price,
        sp.download_mbps,
        sp.upload_mbps
       FROM prepaid_package_subscriptions pps
       INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
       LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
       WHERE pps.customer_id = ?
       ORDER BY pps.created_at DESC
       LIMIT ?`, [customerId, limit]);
        return rows;
    }
    /**
     * Check if customer needs redirect to portal
     */
    async needsPortalRedirect(customerId) {
        const subscription = await this.getActiveSubscription(customerId);
        return !subscription; // No active subscription = needs redirect
    }
    /**
     * Extend subscription (add more days)
     */
    async extendSubscription(subscriptionId, additionalDays) {
        try {
            await pool_1.default.query(`UPDATE prepaid_package_subscriptions 
         SET expiry_date = DATE_ADD(expiry_date, INTERVAL ? DAY),
             updated_at = NOW()
         WHERE id = ?`, [additionalDays, subscriptionId]);
            return true;
        }
        catch (error) {
            console.error('Failed to extend subscription:', error);
            return false;
        }
    }
    /**
     * Activate package after payment verified
     * Called after manual transfer verification or payment gateway callback
     */
    async activateFromTransaction(transactionId) {
        try {
            // Get transaction details
            const [transactionRows] = await pool_1.default.query(`SELECT 
          t.customer_id,
          t.package_id,
          t.amount,
          t.id as invoice_id,
          t.payment_notes,
          p.duration_days
        FROM prepaid_transactions t
        INNER JOIN prepaid_packages p ON t.package_id = p.id
        WHERE t.id = ? AND t.payment_status IN ('verified', 'paid')`, [transactionId]);
            if (transactionRows.length === 0 || !transactionRows[0]) {
                throw new Error('Transaction not found or not verified');
            }
            const transaction = transactionRows[0];
            // Parse custom speed from payment_notes if exists
            let customDownloadMbps;
            let customUploadMbps;
            if (transaction.payment_notes) {
                const speedMatch = transaction.payment_notes.match(/Custom Speed:\s*(\d+(?:\.\d+)?)Mbps\/(\d+(?:\.\d+)?)Mbps/);
                if (speedMatch) {
                    customDownloadMbps = parseFloat(speedMatch[1]);
                    customUploadMbps = parseFloat(speedMatch[2]);
                }
            }
            // Activate the package
            return await this.activatePackage({
                customer_id: transaction.customer_id,
                package_id: transaction.package_id,
                invoice_id: transaction.invoice_id,
                purchase_price: transaction.amount,
                auto_renew: false,
                custom_download_mbps: customDownloadMbps,
                custom_upload_mbps: customUploadMbps
            });
        }
        catch (error) {
            console.error('[PrepaidActivationService] Error activating from transaction:', error);
            return {
                success: false,
                message: 'Failed to activate package after payment',
                error: error.message
            };
        }
    }
}
exports.default = new PrepaidActivationService();
//# sourceMappingURL=PrepaidActivationService.js.map