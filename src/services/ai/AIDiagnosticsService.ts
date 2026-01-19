
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
Jika Baru saja di-reset (Action Taken ada), suruh tunggu 1 menit.
Balas dengan bahasa yang membantu dan ramah ala Customer Service ISP.
`.trim();

        try {
            return await ChatBotService.ask(brief, { status: 'technical_diagnostic' });
        } catch (e) {
            return `Saya telah ${actionTaken}. Status internet Kakak saat ini ${techData.isOnline ? 'Aktif' : 'Mati'} dengan sinyal ${techData.rxPower} dBm. Jika masih lemot, mohon coba matikan lalu nyalakan kembali modemnya selama 30 detik ya Kak.`;
        }
    }
}
