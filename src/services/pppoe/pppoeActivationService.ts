import { databasePool } from '../../db/pool';
import { MikrotikService } from '../mikrotik/MikrotikService';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';

export class PPPoEActivationService {
    private mikrotikService: MikrotikService;
    private notificationService: UnifiedNotificationService;

    constructor() {
        // Note: We'll initialize mikrotikService when needed since it requires async initialization
        this.notificationService = new UnifiedNotificationService();
    }

    private async getMikrotikService(): Promise<MikrotikService> {
        if (!this.mikrotikService) {
            this.mikrotikService = await MikrotikService.getInstance();
        }
        return this.mikrotikService;
    }

    /**
     * Send reminders for upcoming PPPoE blocks (Point 3)
     */
    async sendReminders(): Promise<void> {
        const connection = await databasePool.getConnection();
        try {
            // Get subscriptions that will be blocked in 3 days
            const [subscriptions] = await connection.execute(
                `SELECT s.*, c.name as customer_name, c.phone, c.customer_code, c.pppoe_username
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.status = 'active' 
                 AND s.is_activated = TRUE
                 AND s.next_block_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
            );

            console.log(`[PPPoEActivationService] Sending reminders for ${(subscriptions as any[]).length} subscriptions`);

            for (const sub of subscriptions as any[]) {
                try {
                    await UnifiedNotificationService.queueNotification({
                        customer_id: sub.customer_id,
                        notification_type: 'payment_reminder',
                        variables: {
                            customer_name: sub.customer_name,
                            service_type: 'PPPoE',
                            block_date: new Date(sub.next_block_date).toLocaleDateString('id-ID'),
                            amount: sub.price.toLocaleString('id-ID'),
                            customer_code: sub.customer_code
                        },
                        channels: ['whatsapp']
                    });
                } catch (err) {
                    console.error(`[PPPoEActivationService] Error sending reminder for sub ${sub.id}:`, err);
                }
            }
        } finally {
            connection.release();
        }
    }

    /**
     * Activate PPPoE subscription manually
     * @param subscriptionId 
     * @param userId 
     * @returns 
     */
    async activateSubscription(subscriptionId: number, userId: number): Promise<{ success: boolean; message: string }> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // Get subscription details
            const [subscriptionRows] = await connection.execute(
                `SELECT s.*, c.name as customer_name, c.phone, c.customer_code, 
                        c.pppoe_username, c.pppoe_password, c.connection_type,
                        pp.name as package_name, pp.max_limit_upload, pp.max_limit_download
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 JOIN pppoe_packages pp ON s.package_id = pp.id
                 WHERE s.id = ? AND s.status = 'inactive'`,
                [subscriptionId]
            );

            const subscription = (subscriptionRows as any[])[0];
            if (!subscription) {
                throw new Error('Subscription tidak ditemukan atau sudah aktif');
            }

            if (subscription.connection_type !== 'pppoe') {
                throw new Error('Hanya paket PPPoE yang bisa diaktifkan');
            }

            // Generate PPPoE credentials if not exists
            let pppoeUsername = subscription.pppoe_username;
            let pppoePassword = subscription.pppoe_password;

            if (!pppoeUsername || !pppoePassword) {
                pppoeUsername = `${subscription.customer_code}_${Date.now().toString().slice(-4)}`;
                pppoePassword = Math.random().toString(36).slice(-8);
            }

            // Set activation date and next block date
            const activationDate = new Date();
            const nextBlockDate = new Date(activationDate);
            nextBlockDate.setMonth(nextBlockDate.getMonth() + 1);

            // Handle end-of-month dates
            if (activationDate.getDate() > 28) {
                const lastDay = new Date(nextBlockDate.getFullYear(), nextBlockDate.getMonth() + 1, 0).getDate();
                nextBlockDate.setDate(Math.min(activationDate.getDate(), lastDay));
            } else {
                nextBlockDate.setDate(activationDate.getDate());
            }

            // Update subscription
            await connection.execute(
                `UPDATE subscriptions 
                 SET activation_date = ?, is_activated = TRUE, next_block_date = ?, status = 'active',
                     updated_at = NOW()
                 WHERE id = ?`,
                [activationDate.toISOString().split('T')[0], nextBlockDate.toISOString().split('T')[0], subscriptionId]
            );

            // Update customer PPPoE credentials
            await connection.execute(
                `UPDATE customers 
                 SET pppoe_username = ?, pppoe_password = ?, status = 'active', updated_at = NOW()
                 WHERE id = ?`,
                [pppoeUsername, pppoePassword, subscription.customer_id]
            );

            // Create PPPoE account in MikroTik
            const mikrotikResult = await this.createPPPoEAccountInMikrotik(
                subscription.customer_id,
                pppoeUsername,
                pppoePassword,
                subscription.max_limit_upload,
                subscription.max_limit_download,
                subscription.package_name
            );

            // Log activation
            await connection.execute(
                `INSERT INTO activation_logs (customer_id, subscription_id, action, reason, performed_by, mikrotik_response, created_at)
                 VALUES (?, ?, 'activate', 'Manual activation by admin', ?, ?, NOW())`,
                [subscription.customer_id, subscriptionId, userId, JSON.stringify(mikrotikResult)]
            );

            await connection.commit();

            // Send notification to customer
            await UnifiedNotificationService.queueNotification({
                customer_id: subscription.customer_id,
                notification_type: 'service_unblocked',
                variables: {
                    customer_name: subscription.customer_name,
                    service_type: 'PPPoE',
                    package_name: subscription.package_name,
                    activation_date: activationDate.toLocaleDateString('id-ID'),
                    next_payment_date: nextBlockDate.toLocaleDateString('id-ID'),
                    pppoe_username: pppoeUsername,
                    pppoe_password: pppoePassword
                },
                channels: ['whatsapp']
            });

            return {
                success: true,
                message: `Subscription ${subscriptionId} berhasil diaktifkan. Akun PPPoE: ${pppoeUsername}`
            };

        } catch (error) {
            await connection.rollback();
            console.error('Error activating subscription:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Gagal mengaktifkan subscription'
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Deactivate PPPoE subscription
     * @param subscriptionId 
     * @param userId 
     * @param reason 
     * @returns 
     */
    async deactivateSubscription(subscriptionId: number, userId: number, reason: string): Promise<{ success: boolean; message: string }> {
        const connection = await databasePool.getConnection();
        try {
            await connection.beginTransaction();

            // Get subscription details
            const [subscriptionRows] = await connection.execute(
                `SELECT s.*, c.name as customer_name, c.phone, c.customer_code, c.pppoe_username
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.id = ? AND s.status = 'active'`,
                [subscriptionId]
            );

            const subscription = (subscriptionRows as any[])[0];
            if (!subscription) {
                throw new Error('Subscription tidak ditemukan atau tidak aktif');
            }

            // Remove PPPoE account from MikroTik
            const mikrotikResult = await this.removePPPoEAccountFromMikrotik(subscription.pppoe_username);

            // Update subscription
            await connection.execute(
                `UPDATE subscriptions 
                 SET status = 'inactive', is_activated = FALSE, activation_date = NULL, next_block_date = NULL,
                     updated_at = NOW()
                 WHERE id = ?`,
                [subscriptionId]
            );

            // Update customer
            await connection.execute(
                `UPDATE customers 
                 SET pppoe_username = NULL, pppoe_password = NULL, status = 'inactive', updated_at = NOW()
                 WHERE id = ?`,
                [subscription.customer_id]
            );

            // Log deactivation
            await connection.execute(
                `INSERT INTO activation_logs (customer_id, subscription_id, action, reason, performed_by, mikrotik_response, created_at)
                 VALUES (?, ?, 'deactivate', ?, ?, ?, NOW())`,
                [subscription.customer_id, subscriptionId, reason, userId, JSON.stringify(mikrotikResult)]
            );

            await connection.commit();

            // Send notification to customer
            await UnifiedNotificationService.queueNotification({
                customer_id: subscription.customer_id,
                notification_type: 'service_blocked',
                variables: {
                    customer_name: subscription.customer_name,
                    service_type: 'PPPoE',
                    reason: reason,
                    customer_code: subscription.customer_code,
                    pppoe_username: subscription.pppoe_username
                },
                channels: ['whatsapp']
            });

            return {
                success: true,
                message: `Subscription ${subscriptionId} berhasil dinonaktifkan`
            };

        } catch (error) {
            await connection.rollback();
            console.error('Error deactivating subscription:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Gagal menonaktifkan subscription'
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Check and process automatic blocking based on activation date
     */
    async processAutoBlocking(): Promise<void> {
        const connection = await databasePool.getConnection();
        try {
            // Get subscriptions that need to be blocked
            const [subscriptions] = await connection.execute(
                `SELECT s.*, c.name as customer_name, c.phone, c.customer_code, c.pppoe_username
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.status = 'active' 
                 AND s.is_activated = TRUE
                 AND s.next_block_date <= CURDATE()
                 -- Skip if already paid for current month
                 AND s.customer_id NOT IN (
                     SELECT DISTINCT customer_id 
                     FROM invoices 
                     WHERE status = 'paid' 
                     AND (period = DATE_FORMAT(CURDATE(), '%Y-%m') OR period = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m'))
                 )
                 -- Skip if there is a pending manual verification ("Kesepakatan Final" Point 2)
                 AND s.customer_id NOT IN (
                     SELECT DISTINCT customer_id FROM manual_payment_verifications WHERE status = 'pending'
                 )`
            );

            console.log(`[PPPoEActivationService] Found ${(subscriptions as any[]).length} subscriptions to block`);

            for (const sub of subscriptions as any[]) {
                try {
                    console.log(`[PPPoEActivationService] Blocking subscription ${sub.id} for customer ${sub.customer_name}`);

                    // Block the customer by disabling PPPoE user
                    const mikrotikService = await this.getMikrotikService();
                    if (sub.pppoe_username) {
                        await mikrotikService.updatePPPoEUserByUsername(sub.pppoe_username, { disabled: true });
                    }

                    // Update next block date
                    const nextBlockDate = new Date(sub.next_block_date);
                    nextBlockDate.setMonth(nextBlockDate.getMonth() + 1);

                    // Handle end-of-month dates
                    if (new Date(sub.activation_date).getDate() > 28) {
                        const lastDay = new Date(nextBlockDate.getFullYear(), nextBlockDate.getMonth() + 1, 0).getDate();
                        nextBlockDate.setDate(Math.min(new Date(sub.activation_date).getDate(), lastDay));
                    } else {
                        nextBlockDate.setDate(new Date(sub.activation_date).getDate());
                    }

                    await connection.execute(
                        `UPDATE subscriptions 
                         SET next_block_date = ?
                         WHERE id = ?`,
                        [nextBlockDate.toISOString().split('T')[0], sub.id]
                    );

                    // Log the auto-blocking action
                    await connection.execute(
                        `INSERT INTO activation_logs (subscription_id, customer_id, action, reason)
                         VALUES (?, ?, 'auto_block', ?)`,
                        [sub.id, sub.customer_id, 'Automatic block due to late payment']
                    );

                    // Send notification
                    await UnifiedNotificationService.queueNotification({
                        customer_id: sub.customer_id,
                        notification_type: 'service_blocked',
                        variables: {
                            customer_name: sub.customer_name,
                            service_type: 'PPPoE',
                            reason: 'Pembayaran belum diterima',
                            customer_code: sub.customer_code,
                            pppoe_username: sub.pppoe_username
                        },
                        channels: ['whatsapp']
                    });

                } catch (error) {
                    console.error(`[PPPoEActivationService] Error blocking subscription ${sub.id}:`, error);
                }
            }

        } finally {
            connection.release();
        }
    }

    /**
     * Reset next block date when customer pays
     * @param customerId 
     */
    async resetNextBlockDate(customerId: number): Promise<void> {
        const connection = await databasePool.getConnection();
        try {
            // Get active subscription
            const [subscriptionRows] = await connection.execute(
                `SELECT id, activation_date, c.pppoe_username 
                 FROM subscriptions s
                 JOIN customers c ON s.customer_id = c.id
                 WHERE s.customer_id = ? AND s.status = 'active' AND s.is_activated = TRUE`,
                [customerId]
            );

            const subscription = (subscriptionRows as any[])[0];
            if (!subscription) return;

            // Calculate new next block date
            const activationDate = new Date(subscription.activation_date);
            const nextBlockDate = new Date();
            nextBlockDate.setMonth(nextBlockDate.getMonth() + 1);

            // Set to same day as activation date
            if (activationDate.getDate() > 28) {
                const lastDay = new Date(nextBlockDate.getFullYear(), nextBlockDate.getMonth() + 1, 0).getDate();
                nextBlockDate.setDate(Math.min(activationDate.getDate(), lastDay));
            } else {
                nextBlockDate.setDate(activationDate.getDate());
            }

            await connection.execute(
                `UPDATE subscriptions 
                 SET next_block_date = ?
                 WHERE id = ?`,
                [nextBlockDate.toISOString().split('T')[0], subscription.id]
            );

            // Log the date reset action
            await connection.execute(
                `INSERT INTO activation_logs (subscription_id, customer_id, action, reason)
                 VALUES (?, ?, 'reset_date', ?)`,
                [subscription.id, customerId, `Date reset to ${nextBlockDate.toISOString().split('T')[0]} after payment`]
            );

            // Re-enable the PPPoE user if it was disabled
            if (subscription.pppoe_username) {
                const mikrotikService = await this.getMikrotikService();
                await mikrotikService.updatePPPoEUserByUsername(subscription.pppoe_username, { disabled: false });

                // Also force disconnect to apply changes immediately
                try {
                    await mikrotikService.disconnectPPPoEUser(subscription.pppoe_username);
                } catch (e) {
                    // Ignore if fail to disconnect, user will connect eventually
                }
            }

            console.log(`[PPPoEActivationService] Reset next block date for customer ${customerId} to ${nextBlockDate.toISOString().split('T')[0]}`);

        } finally {
            connection.release();
        }
    }

    // --- Private Methods ---

    private async createPPPoEAccountInMikrotik(
        customerId: number,
        username: string,
        password: string,
        maxLimitUpload: string,
        maxLimitDownload: string,
        packageName: string
    ): Promise<any> {
        try {
            const mikrotikService = await this.getMikrotikService();
            const result = await mikrotikService.createPPPoEUser({
                name: username,
                password: password,
                profile: maxLimitUpload + '/' + maxLimitDownload, // Combine upload/download as profile
                comment: `Customer: ${packageName} (ID: ${customerId})`
            });

            return { success: result, message: result ? 'PPPoE account created successfully' : 'Failed to create PPPoE account' };
        } catch (error) {
            console.error('Error creating PPPoE account in MikroTik:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async removePPPoEAccountFromMikrotik(username: string): Promise<any> {
        try {
            const mikrotikService = await this.getMikrotikService();
            const result = await mikrotikService.updatePPPoEUserByUsername(username, { disabled: true });

            return { success: result, message: result ? 'PPPoE account disabled successfully' : 'Failed to disable PPPoE account' };
        } catch (error) {
            console.error('Error disabling PPPoE account in MikroTik:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

// Export singleton instance
export const pppoeActivationService = new PPPoEActivationService();