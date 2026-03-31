/**
 * WhatsApp Service - Modern Baileys Implementation
 * Super Dynamic, Robust & Feature-Rich
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - QR Code management for web display
 * - Message queue with retry mechanism
 * - Typing indicators & read receipts
 * - Image, document, and media support
 * - Group messaging support
 * - Status/presence management
 * - Event-driven architecture
 */
import { WASocket, proto } from '@whiskeysockets/baileys';
import EventEmitter from 'events';
export interface WhatsAppStatus {
    ready: boolean;
    initializing: boolean;
    qr: string | null;
    qrDataUrl: string | null;
    phoneNumber: string | null;
    name: string | null;
    lastConnected: Date | null;
    reconnectAttempts: number;
    messagesSent: number;
    messagesReceived: number;
}
export interface SendMessageOptions {
    typing?: boolean;
    typingDuration?: number;
    quoted?: proto.IWebMessageInfo;
}
export interface MessageResult {
    success: boolean;
    messageId?: string;
    timestamp?: number;
    error?: string;
}
export declare class WhatsAppService extends EventEmitter {
    private static instance;
    private sock;
    private authState;
    qrCode: string | null;
    qrDataUrl: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    phoneNumber: string | null;
    displayName: string | null;
    lastConnected: Date | null;
    private messagesSent;
    private messagesReceived;
    private reconnectAttempts;
    private readonly MAX_RECONNECT_ATTEMPTS;
    private reconnectTimeout;
    private qrRetryCount;
    private readonly MAX_QR_RETRIES;
    private initPromise;
    private readyResolvers;
    private readyRejecters;
    private messageQueue;
    private isProcessingQueue;
    private readonly QUEUE_PROCESS_INTERVAL_MIN;
    private readonly QUEUE_PROCESS_INTERVAL_MAX;
    private readonly MAX_QUEUE_SIZE;
    private contactLastSent;
    private readonly CONTACT_COOLDOWN_MS;
    private hourlySentCount;
    private dailySentCount;
    private lastHourlyReset;
    private lastDailyReset;
    private readonly MAX_MESSAGES_PER_HOUR;
    private readonly MAX_MESSAGES_PER_DAY;
    private consecutiveSentCount;
    private lastBurstReset;
    private readonly BURST_WINDOW_MS;
    private readonly BURST_THRESHOLD;
    private recentMessages;
    private readonly DEDUP_WINDOW_MS;
    private readonly AUTH_DIR;
    private readonly LOG_DIR;
    private watchdogInterval;
    private lastInitializationTime;
    private constructor();
    /**
     * Watchdog to monitor service health and auto-restart if stuck
     */
    private startWatchdog;
    /**
     * Get singleton instance
     */
    static getInstance(): WhatsAppService;
    /**
     * Ensure required directories exist
     */
    private ensureDirectories;
    /**
     * Custom logger
     */
    private log;
    /**
     * Initialize WhatsApp connection
     */
    initialize(): Promise<void>;
    /**
     * Wait for the connection to be ready
     * @param timeoutMs Maximum time to wait in milliseconds
     */
    waitForReady(timeoutMs?: number): Promise<void>;
    /**
     * Setup all event handlers
     */
    private setupEventHandlers;
    /**
     * Extract text from message (Handles Ephemeral, ViewOnce, etc)
     */
    private extractMessageText;
    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect;
    private formatPhoneNumber;
    /**
     * Send a text message
     */
    sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<MessageResult>;
    /**
     * Send an image
     */
    sendImage(to: string, imagePath: string, caption?: string): Promise<MessageResult>;
    /**
     * Send a document
     */
    sendDocument(to: string, filePath: string, fileName?: string, caption?: string): Promise<MessageResult>;
    /**
     * Get MIME type from file extension
     */
    private getMimeType;
    /**
     * Reset rate limiting counters if time window has passed
     */
    private resetRateLimitCounters;
    /**
     * Generate a hash for message deduplication
     */
    private getMessageHash;
    /**
     * Calculate the appropriate delay based on rate limiting state
     */
    private calculateSmartDelay;
    /**
     * Queue a message for sending with anti-spam protection
     */
    private queueMessage;
    /**
     * Start the message queue processor
     */
    private startQueueProcessor;
    /**
     * Process the message queue
     */
    private processQueue;
    /**
     * Send message directly (internal)
     */
    private sendMessageDirect;
    /**
     * Check if a number is registered on WhatsApp
     */
    isRegistered(phone: string): Promise<boolean>;
    /**
     * Get service status (Cluster aware)
     */
    getStatus(): WhatsAppStatus;
    /**
     * Save current status to disk for cluster sharing
     */
    private saveStatusToDisk;
    /**
     * Read status from disk (used by non-zero cluster instances)
     */
    private readStatusFromDisk;
    /**
     * Restart the service
     */
    restart(): Promise<void>;
    /**
     * Logout and clear session
     */
    logout(): Promise<void>;
    /**
     * Clear session data
     */
    private clearSession;
    /**
     * Get raw socket (for advanced usage)
     */
    getSocket(): WASocket | null;
}
export declare const whatsappService: WhatsAppService;
export default whatsappService;
//# sourceMappingURL=WhatsAppService.d.ts.map