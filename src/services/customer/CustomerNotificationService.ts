/**
 * Customer Notification Service
 * 
 * Handles notifications for new customers:
 * - Welcome message via WhatsApp
 * - Admin notification via Telegram
 * - Integration with existing notification systems
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import alertRoutingService from '../alertRoutingService';
import { UnifiedNotificationService } from '../notification/UnifiedNotificationService';
import { NotificationTemplateService } from '../notification/NotificationTemplateService';
import { calculateCustomerIP } from '../../utils/ipHelper';
import { WhatsAppSessionService } from '../../services/whatsapp/WhatsAppSessionService';

export interface NewCustomerData {
  customerId: number;
  customerName: string;
  customerCode: string;
  phone?: string;
  email?: string;
  connectionType: 'pppoe' | 'static_ip';
  address?: string;
  packageName?: string;
  createdBy?: string;
}

export class CustomerNotificationService {

  /**
   * Ensure customer_created template exists and is active
   */
  private async ensureTemplateExists(): Promise<boolean> {
    try {
      // 1. Check if template exists by type and channel (active only)
      console.log('[CustomerNotification] Checking/Updating template to latest design...');

      const template = await NotificationTemplateService.getTemplate('customer_created', 'whatsapp');
      const existingByCode = await NotificationTemplateService.getTemplateByCode('customer_created');

      // 3. Create or update template to ensure latest design
      const templateData = {
        template_code: 'customer_created',
        template_name: 'Pelanggan Baru',
        notification_type: 'customer_created',
        channel: 'whatsapp',
        title_template: 'Konfirmasi Data Pelanggan Baru - {customer_code}',
        message_template: '✨ *LAYANAN INTERNET AKTIF* ✨\n\nHalo *{customer_name}*,\n\nSelamat! Koneksi internet Anda telah aktif dan siap digunakan. Terima kasih telah memilih layanan kami.\n\n📅 *JADWAL LAYANAN:*\n━━━━━━━━━━━━━━━\n🚀 *Aktivasi:* {activation_date}\n🔒 *Prediksi Isolir:* {isolation_date} (Oleh Asisten AI)\n\n📋 *DATA REGISTRASI:*\n━━━━━━━━━━━━━━━\n👤 *Nama:* {customer_name}\n🏠 *Alamat:* {address}\n🆔 *ID Pelanggan:* {customer_code}\n🔌 *Koneksi:* {connection_type}\n{package_info}{pppoe_info}{ip_info}\n━━━━━━━━━━━━━━━\n\n⚠️ *VERIFIKASI DATA:*\nMohon periksa data di atas. Apakah Nama & Alamat sudah sesuai?\n\n✅ Balas *BENAR* jika sudah sesuai.\n❌ Balas *SALAH* jika ada data yang perlu diperbaiki.',
        variables: ['customer_name', 'customer_code', 'connection_type', 'address', 'package_info', 'pppoe_info', 'ip_info', 'activation_date', 'isolation_date'],
        is_active: true,
        priority: 'normal' as 'normal' | 'low' | 'high'
      };

      if (template) {
        console.log('[CustomerNotification] Updating existing template to latest design...');
        await NotificationTemplateService.updateTemplate('customer_created', templateData);
      } else if (existingByCode) {
        console.log('[CustomerNotification] Activating and updating template found by code...');
        await NotificationTemplateService.updateTemplate('customer_created', templateData);
      } else {
        console.log('[CustomerNotification] Creating new template: customer_created');
        const templateId = await NotificationTemplateService.createTemplate(templateData);
        console.log(`[CustomerNotification] ✅ Created template customer_created (ID: ${templateId})`);
      }
      return true;
    } catch (error: any) {
      console.error('[CustomerNotification] Error ensuring template exists:', error);
      // We still try to continue if it's a minor error, but return false to signal setup failed if it's fatal
      return false;
    }
  }

  /**
   * Send welcome notification to new customer using UnifiedNotificationService with template
   */
  async sendWelcomeNotification(customerData: NewCustomerData): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[CustomerNotification] 📧 Starting welcome notification for customer ${customerData.customerId}...`);

      // Ensure template exists first
      const templateExists = await this.ensureTemplateExists();
      if (!templateExists) {
        console.error('[CustomerNotification] ❌ Failed to ensure template exists');
        return { success: false, message: 'Template setup failed. Please contact administrator.' };
      }

      // Get customer details
      const [customerRows] = await databasePool.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [customerData.customerId]
      );

      if (customerRows.length === 0) {
        console.error(`[CustomerNotification] ❌ Customer ${customerData.customerId} not found`);
        return { success: false, message: 'Customer not found' };
      }

      const customer = customerRows[0];
      console.log(`[CustomerNotification] 📋 Customer found: ${customer.name} (${customer.customer_code})`);

      // Validate phone number
      const targetPhone = customer.phone || customerData.phone;
      if (!targetPhone) {
        console.warn(`[CustomerNotification] ⚠️ No phone number for customer ${customerData.customerId}, skipping WhatsApp`);
        return { success: false, message: 'No phone number available' };
      }

      const phoneToUse = targetPhone;

      // Prepare variables for template
      const connectionTypeText = customerData.connectionType === 'pppoe' ? 'PPPoE' : 'Static IP';

      // Build package info
      let packageInfo = '';
      if (customerData.packageName) {
        packageInfo = `\n📦 Paket: ${customerData.packageName}`;
      }

      // Build PPPoE info
      let pppoeInfo = '';
      if (customerData.connectionType === 'pppoe' && customer.pppoe_username) {
        pppoeInfo = `\n\n🔐 *Kredensial PPPoE:*\nUsername: ${customer.pppoe_username}\nPassword: ${customer.pppoe_password || 'Silakan hubungi admin'}`;
      }

      // Build IP info
      // IMPORTANT: IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
      // IP yang ditampilkan ke pelanggan harus IP client (192.168.1.2)
      let ipInfo = '';
      if (customerData.connectionType === 'static_ip') {
        const [ipRows] = await databasePool.query<RowDataPacket[]>(
          'SELECT ip_address FROM static_ip_clients WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1',
          [customerData.customerId]
        );

        if (ipRows.length > 0 && ipRows[0].ip_address) {
          // Hitung IP client dari CIDR (192.168.1.1/30 -> 192.168.1.2)
          const customerIP = calculateCustomerIP(ipRows[0].ip_address);
          ipInfo = `\n\n🌐 *IP Address:*\n${customerIP}`;
        }
      }

      // Format address for display
      const addressDisplay = customerData.address || customer.address || 'Belum diisi';

      // Calculate dates
      const activationDate = new Date();
      const isolationDate = new Date();
      isolationDate.setDate(activationDate.getDate() + 30);

      const formatDateShort = (date: Date) => {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      };

      // Prepare variables
      const variables = {
        customer_name: customerData.customerName || customer.name || 'Pelanggan',
        customer_code: customerData.customerCode || customer.customer_code || '',
        connection_type: connectionTypeText,
        address: addressDisplay,
        package_info: packageInfo,
        pppoe_info: pppoeInfo,
        ip_info: ipInfo,
        activation_date: formatDateShort(activationDate),
        isolation_date: formatDateShort(isolationDate)
      };

      console.log(`[CustomerNotification] 📝 Variables prepared:`, {
        customer_name: variables.customer_name,
        customer_code: variables.customer_code,
        connection_type: variables.connection_type,
        has_package: !!packageInfo,
        has_pppoe: !!pppoeInfo,
        has_ip: !!ipInfo
      });

      // Use UnifiedNotificationService with template
      try {
        console.log(`[CustomerNotification] 📤 Queueing notification via UnifiedNotificationService...`);

        const notificationIds = await UnifiedNotificationService.queueNotification({
          customer_id: customerData.customerId,
          notification_type: 'customer_created',
          channels: ['whatsapp'],
          variables: variables,
          priority: 'normal',
          send_immediately: true // Trigger immediate send without blocking
        });

        if (!notificationIds || notificationIds.length === 0) {
          throw new Error('No notification IDs returned from queue');
        }

        console.log(`[CustomerNotification] ✅ Welcome notification queued successfully (IDs: ${notificationIds.join(', ')})`);

        // Log notification
        await this.logNotification({
          customerId: customerData.customerId,
          channel: 'whatsapp',
          type: 'customer_created',
          message: `Notification queued via UnifiedNotificationService (IDs: ${notificationIds.join(', ')})`,
          status: 'sent',
          recipient: phoneToUse
        });

        // Initialize Bot Session for Confirmation
        try {
          const cleanPhone = phoneToUse.replace(/\D/g, '');
          let formattedPhone = cleanPhone;
          if (cleanPhone.startsWith('0')) formattedPhone = '62' + cleanPhone.substring(1);

          console.log(`[CustomerNotification] 🤖 Initializing bot session for ${formattedPhone}...`);

          await WhatsAppSessionService.setSession(formattedPhone, {
            step: 'waiting_welcome_confirmation',
            data: {
              customerId: customerData.customerId,
              customerName: variables.customer_name,
              customerAddress: variables.address
            },
            lastInteraction: Date.now()
          });
        } catch (sessionErr) {
          console.error('[CustomerNotification] Failed to set bot session:', sessionErr);
        }

        return { success: true, message: 'Welcome notification queued for delivery' };
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to queue notification';
        console.error('[CustomerNotification] ❌ UnifiedNotificationService error:', {
          message: errorMessage,
          stack: error.stack,
          customerId: customerData.customerId,
          phone: phoneToUse
        });

        await this.logNotification({
          customerId: customerData.customerId,
          channel: 'whatsapp',
          type: 'customer_created',
          message: 'Failed to queue notification',
          status: 'failed',
          recipient: phoneToUse,
          error: errorMessage
        });

        return { success: false, message: errorMessage };
      }

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send notification';
      console.error('[CustomerNotification] ❌ Error sending welcome notification:', {
        message: errorMessage,
        stack: error.stack,
        customerId: customerData.customerId
      });

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send admin notification about new customer
   */
  async sendAdminNotification(customerData: NewCustomerData): Promise<void> {
    try {
      const alert = {
        alert_type: 'info' as const,
        recipient_type: 'internal' as const,
        recipient_id: 0,
        role: 'admin' as const,
        title: '🆕 PELANGGAN BARU',
        body:
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 Nama: ${customerData.customerName}\n` +
          `🆔 Kode: ${customerData.customerCode}\n` +
          `📞 Phone: ${customerData.phone || 'Tidak ada'}\n` +
          `🔌 Tipe: ${customerData.connectionType.toUpperCase()}\n` +
          `${customerData.packageName ? `📦 Paket: ${customerData.packageName}\n` : ''}` +
          `${customerData.address ? `📍 Alamat: ${customerData.address.substring(0, 50)}${customerData.address.length > 50 ? '...' : ''}\n` : ''}` +
          `${customerData.createdBy ? `👨‍💼 Dibuat oleh: ${customerData.createdBy}\n` : ''}` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Customer ID: ${customerData.customerId}`,
        metadata: {
          customer_id: customerData.customerId,
          customer_code: customerData.customerCode,
          connection_type: customerData.connectionType
        }
      };

      await alertRoutingService.routeAlert(alert);
      console.log(`[CustomerNotification] ✅ Admin notification sent via Telegram`);

    } catch (error) {
      console.error('[CustomerNotification] Error sending admin notification:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Log notification to database
   */
  private async logNotification(log: {
    customerId: number;
    channel: string;
    type: string;
    message: string;
    status: 'sent' | 'failed';
    recipient: string;
    error?: string;
  }): Promise<void> {
    try {
      await databasePool.query(
        `INSERT INTO customer_notifications_log (
          customer_id, channel, notification_type, message, 
          status, recipient, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          log.customerId,
          log.channel,
          log.type,
          log.message,
          log.status,
          log.recipient,
          log.error || null
        ]
      );
    } catch (error) {
      console.error('[CustomerNotification] Failed to log notification:', error);
      // Non-critical
    }
  }

  /**
   * Send notification for both customer and admin
   */
  async notifyNewCustomer(customerData: NewCustomerData): Promise<{
    customer: { success: boolean; message: string };
    admin: { success: boolean; message: string };
  }> {
    console.log(`[CustomerNotification] 🚀 Starting notifications for new customer: ${customerData.customerId}`);

    const results = {
      customer: { success: false, message: '' },
      admin: { success: false, message: '' }
    };

    // Send to customer
    try {
      console.log(`[CustomerNotification] 📱 Sending welcome notification to customer...`);
      results.customer = await this.sendWelcomeNotification(customerData);

      if (results.customer.success) {
        console.log(`[CustomerNotification] ✅ Customer notification: ${results.customer.message}`);
      } else {
        console.error(`[CustomerNotification] ❌ Customer notification failed: ${results.customer.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[CustomerNotification] ❌ Exception in customer notification:`, errorMessage);
      results.customer = { success: false, message: errorMessage };
    }

    // Send to admin
    try {
      console.log(`[CustomerNotification] 👨‍💼 Sending admin notification...`);
      await this.sendAdminNotification(customerData);
      results.admin = { success: true, message: 'Admin notification sent' };
      console.log(`[CustomerNotification] ✅ Admin notification sent successfully`);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[CustomerNotification] ❌ Admin notification failed:`, errorMessage);
      results.admin = { success: false, message: errorMessage };
    }

    // Summary
    console.log(`[CustomerNotification] 📊 Notification summary:`, {
      customer: results.customer.success ? '✅' : '❌',
      admin: results.admin.success ? '✅' : '❌'
    });

    return results;
  }
}

export default new CustomerNotificationService();

