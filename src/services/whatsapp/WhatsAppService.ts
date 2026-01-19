import { WhatsAppBaileys } from './WhatsAppBaileys';

export class WhatsAppService {
  private whatsAppClient: WhatsAppBaileys;

  constructor() {
    this.whatsAppClient = WhatsAppBaileys.getInstance();
  }

  /**
   * Send a WhatsApp message to a phone number
   */
  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      // Ensure the WhatsApp client is initialized
      if (!this.whatsAppClient.client) {
        await this.whatsAppClient.initialize();
      }

      // Format phone number (remove non-digit characters and ensure correct format)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      await this.whatsAppClient.sendMessage(formattedNumber, message);
      console.log(`✅ WhatsApp message sent to ${formattedNumber}: ${message.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed to send WhatsApp message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Check if WhatsApp service is ready
   */
  isReady(): boolean {
    return this.whatsAppClient.getStatus().ready;
  }

  /**
   * Get current status of WhatsApp connection
   */
  getStatus() {
    return this.whatsAppClient.getStatus();
  }

  /**
   * Initialize the WhatsApp connection
   */
  async initialize(): Promise<void> {
    await this.whatsAppClient.initialize();
  }
}