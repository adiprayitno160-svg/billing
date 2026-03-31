"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartPPPoEMonitoringService = void 0;
const pool_1 = require("../../db/pool");
const mikrotikService_1 = require("../mikrotikService");
const pppoeService_1 = require("../pppoeService");
const MikroTikConnectionPool_1 = require("../MikroTikConnectionPool");
const WhatsAppService_1 = require("../whatsapp/WhatsAppService");
class SmartPPPoEMonitoringService {
    constructor() {
        this.whatsappService = WhatsAppService_1.whatsappService;
    }
    /**
     * Dapatkan semua pelanggan prepaid PPPoE yang aktif
     */
    async getActivePrepaidPPPoECustomers() {
        const query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.pppoe_username,
        c.area,
        c.odc_location,
        c.last_connection_loss,
        c.monitoring_state,
        c.connection_loss_detected_at
      FROM customers c
      WHERE c.billing_mode = 'prepaid' 
        AND c.connection_type = 'pppoe'
        AND c.status = 'active'
        AND c.pppoe_username IS NOT NULL 
        AND c.pppoe_username != ''
    `;
        try {
            const [results] = await pool_1.databasePool.query(query);
            return results;
        }
        catch (error) {
            console.error('Error getting active prepaid PPPoE customers:', error);
            return [];
        }
    }
    /**
     * Cek koneksi aktif di MikroTik untuk pelanggan tertentu
     */
    async checkMikroTikActiveConnections(username) {
        try {
            // Dapatkan konfigurasi MikroTik
            const config = await (0, pppoeService_1.getMikrotikConfig)();
            if (!config) {
                console.error('MikroTik configuration not found');
                return false;
            }
            // Ambil semua koneksi PPPoE aktif
            const activeConnections = await (0, mikrotikService_1.getPppoeActiveConnections)(config);
            // Cari apakah username pelanggan ada di daftar koneksi aktif
            const isActive = activeConnections.some((conn) => conn.name === username);
            return isActive;
        }
        catch (error) {
            console.error(`Error checking MikroTik connections for ${username}:`, error);
            return false;
        }
    }
    /**
     * Reset paksa koneksi PPPoE pelanggan di MikroTik
     */
    async forceResetPPPoEConnection(username) {
        try {
            const config = await (0, pppoeService_1.getMikrotikConfig)();
            if (!config) {
                console.error('MikroTik configuration not found');
                return false;
            }
            // Temukan dan hapus koneksi aktif
            const activeConnections = await (0, mikrotikService_1.getPppoeActiveConnections)(config);
            const connection = activeConnections.find((conn) => conn.name === username);
            if (connection && connection['.id']) {
                // Hapus koneksi aktif
                await MikroTikConnectionPool_1.mikrotikPool.execute(config, '/ppp/active/remove', [`.id=${connection['.id']}`]);
                console.log(`✅ Force reset connection for ${username}`);
                // Kirim pesan ke pelanggan bahwa koneksi sedang direset
                // DISABLED FOR NOW
                // const customer = await this.getCustomerByUsername(username);
                // if (customer && customer.phone) {
                //   await this.whatsappService.sendMessage(
                //     customer.phone,
                //     `🔧 Halo ${customer.name}, kami sedang melakukan reset koneksi internet Anda untuk memperbaiki masalah koneksi. Mohon tunggu beberapa saat.`
                //   );
                // }
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`Error force resetting PPPoE connection for ${username}:`, error);
            return false;
        }
    }
    /**
     * Buat tiket otomatis untuk teknisi
     */
    async createAutomaticTicket(customer, issueDescription) {
        const ticketNumber = `TKT-${Date.now()}`;
        const query = `
      INSERT INTO technician_jobs (
        ticket_number,
        customer_id,
        title,
        description,
        priority,
        status,
        reported_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        try {
            const [result] = await pool_1.databasePool.query(query, [
                ticketNumber,
                customer.id,
                `GANGGUAN: ${customer.name}`,
                issueDescription,
                'high', // Prioritas tinggi untuk koneksi hilang
                'pending',
                'automatic_monitoring'
            ]);
            const ticketId = result.insertId;
            console.log(`🎫 Automatic ticket created #${ticketId} for ${customer.name}`);
            // Kirim notifikasi ke pelanggan
            if (customer.phone) {
                // DISABLED FOR NOW
                // await this.whatsappService.sendMessage(
                //   customer.phone,
                //   `🎫 Halo ${customer.name}, kami telah membuat tiket gangguan otomatis (#${ticketId}) untuk masalah koneksi Anda. Tim teknisi kami akan segera menindaklanjuti.`
                // );
            }
            return ticketId;
        }
        catch (error) {
            console.error('Error creating automatic ticket:', error);
            return null;
        }
    }
    /**
     * Dapatkan data pelanggan berdasarkan username PPPoE
     */
    async getCustomerByUsername(username) {
        const query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.pppoe_username,
        c.area,
        c.location,
        c.last_connection_loss,
        c.monitoring_state,
        c.connection_loss_detected_at
      FROM customers c
      WHERE c.pppoe_username = ?
    `;
        try {
            const [results] = await pool_1.databasePool.query(query, [username]);
            return results.length > 0 ? results[0] : null;
        }
        catch (error) {
            console.error(`Error getting customer by username ${username}:`, error);
            return null;
        }
    }
    /**
     * Update monitoring state pelanggan
     */
    async updateCustomerMonitoringState(customerId, state, connectionLossDetectedAt = null) {
        const query = `
      UPDATE customers 
      SET monitoring_state = ?, 
          connection_loss_detected_at = ?
      WHERE id = ?
    `;
        try {
            await pool_1.databasePool.query(query, [state, connectionLossDetectedAt, customerId]);
        }
        catch (error) {
            console.error(`Error updating monitoring state for customer ${customerId}:`, error);
        }
    }
    /**
     * Proses monitoring cerdas untuk semua pelanggan prepaid PPPoE
     * Logika: Deteksi awal → Cek menit 3 → Action menit 6
     */
    async runSmartMonitoring() {
        console.log('🚀 Starting Smart PPPoE Monitoring for Prepaid Customers...');
        const customers = await this.getActivePrepaidPPPoECustomers();
        console.log(`📊 Found ${customers.length} active prepaid PPPoE customers`);
        for (const customer of customers) {
            try {
                await this.processCustomerMonitoring(customer);
            }
            catch (error) {
                console.error(`Error processing customer ${customer.name}:`, error);
            }
        }
        console.log('✅ Smart PPPoE Monitoring cycle completed');
    }
    /**
     * Proses monitoring untuk satu pelanggan
     */
    async processCustomerMonitoring(customer) {
        const now = new Date();
        // Jika ini deteksi awal koneksi hilang
        if (!customer.connection_loss_detected_at) {
            const isActive = await this.checkMikroTikActiveConnections(customer.pppoe_username);
            if (!isActive) {
                // Koneksi hilang terdeteksi - mulai proses monitoring
                console.log(`🔴 Connection loss detected for ${customer.name} (${customer.pppoe_username})`);
                await this.updateCustomerMonitoringState(customer.id, 'minute_3_check', now);
                // Kirim notifikasi awal ke pelanggan
                if (customer.phone) {
                    // DISABLED FOR NOW
                    // await this.whatsappService.sendMessage(
                    //   customer.phone,
                    //   `⚠️ Halo ${customer.name}, kami mendeteksi koneksi internet Anda terputus. Sistem sedang memeriksa dan akan menindaklanjuti jika diperlukan.`
                    // );
                }
            }
            return;
        }
        // Hitung selisih waktu sejak deteksi koneksi hilang
        const timeDiffMs = now.getTime() - customer.connection_loss_detected_at.getTime();
        const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
        console.log(`⏱️ Monitoring ${customer.name}: ${timeDiffMinutes} minutes since connection loss (state: ${customer.monitoring_state})`);
        // Menit 3: Cek apakah koneksi masih aktif di MikroTik
        if (customer.monitoring_state === 'minute_3_check' && timeDiffMinutes >= 3) {
            const isActive = await this.checkMikroTikActiveConnections(customer.pppoe_username);
            if (isActive) {
                // Koneksi aktif lagi - reset monitoring
                console.log(`✅ Connection restored for ${customer.name}`);
                await this.updateCustomerMonitoringState(customer.id, 'resolved');
                if (customer.phone) {
                    // DISABLED FOR NOW
                    // await this.whatsappService.sendMessage(
                    //   customer.phone,
                    //   `✅ Halo ${customer.name}, koneksi internet Anda telah pulih secara otomatis. Terima kasih atas kesabarannya.`
                    // );
                }
            }
            else {
                // Masih tidak aktif - lanjut ke menit 6
                console.log(`⏳ Connection still inactive for ${customer.name}, moving to minute 6 action`);
                await this.updateCustomerMonitoringState(customer.id, 'minute_6_action');
            }
            return;
        }
        // Menit 6: Action akhir - reset paksa atau buat tiket
        if (customer.monitoring_state === 'minute_6_action' && timeDiffMinutes >= 6) {
            const isActive = await this.checkMikroTikActiveConnections(customer.pppoe_username);
            if (isActive) {
                // Ada koneksi aktif yang "macet" - reset paksa
                console.log(`🔄 Force resetting stuck connection for ${customer.name}`);
                const resetSuccess = await this.forceResetPPPoEConnection(customer.pppoe_username);
                if (resetSuccess) {
                    await this.updateCustomerMonitoringState(customer.id, 'resolved');
                    // Kirim konfirmasi reset ke pelanggan
                    if (customer.phone) {
                        // DISABLED FOR NOW
                        // await this.whatsappService.sendMessage(
                        //   customer.phone,
                        //   `🔧 Halo ${customer.name}, koneksi internet Anda telah direset secara paksa untuk memperbaiki masalah. Silakan coba koneksi kembali.`
                        // );
                    }
                }
            }
            else {
                // Benar-benar tidak ada koneksi - buat tiket otomatis
                console.log(`🎫 Creating automatic ticket for ${customer.name} - genuine connection issue`);
                const ticketId = await this.createAutomaticTicket(customer, `Koneksi PPPoE prepaid pelanggan hilang secara permanen. Username: ${customer.pppoe_username}, Area: ${customer.area}`);
                if (ticketId) {
                    await this.updateCustomerMonitoringState(customer.id, 'ticket_created');
                }
            }
        }
    }
}
exports.SmartPPPoEMonitoringService = SmartPPPoEMonitoringService;
//# sourceMappingURL=SmartPPPoEMonitoringService.js.map