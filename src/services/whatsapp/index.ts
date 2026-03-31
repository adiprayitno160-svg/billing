/**
 * WhatsApp Module Exports
 * Modern Baileys-based implementation
 */

export { WhatsAppService, whatsappService } from './WhatsAppService';
export type { WhatsAppStatus, SendMessageOptions, MessageResult } from './WhatsAppService';

// Re-export handler if exists
export { WhatsAppHandler } from './WhatsAppHandler';
