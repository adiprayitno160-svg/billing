import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
// @ts-ignore - qrcode-terminal doesn't have type definitions
import * as qrcode from 'qrcode-terminal';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export interface WhatsAppMessageOptions {
    customerId?: number;
    template?: string;
    priority?: 'low' | 'normal' | 'high';
}

export class WhatsAppService {
    private static client: Client | null = null;
    private static isInitialized = false;
    private static isReady = false;
    private static reconnectAttempts = 0;
    private static maxReconnectAttempts = 5;
    private static sessionPath = './whatsapp-session';
    private static currentQRCode: string | null = null;
    private static isAuthenticated = false;

    /**
     * Initialize WhatsApp client
     */
    static async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('WhatsApp service already initialized');
            return;
        }

        try {
            console.log('📱 Initializing WhatsApp Business service...');

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: this.sessionPath
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });

            // QR Code event
            this.client.on('qr', (qr) => {
                console.log('📱 WhatsApp QR Code generated. Scan with your phone:');
                qrcode.generate(qr, { small: true });
                console.log('\nQR Code stored for web access');
                // Store QR code for API access
                this.currentQRCode = qr;
                this.isReady = false;
                this.isAuthenticated = false;
                console.log('✅ QR Code ready for binding');
            });

            // Ready event
            this.client.on('ready', () => {
                console.log('✅ WhatsApp client is ready!');
                this.isReady = true;
                this.isAuthenticated = true;
                this.currentQRCode = null; // Clear QR code after ready
                this.reconnectAttempts = 0;
            });

            // Authentication event
            this.client.on('authenticated', () => {
                console.log('✅ WhatsApp authenticated successfully');
                this.isAuthenticated = true;
                this.currentQRCode = null; // Clear QR code after authenticated
            });

            // Authentication failure event
            this.client.on('auth_failure', (msg) => {
                console.error('❌ WhatsApp authentication failed:', msg);
                this.isReady = false;
                this.isAuthenticated = false;
                // Don't clear QR code on auth failure, might need to regenerate
                // this.currentQRCode = null;
            });

            // Disconnected event
            this.client.on('disconnected', (reason) => {
                console.log('⚠️ WhatsApp client disconnected:', reason);
                this.isReady = false;
                this.isAuthenticated = false;
                this.currentQRCode = null;
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => {
                        this.initialize().catch(err => {
                            console.error('Failed to reconnect WhatsApp:', err);
                        });
                    }, 5000);
                } else {
                    console.error('❌ Max reconnection attempts reached. Please restart the server.');
                }
            });

            // Message event (for receiving messages)
            this.client.on('message', async (message: Message) => {
                // Handle incoming messages via bot service
                try {
                    const { WhatsAppBotService } = await import('./WhatsAppBotService');
                    await WhatsAppBotService.handleMessage(message);
                } catch (error) {
                    console.error('[WhatsAppService] Error handling bot message:', error);
                }
            });

            // Initialize the client
            await this.client.initialize();
            this.isInitialized = true;
            
            // Wait a bit for QR code to be generated (if needed)
            // QR code will be generated automatically via 'qr' event if not authenticated
            console.log('⏳ Waiting for QR code generation (if needed)...');
            // Don't wait too long, QR code will come via event

        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp service:', error);
            throw error;
        }
    }

    /**
     * Check if WhatsApp client is ready
     */
    static isClientReady(): boolean {
        return this.isReady && this.client !== null;
    }

    /**
     * Get client status
     */
    static getStatus(): { ready: boolean; initialized: boolean; authenticated: boolean; hasQRCode: boolean } {
        return {
            ready: this.isReady,
            initialized: this.isInitialized,
            authenticated: this.isAuthenticated,
            hasQRCode: this.currentQRCode !== null
        };
    }

    /**
     * Get current QR code
     */
    static getQRCode(): string | null {
        return this.currentQRCode;
    }

    /**
     * Regenerate QR code by destroying and reinitializing client
     */
    static async regenerateQRCode(): Promise<void> {
        try {
            console.log('🔄 Regenerating QR code...');
            
            // Destroy existing client first
            if (this.client) {
                try {
                    await this.destroy();
                } catch (err) {
                    console.warn('Error destroying client:', err);
                }
            }
            
            // Clear session folder to force new QR code
            const fs = require('fs');
            const path = require('path');
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');
            
            if (fs.existsSync(sessionPath)) {
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                } catch (err) {
                    console.warn('Error deleting session folder:', err);
                }
            }
            
            // Reset state
            this.currentQRCode = null;
            this.isReady = false;
            this.isAuthenticated = false;
            this.isInitialized = false;
            this.reconnectAttempts = 0;
            
            // Wait a bit before reinitializing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Reinitialize
            await this.initialize();
            
            // Wait for QR code to be generated (max 15 seconds)
            let attempts = 0;
            const maxAttempts = 30; // 15 seconds total
            while (!this.currentQRCode && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
                
                // Check if client is still initializing
                if (!this.isInitialized && attempts > 10) {
                    console.warn('⚠️ Client initialization taking longer than expected...');
                }
            }
            
            if (this.currentQRCode) {
                console.log('✅ QR code regenerated successfully');
            } else {
                console.warn('⚠️ QR code not generated yet. This might be because:');
                console.warn('   1. Client is still initializing (wait a bit longer)');
                console.warn('   2. Session is still valid (client might be ready)');
                console.warn('   3. There was an error during initialization');
                
                // Check if client is ready (session might still be valid)
                if (this.isReady) {
                    console.log('ℹ️ Client is ready (session still valid), no QR code needed');
                }
            }
        } catch (error) {
            console.error('Failed to regenerate QR code:', error);
            throw error;
        }
    }

    /**
     * Format phone number to WhatsApp format
     */
    private static formatPhoneNumber(phone: string): string {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        
        // If starts with 0, replace with country code (62 for Indonesia)
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        
        // If doesn't start with country code, add it
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        
        return cleaned + '@c.us';
    }

    /**
     * Send WhatsApp message
     */
    static async sendMessage(
        phone: string,
        message: string,
        options: WhatsAppMessageOptions = {}
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);
            
            // Log to database
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                error,
                options.template
            );
            
            return { success: false, error };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            
            console.log(`📱 [WhatsApp] Sending message:`);
            console.log(`   Original phone: ${phone}`);
            console.log(`   Formatted phone: ${formattedPhone}`);
            console.log(`   Message length: ${message.length} chars`);
            
            // Send message
            const result = await this.client!.sendMessage(formattedPhone, message);
            
            console.log(`✅ WhatsApp message sent to ${phone} (formatted: ${formattedPhone})`);
            console.log(`   Message ID: ${result.id._serialized}`);
            
            // Log success to database
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'sent',
                undefined,
                options.template
            );
            
            return {
                success: true,
                messageId: result.id._serialized
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send WhatsApp message to ${phone}:`, errorMessage);
            
            // Log failure to database
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                errorMessage,
                options.template
            );
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Send WhatsApp message with media
     */
    static async sendMessageWithMedia(
        phone: string,
        message: string,
        mediaPath: string,
        options: WhatsAppMessageOptions = {}
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.isClientReady()) {
            const error = 'WhatsApp client is not ready. Please scan QR code first.';
            console.error('❌', error);
            
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                error,
                options.template
            );
            
            return { success: false, error };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            const media = MessageMedia.fromFilePath(mediaPath);
            
            const result = await this.client!.sendMessage(formattedPhone, media, { caption: message });
            
            console.log(`✅ WhatsApp message with media sent to ${phone}`);
            
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'sent',
                undefined,
                options.template
            );
            
            return {
                success: true,
                messageId: result.id._serialized
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            console.error(`❌ Failed to send WhatsApp message with media to ${phone}:`, errorMessage);
            
            await this.logNotification(
                options.customerId,
                phone,
                message,
                'failed',
                errorMessage,
                options.template
            );
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Send bulk messages
     */
    static async sendBulkMessages(
        recipients: Array<{ phone: string; message: string; customerId?: number }>,
        delayMs: number = 2000
    ): Promise<{ success: number; failed: number; results: Array<{ phone: string; success: boolean; error?: string }> }> {
        const results: Array<{ phone: string; success: boolean; error?: string }> = [];
        let successCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
            const result = await this.sendMessage(recipient.phone, recipient.message, {
                customerId: recipient.customerId
            });
            
            results.push({
                phone: recipient.phone,
                success: result.success,
                error: result.error
            });

            if (result.success) {
                successCount++;
            } else {
                failedCount++;
            }

            // Delay between messages to avoid rate limiting
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        return {
            success: successCount,
            failed: failedCount,
            results
        };
    }

    /**
     * Log notification to database
     */
    private static async logNotification(
        customerId: number | undefined,
        recipient: string,
        message: string,
        status: 'pending' | 'sent' | 'failed',
        errorMessage: string | undefined,
        template: string | undefined
    ): Promise<void> {
        try {
            // Check table structure to use correct columns
            let query: string;
            let params: any[];
            
            try {
                // Check what columns exist
                const [columns] = await databasePool.query('SHOW COLUMNS FROM notification_logs');
                const columnNames = (columns as any[]).map((col: any) => col.Field);
                
                if (columnNames.includes('channel')) {
                    // New format with channel column
                    query = `
                        INSERT INTO notification_logs 
                        (customer_id, channel, recipient, template, message, status, error_message, sent_at, created_at)
                        VALUES (?, 'whatsapp', ?, ?, ?, ?, ?, ?, NOW())
                    `;
                    params = [
                        customerId || null,
                        recipient,
                        template || null,
                        message,
                        status,
                        errorMessage || null,
                        status === 'sent' ? new Date() : null
                    ];
                } else if (columnNames.includes('notification_type')) {
                    // Old format with notification_type enum
                    query = `
                        INSERT INTO notification_logs 
                        (customer_id, notification_type, message, status, sent_at, created_at)
                        VALUES (?, 'whatsapp', ?, ?, ?, NOW())
                    `;
                    params = [
                        customerId || null,
                        message,
                        status,
                        status === 'sent' ? new Date() : null
                    ];
                } else {
                    // Fallback - minimal columns
                    query = `
                        INSERT INTO notification_logs 
                        (customer_id, message, status, sent_at, created_at)
                        VALUES (?, ?, ?, ?, NOW())
                    `;
                    params = [
                        customerId || null,
                        message,
                        status,
                        status === 'sent' ? new Date() : null
                    ];
                }
            } catch (checkError) {
                // If check fails, use minimal format
                query = `
                    INSERT INTO notification_logs 
                    (customer_id, message, status, sent_at, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                `;
                params = [
                    customerId || null,
                    message,
                    status,
                    status === 'sent' ? new Date() : null
                ];
            }
            
            await databasePool.query(query, params);
        } catch (error) {
            console.error('Failed to log notification to database:', error);
            // Non-critical, don't throw
        }
    }

    /**
     * Get notification history
     */
    static async getNotificationHistory(
        limit: number = 50,
        customerId?: number,
        status?: string
    ): Promise<any[]> {
        try {
            let query = `
                SELECT 
                    id,
                    customer_id,
                    channel,
                    recipient,
                    template,
                    message,
                    status,
                    error_message,
                    sent_at,
                    created_at
                FROM notification_logs
                WHERE channel = 'whatsapp'
            `;
            const params: any[] = [];

            if (customerId) {
                query += ' AND customer_id = ?';
                params.push(customerId);
            }

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
            return rows;
        } catch (error) {
            console.error('Failed to get notification history:', error);
            return [];
        }
    }

    /**
     * Get notification statistics
     */
    static async getNotificationStats(): Promise<{
        total: number;
        sent: number;
        failed: number;
        pending: number;
        successRate: number;
    }> {
        try {
            // Try with channel column first, fallback to all notifications if column doesn't exist
            let query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                FROM notification_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;
            
            // Try to filter by channel if column exists
            try {
                const [testRows] = await databasePool.query<RowDataPacket[]>(
                    'SELECT channel FROM notification_logs LIMIT 1'
                );
                if (testRows.length > 0) {
                    query = query.replace('WHERE created_at', "WHERE channel = 'whatsapp' AND created_at");
                }
            } catch (err) {
                // Column doesn't exist, use query without channel filter
                console.log('⚠️ notification_logs.channel column not found, using all notifications');
            }

            const [rows] = await databasePool.query<RowDataPacket[]>(query);
            const stats = rows[0];

            if (!stats) {
                return {
                    total: 0,
                    sent: 0,
                    failed: 0,
                    pending: 0,
                    successRate: 0
                };
            }

            const total = parseInt(stats.total || '0', 10);
            const sent = parseInt(stats.sent || '0', 10);
            const successRate = total > 0 ? (sent / total) * 100 : 0;

            return {
                total,
                sent: parseInt(stats.sent || '0', 10),
                failed: parseInt(stats.failed || '0', 10),
                pending: parseInt(stats.pending || '0', 10),
                successRate: Math.round(successRate * 100) / 100
            };
        } catch (error) {
            console.error('Failed to get notification stats:', error);
            return {
                total: 0,
                sent: 0,
                failed: 0,
                pending: 0,
                successRate: 0
            };
        }
    }

    /**
     * Destroy WhatsApp client
     */
    static async destroy(): Promise<void> {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
            this.isInitialized = false;
            this.isReady = false;
            console.log('WhatsApp client destroyed');
        }
    }
}

