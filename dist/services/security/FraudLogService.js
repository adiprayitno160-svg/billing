"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudLogService = void 0;
const pool_1 = require("../../db/pool");
class FraudLogService {
    static async logAttempt(phone, invoiceId, fraudScore, confidence) {
        try {
            await pool_1.databasePool.query(`INSERT INTO fraud_logs (phone, invoice_id, fraud_score, confidence) VALUES (?, ?, ?, ?)`, [phone, invoiceId, fraudScore, confidence]);
            console.log(`[FraudLog] Logged potential fraud for ${phone}, score: ${fraudScore}`);
        }
        catch (error) {
            console.error('[FraudLog] Error logging fraud:', error);
        }
    }
}
exports.FraudLogService = FraudLogService;
//# sourceMappingURL=FraudLogService.js.map