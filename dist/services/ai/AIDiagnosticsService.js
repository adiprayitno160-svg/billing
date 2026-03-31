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
exports.AIDiagnosticsService = void 0;
const pool_1 = require("../../db/pool");
const GenieacsService_1 = require("../genieacs/GenieacsService");
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
const ChatBotService_1 = require("./ChatBotService");
class AIDiagnosticsService {
    /**
     * Main entry point for AI Diagnostics
     */
    static async diagnoseAndFix(customerId, complaint) {
        try {
            console.log(`[AIDiagnostics] Diagnosing for customer ID: ${customerId}, Complaint: "${complaint}"`);
            // 1. Get Customer Data
            const [customerRows] = await pool_1.databasePool.query("SELECT * FROM customers WHERE id = ?", [customerId]);
            const customer = customerRows[0];
            if (!customer)
                throw new Error('Customer not found');
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
        }
        catch (error) {
            console.error('[AIDiagnostics] Error:', error);
            return {
                success: false,
                status: 'issue',
                details: `Error diagnostics: ${error.message}`,
                aiAdvice: 'Mohon maaf, sistem diagnosa sedang mengalami gangguan teknis. Mohon hubungi teknisi kami secara manual.'
            };
        }
    }
    static async getTechnicalData(customer) {
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
                const acs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
                let device = null;
                if (customer.device_id)
                    device = await acs.getDevice(customer.device_id);
                if (!device && customer.serial_number) {
                    const devs = await acs.getDevicesBySerial(customer.serial_number);
                    if (devs.length > 0)
                        device = devs[0];
                }
                if (device) {
                    const info = acs.extractDeviceInfo(device);
                    techData.isOnline = info.isOnline;
                    techData.rxPower = info.signal?.rxPower || '-';
                    techData.uptime = info.uptime || 0;
                }
            }
            catch (e) {
                console.warn('[AIDiagnostics] GenieACS check failed:', e);
            }
        }
        // B. Check MikroTik (Session Status)
        if (customer.connection_type === 'pppoe') {
            try {
                const mktConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
                if (mktConfig) {
                    const username = customer.pppoe_username || customer.customer_code;
                    const activeSessions = await MikroTikConnectionPool_1.mikrotikPool.execute(mktConfig, '/ppp/active/print', [
                        `?name=${username}`
                    ]);
                    techData.pppoeActive = Array.isArray(activeSessions) && activeSessions.length > 0;
                    techData.mikrotikStatus = techData.pppoeActive ? 'connected' : 'disconnected';
                }
            }
            catch (e) {
                console.warn('[AIDiagnostics] MikroTik check failed:', e);
            }
        }
        return techData;
    }
    static async performSelfHealing(customer, techData) {
        let description = '';
        // FIX 1: Reset PPPoE Active Session (Kick)
        if (customer.connection_type === 'pppoe') {
            try {
                const mktConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
                if (mktConfig) {
                    const username = customer.pppoe_username || customer.customer_code;
                    const activeSessions = await MikroTikConnectionPool_1.mikrotikPool.execute(mktConfig, '/ppp/active/print', [
                        `?name=${username}`
                    ]);
                    if (Array.isArray(activeSessions) && activeSessions.length > 0) {
                        for (const session of activeSessions) {
                            await MikroTikConnectionPool_1.mikrotikPool.execute(mktConfig, '/ppp/active/remove', [
                                `.id=${session['.id']}`
                            ]);
                        }
                        description += 'Mereset sesi koneksi (PPPoE Kick). ';
                    }
                }
            }
            catch (e) {
                console.warn('[AIDiagnostics] Self-healing kick failed:', e);
            }
        }
        // FIX 2: Simple ONT Refresh via GenieACS
        if (customer.device_id) {
            try {
                const acs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
                await acs.refreshDevice(customer.device_id);
                description += 'Menyegarkan status modem (ONT Refresh). ';
            }
            catch (e) { }
        }
        return { success: true, description: description || 'Pengecekan sistem selesai.' };
    }
    static async queueMonitoring(customerId, complaint) {
        try {
            // Check if already monitoring
            const [rows] = await pool_1.databasePool.query("SELECT id FROM auto_complaints WHERE customer_id = ? AND status = 'monitoring'", [customerId]);
            if (rows.length === 0) {
                // Insert new monitoring task (10 minutes from now)
                await pool_1.databasePool.query(`INSERT INTO auto_complaints (customer_id, complaint_text, status, created_at, escalate_at)
                     VALUES (?, ?, 'monitoring', NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE))`, [customerId, complaint]);
                console.log(`[AIDiagnostics] Queued monitoring for Customer ${customerId} (10 mins)`);
            }
        }
        catch (error) {
            console.error('[AIDiagnostics] Queue monitoring error:', error);
        }
    }
    static async generateAIAdvice(customer, techData, complaint, actionTaken) {
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
            return await ChatBotService_1.ChatBotService.ask(brief, { status: 'technical_diagnostic' });
        }
        catch (e) {
            return `Saya telah ${actionTaken}. Status internet Kakak saat ini ${techData.isOnline ? 'Aktif' : 'Mati'} dengan sinyal ${techData.rxPower} dBm. Mohon tunggu 1-2 menit. Sistem kami akan memantau koneksi Kakak selama 10 menit ke depan. Jika masih terkendala, Tiket bantuan akan dibuatkan otomatis.`;
        }
    }
    /**
     * Process escalations (Called by Scheduler)
     * Checks auto_complaints for expired timers
     */
    static async processEscalations() {
        try {
            const [complaints] = await pool_1.databasePool.query(`SELECT ac.*, c.name, c.address, c.customer_code 
                 FROM auto_complaints ac
                 JOIN customers c ON ac.customer_id = c.id
                 WHERE ac.status = 'monitoring' 
                   AND ac.escalate_at <= NOW()`);
            if (complaints.length === 0)
                return;
            console.log(`[AIDiagnostics] Processing ${complaints.length} overdue complaints...`);
            const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
            for (const complaint of complaints) {
                // Create Ticket
                const ticketNumber = `AUTO-${Math.floor(1000 + Math.random() * 9000)}`;
                // Insert Job with 'verifying' status (Operator needs to approve)
                const [res] = await pool_1.databasePool.query(`INSERT INTO technician_jobs 
                     (ticket_number, title, description, priority, status, customer_id, address, reported_by, job_type_id, total_fee, created_at)
                     VALUES (?, ?, ?, 'high', 'verifying', ?, ?, 'system_auto', 1, 0, NOW())`, [
                    ticketNumber,
                    `[AUTO] Keluhan: ${complaint.name}`,
                    `Keluhan Otomatis (Gagal Reset 10 Menit).\nMasalah: ${complaint.complaint_text}\nPelanggan: ${complaint.name}\nKode: ${complaint.customer_code}`,
                    complaint.customer_id,
                    complaint.address
                ]);
                const jobId = res.insertId;
                // Update Complaint Status
                await pool_1.databasePool.query("UPDATE auto_complaints SET status = 'escalated', ticket_id = ? WHERE id = ?", [jobId, complaint.id]);
                // Notify ADMIN (Operator) only
                const msg = `⚠️ *BUTUH VERIFIKASI (AUTO-COMPLAINT)*\n\n` +
                    `Pelanggan: *${complaint.name}*\n` +
                    `Masalah: ${complaint.complaint_text}\n` +
                    `Status: Reset Gagal setelah 10 menit.\n` +
                    `Tiket: *${ticketNumber}* created (Pending Verification).\n\n` +
                    `Mohon cek dashboard & Approve jika valid.`;
                // Send to Admin Numbers
                // DISABLED: Monitoring notifications disabled per user request
                // await UnifiedNotificationService.broadcastToAdmins(msg);
            }
        }
        catch (error) {
            console.error('[AIDiagnostics] Error processing escalations:', error);
        }
    }
}
exports.AIDiagnosticsService = AIDiagnosticsService;
//# sourceMappingURL=AIDiagnosticsService.js.map