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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefermentService = void 0;
const pool_1 = require("../../db/pool");
const UnifiedNotificationService_1 = require("../notification/UnifiedNotificationService");
class DefermentService {
    /**
     * Check how many deferments a customer had this year
     */
    static async getDefermentCountThisYear(customerId) {
        const currentYear = new Date().getFullYear();
        const [rows] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM payment_deferments 
             WHERE customer_id = ? AND YEAR(created_at) = ? AND status != 'rejected'`, [customerId, currentYear]);
        return rows[0]?.count || 0;
    }
    /**
     * Request a payment deferment
     */
    static async requestDeferment(data) {
        const count = await this.getDefermentCountThisYear(data.customer_id);
        if (count >= 4) {
            // Send failure notification
            await this.sendDefermentLimitReachedNotification(data.customer_id);
            return { success: false, message: 'Limit penundaan (4x setahun) sudah tercapai.' };
        }
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Insert deferment record
            await connection.query(`INSERT INTO payment_deferments (customer_id, invoice_id, requested_date, deferred_until_date, reason, status, count_in_year)
                 VALUES (?, ?, CURDATE(), ?, ?, 'approved', ?)`, [data.customer_id, data.invoice_id || null, data.deferred_until_date, data.reason, count + 1]);
            // Update customer status
            await connection.query('UPDATE customers SET is_deferred = TRUE WHERE id = ?', [data.customer_id]);
            await connection.commit();
            // Send success notification
            await this.sendDefermentapprovedNotification(data.customer_id, data.deferred_until_date);
            return { success: true, message: 'Penundaan pembayaran berhasil disetujui.' };
        }
        catch (error) {
            await connection.rollback();
            console.error('Deferment request error:', error);
            return { success: false, message: 'Gagal memproses penundaan.' };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Check and process expired deferments
     * Should be called periodically (CRON)
     * Rule: If deferred until date is passed, block on the night of (deferred + 1)
     * e.g. Deferred until 6th, if no payment, block on 7th night.
     */
    static async processExpiredDeferments() {
        // Find deferments where deferred_until_date < CURDATE() and status is approved
        // In this case, if today is 7th and deferred was 6th.
        const [rows] = await pool_1.databasePool.query(`SELECT d.*, c.name, c.phone 
             FROM payment_deferments d
             JOIN customers c ON d.customer_id = c.id
             WHERE d.status = 'approved' AND d.deferred_until_date < CURDATE()`);
        let processed = 0;
        for (const row of rows) {
            const connection = await pool_1.databasePool.getConnection();
            try {
                await connection.beginTransaction();
                // Update deferment status to completed (meaning the time is up)
                await connection.query('UPDATE payment_deferments SET status = "completed" WHERE id = ?', [row.id]);
                // Reset customer deferred status
                await connection.query('UPDATE customers SET is_deferred = FALSE WHERE id = ?', [row.customer_id]);
                await connection.commit();
                // Actually isolate the customer now
                const { IsolationService } = await Promise.resolve().then(() => __importStar(require('./isolationService')));
                await IsolationService.isolateCustomer({
                    customer_id: row.customer_id,
                    action: 'isolate',
                    reason: `Penundaan pembayaran berakhir (sampai tanggal ${new Date(row.deferred_until_date).toLocaleDateString('id-ID')}) dan belum ada pelunasan.`
                });
                processed++;
            }
            catch (error) {
                await connection.rollback();
                console.error(`Failed to process expired deferment for customer ${row.customer_id}:`, error);
            }
            finally {
                connection.release();
            }
        }
        return { processed };
    }
    static async sendDefermentapprovedNotification(customerId, untilDate) {
        // Fetch customer details
        const [rows] = await pool_1.databasePool.query('SELECT name, customer_code FROM customers WHERE id = ?', [customerId]);
        const customer = rows[0];
        if (customer) {
            await UnifiedNotificationService_1.UnifiedNotificationService.queueNotification({
                customer_id: customerId,
                notification_type: 'payment_deferment',
                channels: ['whatsapp'],
                variables: {
                    details: `Batas waktu penundaan: ${new Date(untilDate).toLocaleDateString('id-ID')}.`
                },
                priority: 'normal'
            });
        }
    }
    static async sendDefermentLimitReachedNotification(customerId) {
        const [rows] = await pool_1.databasePool.query('SELECT name FROM customers WHERE id = ?', [customerId]);
        const customer = rows[0];
        if (customer) {
            await UnifiedNotificationService_1.UnifiedNotificationService.queueNotification({
                customer_id: customerId,
                notification_type: 'payment_deferment',
                channels: ['whatsapp'],
                variables: {
                    details: `Limit penundaan (4x dalam 1 tahun) sudah tercapai.`
                },
                priority: 'high'
            });
        }
    }
}
exports.DefermentService = DefermentService;
//# sourceMappingURL=DefermentService.js.map