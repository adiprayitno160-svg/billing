import { databasePool } from '../../db/pool';
import { getPppoeActiveConnections } from '../mikrotikService';
import { getMikrotikConfig } from '../pppoeService';
import { mikrotikPool } from '../MikroTikConnectionPool';
import { WhatsAppService } from '../whatsapp/WhatsAppService';

interface PrepaidCustomer {
  id: number;
  name: string;
  phone: string;
  pppoe_username: string;
  area: string;
  location: string;
  last_connection_loss: Date | null;
  monitoring_state: 'initial' | 'minute_3_check' | 'minute_6_action' | 'ticket_created' | 'resolved';
  connection_loss_detected_at: Date | null;
}

export class SmartPPPoEMonitoringService {
  private whatsappService: WhatsAppService;

  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Dapatkan semua pelanggan prepaid PPPoE yang aktif
   */
  async getActivePrepaidPPPoECustomers(): Promise<PrepaidCustomer[]> {
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
      WHERE c.billing_mode = 'prepaid' 
        AND c.connection_type = 'pppoe'
        AND c.is_active = 1
        AND c.pppoe_username IS NOT NULL 
        AND c.pppoe_username != ''
    `;

    try {
      const [results] = await databasePool.query(query);
      return results as PrepaidCustomer[];
    } catch (error) {
      console.error('Error getting active prepaid PPPoE customers:', error);
      return [];
    }
  }

  /**
   * Cek koneksi aktif di MikroTik untuk pelanggan tertentu
   */
  async checkMikroTikActiveConnections(username: string): Promise<boolean> {
    try {
      // Dapatkan konfigurasi MikroTik
      const config = await getMikrotikConfig();
      if (!config) {
        console.error('MikroTik configuration not found');
        return false;
      }

      // Ambil semua koneksi PPPoE aktif
      const activeConnections = await getPppoeActiveConnections(config);

      // Cari apakah username pelanggan ada di daftar koneksi aktif
      const isActive = activeConnections.some(
        (conn: any) => conn.name === username
      );

      return isActive;
    } catch (error) {
      console.error(`Error checking MikroTik connections for ${username}:`, error);
      return false;
    }
  }

  /**
   * Reset paksa koneksi PPPoE pelanggan di MikroTik
   */
  async forceResetPPPoEConnection(username: string): Promise<boolean> {
    try {
      const config = await getMikrotikConfig();
      if (!config) {
        console.error('MikroTik configuration not found');
        return false;
      }

      // Temukan dan hapus koneksi aktif
      const activeConnections = await getPppoeActiveConnections(config);
      const connection = activeConnections.find(
        (conn: any) => conn.name === username
      );

      if (connection && connection['.id']) {
        // Hapus koneksi aktif
        await mikrotikPool.execute(config, '/ppp/active/remove', [`.id=${connection['.id']}`]);
        console.log(`✅ Force reset connection for ${username}`);

        // Kirim pesan ke pelanggan bahwa koneksi sedang direset
        const customer = await this.getCustomerByUsername(username);
        if (customer && customer.phone) {
          await this.whatsappService.sendMessage(
            customer.phone,
            `🔧 Halo ${customer.name}, kami sedang melakukan reset koneksi internet Anda untuk memperbaiki masalah koneksi. Mohon tunggu beberapa saat.`
          );
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error force resetting PPPoE connection for ${username}:`, error);
      return false;
    }
  }

  /**
   * Buat tiket otomatis untuk teknisi
   */
  async createAutomaticTicket(customer: PrepaidCustomer, issueDescription: string): Promise<number | null> {
    const query = `
      INSERT INTO technician_tickets (
        customer_id,
        customer_name,
        phone,
        area,
        location,
        issue_description,
        priority,
        status,
        created_at,
        assigned_to,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, ?)
    `;

    try {
      const [result]: any = await databasePool.query(query, [
        customer.id,
        customer.name,
        customer.phone,
        customer.area,
        customer.location,
        issueDescription,
        'high', // Prioritas tinggi untuk koneksi hilang
        'open',
        'automatic_monitoring'
      ]);

      const ticketId = result.insertId;
      console.log(`🎫 Automatic ticket created #${ticketId} for ${customer.name}`);

      // Kirim notifikasi ke pelanggan
      if (customer.phone) {
        await this.whatsappService.sendMessage(
          customer.phone,
          `🎫 Halo ${customer.name}, kami telah membuat tiket gangguan otomatis (#${ticketId}) untuk masalah koneksi Anda. Tim teknisi kami akan segera menindaklanjuti.`
        );
      }

      return ticketId;
    } catch (error) {
      console.error('Error creating automatic ticket:', error);
      return null;
    }
  }

  /**
   * Dapatkan data pelanggan berdasarkan username PPPoE
   */
  async getCustomerByUsername(username: string): Promise<PrepaidCustomer | null> {
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
      const [results]: any = await databasePool.query(query, [username]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error(`Error getting customer by username ${username}:`, error);
      return null;
    }
  }

  /**
   * Update monitoring state pelanggan
   */
  async updateCustomerMonitoringState(
    customerId: number,
    state: 'initial' | 'minute_3_check' | 'minute_6_action' | 'ticket_created' | 'resolved',
    connectionLossDetectedAt: Date | null = null
  ): Promise<void> {
    const query = `
      UPDATE customers 
      SET monitoring_state = ?, 
          connection_loss_detected_at = ?
      WHERE id = ?
    `;

    try {
      await databasePool.query(query, [state, connectionLossDetectedAt, customerId]);
    } catch (error) {
      console.error(`Error updating monitoring state for customer ${customerId}:`, error);
    }
  }

  /**
   * Proses monitoring cerdas untuk semua pelanggan prepaid PPPoE
   * Logika: Deteksi awal → Cek menit 3 → Action menit 6
   */
  async runSmartMonitoring(): Promise<void> {
    console.log('🚀 Starting Smart PPPoE Monitoring for Prepaid Customers...');

    const customers = await this.getActivePrepaidPPPoECustomers();
    console.log(`📊 Found ${customers.length} active prepaid PPPoE customers`);

    for (const customer of customers) {
      try {
        await this.processCustomerMonitoring(customer);
      } catch (error) {
        console.error(`Error processing customer ${customer.name}:`, error);
      }
    }

    console.log('✅ Smart PPPoE Monitoring cycle completed');
  }

  /**
   * Proses monitoring untuk satu pelanggan
   */
  private async processCustomerMonitoring(customer: PrepaidCustomer): Promise<void> {
    const now = new Date();

    // Jika ini deteksi awal koneksi hilang
    if (!customer.connection_loss_detected_at) {
      const isActive = await this.checkMikroTikActiveConnections(customer.username_pppoe);

      if (!isActive) {
        // Koneksi hilang terdeteksi - mulai proses monitoring
        console.log(`🔴 Connection loss detected for ${customer.name} (${customer.username_pppoe})`);

        await this.updateCustomerMonitoringState(
          customer.id,
          'minute_3_check',
          now
        );

        // Kirim notifikasi awal ke pelanggan
        if (customer.phone) {
          await this.whatsappService.sendMessage(
            customer.phone,
            `⚠️ Halo ${customer.name}, kami mendeteksi koneksi internet Anda terputus. Sistem sedang memeriksa dan akan menindaklanjuti jika diperlukan.`
          );
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
      const isActive = await this.checkMikroTikActiveConnections(customer.username_pppoe);

      if (isActive) {
        // Koneksi aktif lagi - reset monitoring
        console.log(`✅ Connection restored for ${customer.name}`);
        await this.updateCustomerMonitoringState(customer.id, 'resolved');

        if (customer.phone) {
          await this.whatsappService.sendMessage(
            customer.phone,
            `✅ Halo ${customer.name}, koneksi internet Anda telah pulih secara otomatis. Terima kasih atas kesabarannya.`
          );
        }
      } else {
        // Masih tidak aktif - lanjut ke menit 6
        console.log(`⏳ Connection still inactive for ${customer.name}, moving to minute 6 action`);
        await this.updateCustomerMonitoringState(customer.id, 'minute_6_action');
      }
      return;
    }

    // Menit 6: Action akhir - reset paksa atau buat tiket
    if (customer.monitoring_state === 'minute_6_action' && timeDiffMinutes >= 6) {
      const isActive = await this.checkMikroTikActiveConnections(customer.username_pppoe);

      if (isActive) {
        // Ada koneksi aktif yang "macet" - reset paksa
        console.log(`🔄 Force resetting stuck connection for ${customer.name}`);
        const resetSuccess = await this.forceResetPPPoEConnection(customer.username_pppoe);

        if (resetSuccess) {
          await this.updateCustomerMonitoringState(customer.id, 'resolved');

          // Kirim konfirmasi reset ke pelanggan
          if (customer.phone) {
            await this.whatsappService.sendMessage(
              customer.phone,
              `🔧 Halo ${customer.name}, koneksi internet Anda telah direset secara paksa untuk memperbaiki masalah. Silakan coba koneksi kembali.`
            );
          }
        }
      } else {
        // Benar-benar tidak ada koneksi - buat tiket otomatis
        console.log(`🎫 Creating automatic ticket for ${customer.name} - genuine connection issue`);
        const ticketId = await this.createAutomaticTicket(
          customer,
          `Koneksi PPPoE prepaid pelanggan hilang secara permanen. Username: ${customer.username_pppoe}, Area: ${customer.area}`
        );

        if (ticketId) {
          await this.updateCustomerMonitoringState(customer.id, 'ticket_created');
        }
      }
    }
  }
}