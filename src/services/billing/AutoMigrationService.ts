import { databasePool } from '../../db/pool';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AISettingsService } from '../payment/AISettingsService';
import { WhatsAppServiceBaileys } from '../whatsapp/WhatsAppServiceBaileys';
import { ArrearsAnalysisPrompts } from '../ai/ArrearsAnalysisPrompts';

export class AutoMigrationService {

    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    private static async initializeAI() {
        if (this.model) return;
        const apiKey = await AISettingsService.getAPIKey();
        if (!apiKey) throw new Error("AI API Key not configured");

        const settings = await AISettingsService.getSettings();
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Menggunakan model yang di-set di setting, atau default ke flash untuk kecepatan
        this.model = this.genAI.getGenerativeModel({ model: settings?.model || 'gemini-1.5-flash' });
    }

    /**
     * Menjalankan pengecekan harian untuk pelanggan Postpaid.
     * Logika: 
     * 1. Cek User Postpaid.
     * 2. Hitung Invoice Unpaid 1 Tahun Terakhir.
     * 3. Jika >= 3 -> Analisa AI -> Migrasi ke Prepaid.
     * 4. Jika 1-2 -> Analisa AI -> Kirim Peringatan.
     */
    static async runDailyArrearsCheck() {
        console.log('[AutoMigration] Starting daily check...');

        const connection = await databasePool.getConnection();
        try {
            await this.initializeAI();

            // 1. Ambil pelanggan Postpaid yang punya tunggakan dalam 1 tahun terakhir
            const sql = `
                SELECT 
                    c.id, c.name, c.phone, c.customer_code,
                    COUNT(i.id) as unpaid_count,
                    SUM(i.total_amount - i.amount_paid) as total_debt,
                    MIN(i.created_at) as oldest_unpaid
                FROM customers c
                JOIN invoices i ON c.id = i.customer_id
                WHERE 
                    c.billing_mode = 'postpaid' 
                    AND c.status = 'active'
                    AND i.status IN ('unpaid', 'overdue')
                    AND i.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR) -- Hanya 1 tahun terakhir
                GROUP BY c.id
                HAVING unpaid_count > 0
            `;

            const [rows] = await connection.query(sql);
            const customers = rows as any[];

            console.log(`[AutoMigration] Found ${customers.length} customers with arrears.`);

            for (const customer of customers) {
                try {
                    await this.processCustomer(customer, connection);
                } catch (err) {
                    console.error(`[AutoMigration] Error processing customer ${customer.name}:`, err);
                }
            }

        } catch (error) {
            console.error('[AutoMigration] General Error:', error);
        } finally {
            connection.release();
        }
    }

    private static async processCustomer(customer: any, connection: any) {
        const count = customer.unpaid_count;
        const arreasStats = {
            count: count,
            totalAmount: Number(customer.total_debt),
            oldestUnpaidDate: new Date(customer.oldest_unpaid).toISOString().split('T')[0],
            unpaidInvoicesList: [] // Bisa di-expand jika AI butuh detail per invoice
        };

        // --- SKENARIO 1: MIGRASI (>= 2x) ---
        if (count >= 2) {
            // Cek apakah sudah pernah diproses/dimigrasi hari ini agar tidak double hit
            // (Assumsi: jika sudah prepaid, query utama di atas sudah filter 'postpaid', jadi aman)

            console.log(`[AutoMigration] Analyzing migration for ${customer.name} (${count}x arrears)`);

            // 1. Generate Analisa AI
            const prompt = ArrearsAnalysisPrompts.getMigrationActionPrompt(customer, arreasStats as any);
            const result = await this.generateAIResponse(prompt);

            if (result && result.shouldMigrate) {
                // 2. Eksekusi Migrasi DB
                await this.executeMigration(connection, customer, result);
            }
        }

        // --- SKENARIO 2: PERINGATAN (1x) ---
        else if (count >= 1) {
            // Cek log notifikasi agar tidak spamming setiap hari
            // Kita cek apakah sudah ada warning dalam 7 hari terakhir
            const [logs] = await connection.query(`
                SELECT id FROM customer_notifications_log 
                WHERE customer_id = ? 
                AND notification_type = 'arrears_warning' 
                AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                LIMIT 1
            `, [customer.id]);

            if ((logs as any[]).length === 0) {
                console.log(`[AutoMigration] Sending warning to ${customer.name} (${count}x arrears)`);

                // 1. Generate Pesan Warning AI
                // Kita ambil summary history dummy/simple
                const prompt = ArrearsAnalysisPrompts.getEarlyWarningPrompt(customer, arreasStats, []);
                const result = await this.generateAIResponse(prompt);

                if (result && result.whatsappMessage) {
                    // 2. Kirim WA
                    if (customer.phone) {
                        await WhatsAppServiceBaileys.sendMessage(customer.phone, result.whatsappMessage);

                        // 3. Log Notifikasi
                        await connection.query(`
                            INSERT INTO customer_notifications_log 
                            (customer_id, channel, notification_type, message, status, recipient)
                            VALUES (?, 'whatsapp', 'arrears_warning', ?, 'sent', ?)
                        `, [customer.id, result.whatsappMessage, customer.phone]);
                    }
                }
            }
        }
    }

    private static async executeMigration(connection: any, customer: any, aiResult: any) {
        await connection.beginTransaction();
        try {
            // 1. Update Customer ke Prepaid & LOCK INTERNET (is_isolated=1)
            // Set expiry_date ke kemarin (agar otomatis perlu beli paket)
            await connection.query(`
                UPDATE customers 
                SET 
                    billing_mode = 'prepaid',
                    is_isolated = 1,
                    expiry_date = DATE_SUB(NOW(), INTERVAL 1 DAY), 
                    updated_at = NOW()
                WHERE id = ?
            `, [customer.id]);

            // 2. Catat Log Migrasi
            const logData = {
                reason: `AI Auto-Migration: ${aiResult.reasoning || '3x consecutive arrears'}`,
                stats: {
                    unpaid_count: customer.unpaid_count,
                    total_debt: customer.total_debt
                }
            };

            await connection.query(`
                INSERT INTO customer_migration_logs
                (customer_id, from_billing_mode, to_billing_mode, migration_reason, old_customer_data, migration_option, migration_status)
                VALUES (?, 'postpaid', 'prepaid', ?, ?, 'convert_debt', 'completed')
            `, [
                customer.id,
                'Arrears >= 2x (Strict Policy)',
                JSON.stringify(logData)
            ]);

            // 3. Kirim Notifikasi WA (dari hasil AI)
            if (customer.phone && aiResult.whatsappMessage) {
                await WhatsAppServiceBaileys.sendMessage(customer.phone, aiResult.whatsappMessage);

                // Log Notifikasi
                await connection.query(`
                    INSERT INTO customer_notifications_log 
                    (customer_id, channel, notification_type, message, status, recipient)
                    VALUES (?, 'whatsapp', 'migration_notice', ?, 'sent', ?)
                `, [customer.id, aiResult.whatsappMessage, customer.phone]);
            }

            await connection.commit();
            console.log(`[AutoMigration] SUCCESS migrated customer ${customer.name}`);

        } catch (error) {
            await connection.rollback();
            console.error(`[AutoMigration] FAILED to migrate customer ${customer.name}`, error);
            throw error;
        }
    }

    private static async generateAIResponse(promptText: string): Promise<any> {
        try {
            const result = await this.model.generateContent(promptText);
            const responseTxt = result.response.text();

            // Bersihkan markdown json ```json ... ```
            const cleaned = responseTxt.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("[AutoMigration] AI Generation Error:", error);
            return null;
        }
    }
}
