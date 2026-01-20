
import { databasePool } from '../../db/pool';
import { GenieacsService } from '../genieacs/GenieacsService';
import { mikrotikPool } from '../MikroTikConnectionPool';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';
import { ChatBotService } from './ChatBotService';
import { RowDataPacket } from 'mysql2';

export interface DiagnosticResult {
    success: boolean;
    status: 'online' | 'offline' | 'issue' | 'isolated';
    details: string;
    actionTaken?: string;
    aiAdvice?: string;
}

export class AIDiagnosticsService {
    /**
     * Main entry point for AI Diagnostics
     */
    static async diagnoseAndFix(customerId: number, complaint: string): Promise<DiagnosticResult> {
        try {
            console.log(`[AIDiagnostics] Diagnosing for customer ID: ${customerId}, Complaint: "${complaint}"`);

            // 1. Get Customer Data
            const [customerRows] = await databasePool.query<RowDataPacket[]>(
                "SELECT * FROM customers WHERE id = ?", [customerId]
            );
            const customer = customerRows[0];
            if (!customer) throw new Error('Customer not found');

            // 2. Check Isolation Status
            if (customer.is_isolated) {
                return {
                    success: true,
                    status: 'isolated',
                    details: 'Layanan terisolasi (diblokir) karena tunggakan pembayaran.',
                    aiAdvice: 'Mohon maaf Kak, internet Kakak terblokir otomatis karena ada tagihan yang belum lunas. Silakan lakukan pembayaran agar internet aktif kembali secara otomatis.'
                };
            }

            // 3. Gather Technical Data
            const techData = await this.getTechnicalData(customer);

            // 4. Perform Basic "Self-Healing" if complaint is "lemot" or "mati"
            let actionTaken = '';
            if (complaint.toLowerCase().includes('lemot') || complaint.toLowerCase().includes('mati') || complaint.toLowerCase().includes('reset')) {
                const fixResult = await this.performSelfHealing(customer, techData);
                actionTaken = fixResult.description;

                // Start Monitoring
                await this.queueMonitoring(customer.id, complaint);

                // Refresh technical data after fix
                const newData = await this.getTechnicalData(customer);
                Object.assign(techData, newData);
            }

            // 5. Let AI analyze and provide advice
            const aiAdvice = await this.generateAIAdvice(customer, techData, complaint, actionTaken);

            return {
                success: true,
                status: techData.isOnline ? 'online' : 'offline',
                details: `Status: ${techData.isOnline ? 'Online' : 'Offline'}. Signal: ${techData.rxPower} dBm. Uptime: ${techData.uptime}s.`,
                actionTaken,
                aiAdvice
            };

        } catch (error: any) {
            console.error('[AIDiagnostics] Error:', error);
            return {
                success: false,
                status: 'issue',
                details: `Error diagnostics: ${error.message}`,
                aiAdvice: 'Mohon maaf, sistem diagnosa sedang mengalami gangguan teknis. Mohon hubungi teknisi kami secara manual.'
            };
        }
    }

    private static async getTechnicalData(customer: any) {
        let techData = {
            isOnline: false,
            rxPower: '-',
            uptime: 0,
            pppoeActive: false,
            mikrotikStatus: 'unknown'
        };

        // A. Check GenieACS (ONT Status)
        if (customer.device_id || customer.serial_number) {
            try {
                const acs = await GenieacsService.getInstanceFromDb();
                let device = null;
                if (customer.device_id) device = await acs.getDevice(customer.device_id);
                if (!device && customer.serial_number) {
                    const devs = await acs.getDevicesBySerial(customer.serial_number);
                    if (devs.length > 0) device = devs[0];
                }

                if (device) {
                    const info = acs.extractDeviceInfo(device);
                    techData.isOnline = info.isOnline;
                    techData.rxPower = info.signal?.rxPower || '-';
                    techData.uptime = info.uptime || 0;
                }
            } catch (e) {
                console.warn('[AIDiagnostics] GenieACS check failed:', e);
            }
        }

        // B. Check MikroTik (Session Status)
        if (customer.connection_type === 'pppoe') {
            try {
                const mktConfig = await getMikrotikConfig();
                if (mktConfig) {
                    const username = customer.pppoe_username || customer.customer_code;
                    const activeSessions = await mikrotikPool.execute(mktConfig, '/ppp/active/print', [
                        `?name=${username}`
                    ]);
                    techData.pppoeActive = Array.isArray(activeSessions) && activeSessions.length > 0;
                    techData.mikrotikStatus = techData.pppoeActive ? 'connected' : 'disconnected';
                }
            } catch (e) {
                console.warn('[AIDiagnostics] MikroTik check failed:', e);
            }
        }

        return techData;
    }

    private static async performSelfHealing(customer: any, techData: any) {
        let description = '';

        // FIX 1: Reset PPPoE Active Session (Kick)
        if (customer.connection_type === 'pppoe') {
            try {
                const mktConfig = await getMikrotikConfig();
                if (mktConfig) {
                    const username = customer.pppoe_username || customer.customer_code;
                    const activeSessions = await mikrotikPool.execute(mktConfig, '/ppp/active/print', [
                        `?name=${username}`
                    ]);

                    if (Array.isArray(activeSessions) && activeSessions.length > 0) {
                        for (const session of activeSessions) {
                            await mikrotikPool.execute(mktConfig, '/ppp/active/remove', [
                                `.id=${session['.id']}`
                            ]);
                        }
                        description += 'Mereset sesi koneksi (PPPoE Kick). ';
                    }
                }
            } catch (e) {
                console.warn('[AIDiagnostics] Self-healing kick failed:', e);
            }
        }

        // FIX 2: Simple ONT Refresh via GenieACS
        if (customer.device_id) {
            try {
                const acs = await GenieacsService.getInstanceFromDb();
                await acs.refreshDevice(customer.device_id);
                description += 'Menyegarkan status modem (ONT Refresh). ';
            } catch (e) { }
        }

        return { success: true, description: description || 'Pengecekan sistem selesai.' };
    }

