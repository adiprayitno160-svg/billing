"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartStaticIPMonitoringService = void 0;
const pool_1 = require("../../db/pool");
const WhatsAppService_1 = require("../whatsapp/WhatsAppService");
const child_process_1 = require("child_process");
const util_1 = require("util");
const MikrotikService_1 = require("../mikrotik/MikrotikService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SmartStaticIPMonitoringService {
    constructor() {
        this.whatsappService = WhatsAppService_1.whatsappService;
    }
    /**
     * Dapatkan semua pelanggan IP static yang aktif
     */
    async getActiveStaticIPCustomers() {
        const query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        COALESCE(c.static_ip, sic.ip_address, c.ip_address) as static_ip,
        c.area,
        c.odc_location as location,
        c.last_ping_check,
        c.static_ip_monitoring_state as monitoring_state,
        c.ping_timeout_started_at,
        c.awaiting_customer_response,
        c.customer_response_received
      FROM customers c
      LEFT JOIN static_ip_clients sic ON sic.customer_id = c.id
      WHERE c.billing_mode = 'prepaid' 
        AND c.connection_type = 'static_ip'
        AND c.status = 'active'
        AND (c.static_ip IS NOT NULL AND c.static_ip != '' 
             OR sic.ip_address IS NOT NULL
             OR c.ip_address IS NOT NULL)
    `;
        try {
            const [results] = await pool_1.databasePool.query(query);
            return results;
        }
        catch (error) {
            console.error('Error getting active static IP customers:', error);
            return [];
        }
    }
    /**
     * Ping IP address dan cek apakah merespon
     */
    async pingIPAddress(ip) {
        try {
            // 1. Cobalah ping LANGSUNG dari server (lebih cepat jika bisa)
            const isWindows = process.platform === 'win32';
            const pingCommand = isWindows
                ? `ping -n 1 -w 2000 ${ip}` // 2s timeout
                : `ping -c 1 -W 2 ${ip}`; // 2s timeout
            try {
                const { stdout } = await execAsync(pingCommand);
                const output = stdout.toLowerCase();
                const hasReply = output.includes('reply from') ||
                    output.includes('bytes=') ||
                    output.includes('ttl=') ||
                    (!output.includes('100% packet loss') &&
                        !output.includes('timed out') &&
                        !output.includes('host unreachable'));
                if (hasReply) {
                    console.log(`✅ Direct Ping SUCCESS for ${ip}`);
                    return true;
                }
            }
            catch (e) {
                // Direct ping failed, fall through to Mikrotik
            }
            // 2. Jika ping langsung gagal, ping via MIKROTIK
            try {
                const mkService = await MikrotikService_1.MikrotikService.getInstance();
                const mkPingSuccess = await mkService.ping(ip);
                if (mkPingSuccess) {
                    console.log(`✅ Microtik Ping SUCCESS for ${ip}`);
                    return true;
                }
            }
            catch (mkError) {
                // Ignore Mikrotik errors
            }
            console.log(`❌ All Ping methods FAILED for ${ip}`);
            return false;
        }
        catch (error) {
            console.log(`❌ Ping ERROR for ${ip}:`, error.message);
            return false;
        }
    }
    /**
     * Buat tiket otomatis untuk teknisi
     */
    async createAutomaticTicket(customer, issueDescription) {
        const ticketNumber = `TKT-ST-${Date.now()}`;
        const query = `
      INSERT INTO technician_jobs (
        ticket_number,
        customer_id,
        title,
        description,
        priority,
        status,
        reported_by,
        address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
        try {
            const [result] = await pool_1.databasePool.query(query, [
                ticketNumber,
                customer.id,
                `GANGGUAN IP STATIC: ${customer.name}`,
                issueDescription,
                'high',
                'pending',
                'automatic_static_ip_monitoring',
                customer.location // location in StaticIPCustomer interface is aliased from odc_location
            ]);
            const ticketId = result.insertId;
            console.log(`🎫 Automatic ticket created #${ticketId} for ${customer.name} (${customer.static_ip})`);
            // Kirim notifikasi ke pelanggan
            if (customer.phone) {
                await this.whatsappService.sendMessage(customer.phone, `🎫 Halo ${customer.name}, kami telah membuat tiket gangguan otomatis (#${ticketId}) untuk masalah koneksi IP static Anda (${customer.static_ip}). Tim teknisi kami akan segera menindaklanjuti.`);
            }
            return ticketId;
        }
        catch (error) {
            console.error('Error creating automatic ticket:', error);
            return null;
        }
    }
    /**
     * Update monitoring state pelanggan
     */
    async updateCustomerMonitoringState(customerId, state, timeoutStartedAt = null, awaitingResponse = false, responseReceived = false) {
        const query = `
      UPDATE customers 
      SET static_ip_monitoring_state = ?, 
          ping_timeout_started_at = ?,
          awaiting_customer_response = ?,
          customer_response_received = ?
      WHERE id = ?
    `;
        try {
            await pool_1.databasePool.query(query, [state, timeoutStartedAt, awaitingResponse, responseReceived, customerId]);
        }
        catch (error) {
            console.error(`Error updating monitoring state for customer ${customerId}:`, error);
        }
    }
    /**
     * Kirim konfirmasi ke pelanggan di menit 12
     */
    async sendCustomerConfirmationRequest(customer) {
        if (customer.phone) {
            const message = `❓ Halo ${customer.name}, kami mendeteksi IP static Anda (${customer.static_ip}) tidak merespon sejak ${Math.floor((new Date().getTime() - customer.ping_timeout_started_at.getTime()) / (1000 * 60))} menit yang lalu.

Apakah ada gangguan di lokasi Anda seperti pemadaman listrik?
Balas:
- YA (jika ada gangguan)
- TIDAK (jika tidak ada gangguan)`;
            await this.whatsappService.sendMessage(customer.phone, message);
            console.log(`📧 Confirmation request sent to ${customer.name} (${customer.static_ip})`);
        }
    }
    /**
     * Proses monitoring cerdas untuk semua pelanggan IP static
     * Logika: Ping normal 15min → Timeout 5min → Timeout 10min → Konfirmasi 12min → Tiket 15min
     */
    async runSmartMonitoring() {
        console.log('🚀 Starting Smart Static IP Monitoring for Prepaid Customers...');
        const customers = await this.getActiveStaticIPCustomers();
        console.log(`📊 Found ${customers.length} active prepaid Static IP customers`);
        for (const customer of customers) {
            try {
                await this.processCustomerMonitoring(customer);
            }
            catch (error) {
                console.error(`Error processing customer ${customer.name}:`, error);
            }
        }
        console.log('✅ Smart Static IP Monitoring cycle completed');
    }
    /**
     * Proses monitoring untuk satu pelanggan IP static
     */
    async processCustomerMonitoring(customer) {
        const now = new Date();
        // Mode normal: Ping setiap 15 menit jika tidak ada timeout
        if (customer.monitoring_state === 'normal' || !customer.ping_timeout_started_at) {
            const isReachable = await this.pingIPAddress(customer.static_ip);
            if (!isReachable) {
                // Ping timeout pertama terdeteksi
                console.log(`🔴 Ping TIMEOUT detected for ${customer.name} (${customer.static_ip})`);
                await this.updateCustomerMonitoringState(customer.id, 'timeout_5min', now, false, false);
                // Kirim notifikasi awal ke pelanggan
                if (customer.phone) {
                    await this.whatsappService.sendMessage(customer.phone, `⚠️ Halo ${customer.name}, kami mendeteksi IP static Anda (${customer.static_ip}) tidak merespon ping. Sistem akan melakukan pengecekan ulang dalam 5 menit.`);
                }
            }
            else {
                // Ping berhasil - update last check time
                await pool_1.databasePool.query('UPDATE customers SET last_ping_check = NOW() WHERE id = ?', [customer.id]);
            }
            return;
        }
        // Hitung selisih waktu sejak timeout pertama
        const timeDiffMs = now.getTime() - customer.ping_timeout_started_at.getTime();
        const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
        console.log(`⏱️ Monitoring ${customer.name} (${customer.static_ip}): ${timeDiffMinutes} minutes in timeout state (${customer.monitoring_state})`);
        // Timeout 5 menit: Ping ulang pertama
        if (customer.monitoring_state === 'timeout_5min' && timeDiffMinutes >= 5) {
            const isReachable = await this.pingIPAddress(customer.static_ip);
            if (isReachable) {
                // IP pulih - reset ke normal
                console.log(`✅ IP ${customer.static_ip} RESTORED at 5-minute check for ${customer.name}`);
                await this.updateCustomerMonitoringState(customer.id, 'normal', null, false, false);
                if (customer.phone) {
                    await this.whatsappService.sendMessage(customer.phone, `✅ Halo ${customer.name}, IP static Anda (${customer.static_ip}) telah pulih. Terima kasih atas kesabarannya.`);
                }
            }
            else {
                // Masih timeout - lanjut ke timeout 10 menit
                console.log(`⏳ IP ${customer.static_ip} still TIMEOUT at 5-minute check for ${customer.name}, moving to 10-minute check`);
                await this.updateCustomerMonitoringState(customer.id, 'timeout_10min', customer.ping_timeout_started_at, false, false);
                if (customer.phone) {
                    await this.whatsappService.sendMessage(customer.phone, `⚠️ Halo ${customer.name}, IP static Anda (${customer.static_ip}) masih tidak merespon. Sistem akan melakukan pengecekan lagi dalam 5 menit.`);
                }
            }
            return;
        }
        // Timeout 10 menit: Ping ulang kedua
        if (customer.monitoring_state === 'timeout_10min' && timeDiffMinutes >= 10) {
            const isReachable = await this.pingIPAddress(customer.static_ip);
            if (isReachable) {
                // IP pulih - reset ke normal
                console.log(`✅ IP ${customer.static_ip} RESTORED at 10-minute check for ${customer.name}`);
                await this.updateCustomerMonitoringState(customer.id, 'normal', null, false, false);
                if (customer.phone) {
                    await this.whatsappService.sendMessage(customer.phone, `✅ Halo ${customer.name}, IP static Anda (${customer.static_ip}) telah pulih. Terima kasih atas kesabarannya.`);
                }
            }
            else {
                // Masih timeout - lanjut ke konfirmasi 12 menit
                console.log(`⏳ IP ${customer.static_ip} still TIMEOUT at 10-minute check for ${customer.name}, moving to confirmation at 12 minutes`);
                await this.updateCustomerMonitoringState(customer.id, 'awaiting_confirmation_12min', customer.ping_timeout_started_at, true, false);
                // Kirim konfirmasi ke pelanggan
                await this.sendCustomerConfirmationRequest(customer);
            }
            return;
        }
        // Menunggu konfirmasi pelanggan di menit 12
        if (customer.monitoring_state === 'awaiting_confirmation_12min' && timeDiffMinutes >= 12) {
            // Cek apakah sudah ada respons dari pelanggan
            if (customer.customer_response_received) {
                // Jika pelanggan mengkonfirmasi ada gangguan, reset monitoring
                console.log(`✅ Customer confirmed issue for ${customer.name} (${customer.static_ip}), resetting monitoring`);
                await this.updateCustomerMonitoringState(customer.id, 'normal', null, false, false);
                return;
            }
            // Jika belum ada respons, lanjut ke pembuatan tiket di menit 15
            if (timeDiffMinutes >= 15) {
                console.log(`🎫 Creating AUTOMATIC TICKET for ${customer.name} - no customer response after 15 minutes`);
                const ticketId = await this.createAutomaticTicket(customer, `IP static prepaid pelanggan tidak merespon ping selama 15 menit dan tidak ada konfirmasi gangguan dari pelanggan. IP: ${customer.static_ip}, Area: ${customer.area}`);
                if (ticketId) {
                    await this.updateCustomerMonitoringState(customer.id, 'ticket_created', customer.ping_timeout_started_at, false, false);
                }
            }
        }
    }
}
exports.SmartStaticIPMonitoringService = SmartStaticIPMonitoringService;
//# sourceMappingURL=SmartStaticIPMonitoringService.js.map