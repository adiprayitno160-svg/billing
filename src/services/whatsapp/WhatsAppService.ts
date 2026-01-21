import { WhatsAppClient } from './WhatsAppClient';
import { FoonteProvider } from './providers/FoonteProvider';
import { databasePool } from '../../db/pool';

export class WhatsAppService {
  private whatsAppClient: WhatsAppClient;
  private foonteClient: FoonteProvider;

  constructor() {
    this.whatsAppClient = WhatsAppClient.getInstance();
    this.foonteClient = FoonteProvider.getInstance();
  }

  /**
   * Send a WhatsApp message with Redundancy (Primary: WebJS, Secondary: Foonte)
   */
  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    let sentMethod = 'none';
    let status = 'failed';
    let errorLog = '';

    // 1. Try Primary (WhatsApp Web JS)
    try {
      if (this.whatsAppClient.getStatus().ready) {
        await this.whatsAppClient.sendMessage(cleanPhone, message);
        sentMethod = 'primary_webjs';
        status = 'sent';
        console.log(`✅ [Primary] Message sent to ${cleanPhone}`);
      } else {
        throw new Error('Primary client not ready');
      }
    } catch (primaryError: any) {
      const errMsg = primaryError?.message || String(primaryError);
      console.warn(`⚠️ [Primary] Failed to send to ${phoneNumber}: ${errMsg}`);
      errorLog += `Primary: ${errMsg}; `;

      // 2. Try Secondary (Foonte) if Primary failed
      try {
        console.log(`🔄 [Redundancy] Switching to Foonte for ${cleanPhone}...`);
        const foonteSuccess = await this.foonteClient.sendMessage(cleanPhone, message);

        if (foonteSuccess) {
          sentMethod = 'secondary_foonte';
          status = 'sent';
          console.log(`✅ [Secondary] Message sent via Foonte`);
        } else {
          throw new Error('Foonte API returned false');
        }
      } catch (secondaryError: any) {
        console.error(`❌ [Secondary] Failed: ${secondaryError.message}`);
        errorLog += `Secondary: ${secondaryError.message}`;
      }
    }

    // 3. Centralized Logging (Required by User)
    await this.logMessageToDB(cleanPhone, message, status, sentMethod, errorLog);

    if (status === 'failed') {
      throw new Error(`All providers failed. ${errorLog}`);
    }
  }

  private async logMessageToDB(phone: string, message: string, status: string, method: string, error: string) {
    try {
      // Find customer ID if exists (optional best practice)
      const [cust] = await databasePool.query<any[]>('SELECT id FROM customers WHERE phone LIKE ? LIMIT 1', [`%${phone.replace(/^62/, '0')}%`]);
      const customerId = cust.length > 0 ? cust[0].id : null;

      await databasePool.query(
        `INSERT INTO whatsapp_bot_messages 
            (phone_number, customer_id, direction, message_type, message_content, status, created_at)
            VALUES (?, ?, 'outbound', 'text', ?, ?, NOW())`,
        [
          phone,
          customerId,
          // Append method to message content for admin visibility or just keep clean? 
          // User requested "sistem canggih", let's store metadata in message or just separate column if schema allowed.
          // For now, we adhere to existing schema. We can append metadata to content if strictly needed, 
          // but let's separate debug info.
          // Actually, let's prepend a tiny flag if Sent via Backup for visibility?
          // No, clean is better.
          message,
          status
        ]
      );

      console.log(`[DB] Logged ${status} message via ${method}`);
    } catch (err) {
      console.error('[DB] Failed to log message:', err);
    }
  }

  /**
   * Check if WhatsApp service is ready
   */
  isReady(): boolean {
    return this.whatsAppClient.getStatus().ready || this.foonteClient.isConfigured();
  }

  /**
   * Get current status of WhatsApp connection
   */
  getStatus() {
    const primary = this.whatsAppClient.getStatus();
    return {
      ...primary,
      secondaryConfigured: this.foonteClient.isConfigured(),
      usingFallback: !primary.ready && this.foonteClient.isConfigured()
    };
  }

  /**
   * Initialize the WhatsApp connection
   */
  async initialize(): Promise<void> {
    await this.whatsAppClient.initialize();
  }
}
