import { databasePool } from '../../db/pool';

export class FraudLogService {
    static async logAttempt(phone: string, invoiceId: number, fraudScore: number, confidence: number) {
        try {
            await databasePool.query(
                `INSERT INTO fraud_logs (phone, invoice_id, fraud_score, confidence) VALUES (?, ?, ?, ?)`,
                [phone, invoiceId, fraudScore, confidence]
            );
            console.log(`[FraudLog] Logged potential fraud for ${phone}, score: ${fraudScore}`);
        } catch (error) {
            console.error('[FraudLog] Error logging fraud:', error);
        }
    }
}
