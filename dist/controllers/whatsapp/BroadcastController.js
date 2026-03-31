"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastController = void 0;
const pool_1 = require("../../db/pool");
const UnifiedNotificationService_1 = require("../../services/notification/UnifiedNotificationService");
class BroadcastController {
    /**
     * Send mass message to all customers
     */
    static async sendBroadcast(req, res) {
        try {
            const { message, customerIds } = req.body;
            if (!message) {
                return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong' });
            }
            let customers = [];
            if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
                // Send to specific customers
                const [rows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE id IN (?) AND phone IS NOT NULL AND phone != ""', [customerIds]);
                customers = rows;
            }
            else {
                // Send to ALL customers
                const [rows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone IS NOT NULL AND phone != ""');
                customers = rows;
            }
            if (customers.length === 0) {
                return res.status(404).json({ success: false, error: 'Tidak ada pelanggan yang valid untuk dikirim pesan' });
            }
            console.log(`[Broadcast] 📢 Starting broadcast to ${customers.length} customers...`);
            let queuedCount = 0;
            for (const customer of customers) {
                // Personalize message
                const personalizedMessage = message.replace(/{customer_name}/g, customer.name || 'Pelanggan');
                // Queue notification
                await UnifiedNotificationService_1.UnifiedNotificationService.queueNotification({
                    customer_id: customer.id,
                    notification_type: 'broadcast',
                    variables: {
                        customer_name: customer.name || 'Pelanggan',
                        custom_message: personalizedMessage
                    },
                    priority: 'normal'
                });
                queuedCount++;
            }
            res.json({
                success: true,
                message: `${queuedCount} pesan telah dimasukkan ke dalam antrian.`,
                data: { count: queuedCount }
            });
        }
        catch (error) {
            console.error('Broadcast failed:', error);
            res.status(500).json({ success: false, error: error.message || 'Gagal mengirim broadcast' });
        }
    }
    /**
     * Get all customers for broadcast selection
     */
    static async getCustomers(req, res) {
        try {
            const [rows] = await pool_1.databasePool.query('SELECT id, name, customer_code, phone FROM customers WHERE phone IS NOT NULL AND phone != "" ORDER BY name ASC');
            res.json({ success: true, data: rows });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.BroadcastController = BroadcastController;
//# sourceMappingURL=BroadcastController.js.map