    private static async queueMonitoring(customerId: number, complaint: string): Promise<void> {
        try {
            // Check if already monitoring
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id FROM auto_complaints WHERE customer_id = ? AND status = 'monitoring'",
                [customerId]
            );

            if (rows.length === 0) {
                // Insert new monitoring task (10 minutes from now)
                await databasePool.query(
                    `INSERT INTO auto_complaints (customer_id, complaint_text, status, created_at, escalate_at)
                     VALUES (?, ?, 'monitoring', NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
                    [customerId, complaint]
                );
                console.log(`[AIDiagnostics] Queued monitoring for Customer ${customerId} (10 mins)`);
            }
        } catch (error) {
            console.error('[AIDiagnostics] Queue monitoring error:', error);
        }
    }

    private static async generateAIAdvice(customer: any, techData: any, complaint: string, actionTaken: string): Promise<string> {
        // Construct technical brief for AI
        const brief = `
Customer: ${customer.name}
Complaint: ${complaint}
Status ONT: ${techData.isOnline ? 'Online' : 'Offline'}
Rx Power: ${techData.rxPower} dBm
Uptime ONT: ${techData.uptime} detik
PPPoE Status di MikroTik: ${techData.pppoeActive ? 'Aktif' : 'Mati'}
Action Taken: ${actionTaken}

Jika Rx Power < -27, beritahu bahwa sinyal lemah (kemungkinan kabel tekuk).
Jika ONT Offline, suruh cek adaptor/listrik.
Jika Baru saja di-reset (Action Taken ada), suruh tunggu 1 menit. beritahu bahwa sistem akan memantau dalam 10 menit, jika masih gagal akan dibuatkan tiket teknisi otomatis.
Balas dengan bahasa yang membantu dan ramah ala Customer Service ISP.
`.trim();

        try {
            return await ChatBotService.ask(brief, { status: 'technical_diagnostic' });
        } catch (e) {
            return `Saya telah ${actionTaken}. Status internet Kakak saat ini ${techData.isOnline ? 'Aktif' : 'Mati'} dengan sinyal ${techData.rxPower} dBm. Mohon tunggu 1-2 menit. Sistem kami akan memantau koneksi Kakak selama 10 menit ke depan. Jika masih terkendala, Tiket bantuan akan dibuatkan otomatis.`;
        }
    }

    /**
     * Process escalations (Called by Scheduler)
     * Checks auto_complaints for expired timers
     */
    static async processEscalations(): Promise<void> {
        try {
            const [complaints] = await databasePool.query<RowDataPacket[]>(
                `SELECT ac.*, c.name, c.address, c.customer_code 
                 FROM auto_complaints ac
                 JOIN customers c ON ac.customer_id = c.id
                 WHERE ac.status = 'monitoring' 
                   AND ac.escalate_at <= NOW()`
            );

            if (complaints.length === 0) return;

            console.log(`[AIDiagnostics] Processing ${complaints.length} overdue complaints...`);
            const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');

            for (const complaint of complaints) {
                // Create Ticket
                const ticketNumber = `AUTO-${Math.floor(1000 + Math.random() * 9000)}`;

                // Insert Job with 'verifying' status (Operator needs to approve)
                const [res]: any = await databasePool.query(
                    `INSERT INTO technician_jobs 
                     (ticket_number, title, description, priority, status, customer_id, address, reported_by, job_type_id, total_fee, created_at)
                     VALUES (?, ?, ?, 'high', 'verifying', ?, ?, 'system_auto', 1, 0, NOW())`,
                    [
                        ticketNumber,
                        `[AUTO] Keluhan: ${complaint.name}`,
                        `Keluhan Otomatis (Gagal Reset 10 Menit).\nMasalah: ${complaint.complaint_text}\nPelanggan: ${complaint.name}\nKode: ${complaint.customer_code}`,
                        complaint.customer_id,
                        complaint.address
                    ]
                );

                const jobId = res.insertId;

                // Update Complaint Status
                await databasePool.query(
                    "UPDATE auto_complaints SET status = 'escalated', ticket_id = ? WHERE id = ?",
                    [jobId, complaint.id]
                );

                // Notify ADMIN (Operator) only
                const msg = `⚠️ *BUTUH VERIFIKASI (AUTO-COMPLAINT)*\n\n` +
                    `Pelanggan: *${complaint.name}*\n` +
                    `Masalah: ${complaint.complaint_text}\n` +
                    `Status: Reset Gagal setelah 10 menit.\n` +
                    `Tiket: *${ticketNumber}* created (Pending Verification).\n\n` +
                    `Mohon cek dashboard & Approve jika valid.`;

                // Send to Admin Numbers
                await UnifiedNotificationService.broadcastToAdmins(msg);
            }

        } catch (error) {
            console.error('[AIDiagnostics] Error processing escalations:', error);
        }
    }
}
