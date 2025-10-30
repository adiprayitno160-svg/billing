import QRCode from 'qrcode';
import { databasePool } from '../../db/pool';
import { WhatsAppBotService } from './WhatsAppBotService';
import { RowDataPacket } from 'mysql2';
const { Client, LocalAuth } = require('whatsapp-web.js');

export interface WhatsAppWebSession {
    id: number;
    device_id: string;
    session_data: any;
    is_connected: boolean;
    last_activity: Date;
    created_at: Date;
}

export interface QRCodeData {
    sessionId: string;
    timestamp: number;
    type: string;
    deviceId?: string;
}

export class WhatsAppWebService {
    private static currentSession: WhatsAppWebSession | null = null;
    private static qrCodeData: QRCodeData | null = null;
    private static isReady: boolean = false;
    private static client: any = null;
    private static latestQRCode: string | null = null;
    private static qrCodeListeners: Array<(qr: string) => void> = [];

    /**
     * Initialize WhatsApp Web Service with whatsapp-web.js
     */
    static async initialize(): Promise<void> {
        try {
            console.log('📱 Initializing WhatsApp Web Service with whatsapp-web.js...');
            
            // Skip if already initialized
            if (this.client) {
                console.log('⚠️ WhatsApp client already initialized');
                return;
            }
            
            // Create WhatsApp Web client with authentication
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'billing-system',
                    dataPath: './whatsapp-session'
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
                    ],
                    timeout: 60000 // 60 second timeout for puppeteer
                }
            });

            // QR Code event - generate QR for scanning
            this.client.on('qr', async (qr: string) => {
                console.log('📱 QR Code received from WhatsApp');
                
                // Convert QR to data URL
                try {
                    const qrCodeDataURL = await QRCode.toDataURL(qr, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    
                    this.latestQRCode = qrCodeDataURL;
                    await this.saveQRCode(qrCodeDataURL);
                    await this.logConnection('system', 'qr_generated', 'success', 'QR Code generated');
                    
                    // Notify listeners
                    this.qrCodeListeners.forEach(listener => listener(qrCodeDataURL));
                } catch (error) {
                    console.error('Error converting QR code:', error);
                }
            });

            // Ready event - client is authenticated and ready
            this.client.on('ready', async () => {
                console.log('✅ WhatsApp Web client is ready!');
                this.isReady = true;
                
                await this.logConnection('system', 'ready', 'success', 'Client ready and connected');
            });

            // Authenticated event
            this.client.on('authenticated', async () => {
                console.log('✅ WhatsApp Web authenticated successfully');
                await this.logConnection('system', 'authenticated', 'success', 'Client authenticated');
            });

            // Message event - handle incoming messages
            this.client.on('message', async (message: any) => {
                try {
                    const from = message.from;
                    const body = message.body;
                    const messageId = message.id._serialized;
                    
                    // FILTER: Ignore status/story updates
                    if (from.includes('status@broadcast') || from === 'status@broadcast') {
                        console.log(`⏭️ Ignoring WhatsApp status from ${from}`);
                        return;
                    }
                    
                    // FILTER: Ignore group messages
                    if (from.includes('@g.us')) {
                        console.log(`⏭️ Ignoring group message from ${from}`);
                        return;
                    }
                    
                    // FILTER: Ignore messages from self (bot)
                    if (message.fromMe) {
                        console.log(`⏭️ Ignoring message from self`);
                        return;
                    }
                    
                    console.log(`📨 Message received from ${from}: ${body}`);
                    
                    // Handle with bot service
                    await this.handleIncomingMessage(from, body, messageId);
                } catch (error) {
                    console.error('Error handling incoming message:', error);
                }
            });

            // Disconnected event
            this.client.on('disconnected', async (reason: string) => {
                console.log('❌ WhatsApp Web disconnected:', reason);
                this.isReady = false;
                await this.logConnection('system', 'disconnected', 'failed', `Disconnected: ${reason}`);
            });

            // Authentication failure event
            this.client.on('auth_failure', async (message: string) => {
                console.error('❌ WhatsApp Web authentication failed:', message);
                await this.logConnection('system', 'auth_failure', 'failed', `Auth failed: ${message}`);
            });

            // Initialize the client (async, non-blocking)
            this.client.initialize().then(() => {
                console.log('✅ WhatsApp Web Service initialized successfully');
                this.logConnection('system', 'initialize', 'success', 'WhatsApp Web Service initialized');
            }).catch((error: any) => {
                console.error('❌ Error initializing WhatsApp Web client:', error);
                this.logConnection('system', 'initialize', 'failed', error instanceof Error ? error.message : String(error));
                this.client = null; // Reset client on error
            });
            
            console.log('📱 WhatsApp Web Service initialization started (background process)');
            
        } catch (error) {
            console.error('Error setting up WhatsApp Web Service:', error);
            await this.logConnection('system', 'initialize', 'failed', error instanceof Error ? error.message : String(error));
            this.client = null;
            // Don't throw - allow server to continue
        }
    }

    /**
     * Handle incoming message with auto-response bot
     */
    private static async handleIncomingMessage(from: string, message: string, messageId: string): Promise<void> {
        try {
            // Use WhatsApp Bot Service to handle message
            const response = await WhatsAppBotService.handleIncomingMessage(from, message, messageId);
            
            // Send response if available
            if (response) {
                await this.sendMessage(from, response);
            }
            
        } catch (error) {
            console.error('Error handling incoming message:', error);
        }
    }

    /**
     * Save QR Code to database
     */
    private static async saveQRCode(qrCodeDataURL: string): Promise<void> {
        try {
            // Deactivate old QR codes
            await databasePool.execute(`
                UPDATE whatsapp_qr_codes SET is_active = 0
            `);
            
            // Save new QR code
            await databasePool.execute(`
                INSERT INTO whatsapp_qr_codes (qr_code_data_url, session_id, is_active, expires_at)
                VALUES (?, ?, 1, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
            `, [qrCodeDataURL, this.qrCodeData?.sessionId || 'unknown']);
            
        } catch (error) {
            console.error('Error saving QR code:', error);
        }
    }

    /**
     * Generate QR Code untuk WhatsApp Web binding
     * Returns the latest QR code from WhatsApp Web client
     */
    static async generateQRCode(): Promise<string> {
        try {
            console.log('🔄 Generating QR Code...');
            
            // If client is ready (authenticated), return success message
            if (this.isReady) {
                console.log('⚠️ Client already authenticated');
                // Clear QR and force new one
                this.latestQRCode = null;
                this.isReady = false;
            }

            // If we have a cached QR code and client is initializing, return it
            if (this.latestQRCode && this.client) {
                console.log('✅ Returning cached QR code');
                return this.latestQRCode;
            }

            // If client not initialized, initialize it
            if (!this.client) {
                console.log('🔄 Client not initialized, initializing now...');
                try {
                    await this.initialize();
                } catch (initError) {
                    console.error('❌ Initialization error:', initError);
                    throw new Error('Failed to initialize WhatsApp client. Please try again.');
                }
                
                // Wait a bit for client to start
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // If QR already available after init, return it
            if (this.latestQRCode) {
                console.log('✅ QR Code already available after init');
                return this.latestQRCode;
            }

            // Wait for QR code to be generated (with timeout)
            console.log('⏳ Waiting for QR code from WhatsApp...');
            console.log('⏳ This may take 30-60 seconds on first run...');
            
            return new Promise((resolve, reject) => {
                // 90 second timeout - give more time for first run
                const timeout = setTimeout(() => {
                    const errorMsg = 'QR code generation timeout. Please wait a moment and click "Generate QR Code" again.';
                    console.error('❌', errorMsg);
                    // Clean up
                    this.qrCodeListeners = [];
                    reject(new Error(errorMsg));
                }, 90000);

                // Add listener for QR code
                const listener = (qrCode: string) => {
                    clearTimeout(timeout);
                    console.log('✅ QR Code received successfully!');
                    // Remove this listener
                    const index = this.qrCodeListeners.indexOf(listener);
                    if (index > -1) {
                        this.qrCodeListeners.splice(index, 1);
                    }
                    resolve(qrCode);
                };
                
                this.qrCodeListeners.push(listener);

                // If QR already available, resolve immediately
                if (this.latestQRCode) {
                    clearTimeout(timeout);
                    console.log('✅ QR Code already available');
                    resolve(this.latestQRCode);
                }
            });
            
        } catch (error: any) {
            console.error('❌ Error generating QR code:', error);
            throw new Error(error.message || 'Failed to generate QR code. Please try again.');
        }
    }

    /**
     * Binding device dengan WhatsApp Web
     */
    static async bindDevice(deviceId: string, sessionData: any): Promise<boolean> {
        try {
            // Update session status
            const updateQuery = `
                UPDATE whatsapp_web_sessions 
                SET is_connected = TRUE, session_data = ?, last_activity = CURRENT_TIMESTAMP
                WHERE device_id = ?
            `;
            
            await databasePool.execute(updateQuery, [JSON.stringify(sessionData), deviceId]);
            
            // Log connection
            await this.logConnection(deviceId, 'bind', 'success', 'Device successfully bound');
            
            // Set current session
            this.currentSession = {
                id: 0,
                device_id: deviceId,
                session_data: sessionData,
                is_connected: true,
                last_activity: new Date(),
                created_at: new Date()
            };
            
            return true;
            
        } catch (error) {
            console.error('Error binding device:', error);
            await this.logConnection(deviceId, 'bind', 'failed', error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Cek status koneksi
     */
    static async getConnectionStatus(): Promise<{connected: boolean, ready: boolean, session?: WhatsAppWebSession}> {
        try {
            const connected = this.client ? true : false;
            const ready = this.isReady;
            
            if (ready && this.client) {
                const state = await this.client.getState();
                
                return {
                    connected: true,
                    ready: state === 'CONNECTED',
                    session: this.currentSession || undefined
                };
            }
            
            return { 
                connected, 
                ready: false 
            };
            
        } catch (error) {
            console.error('Error checking connection status:', error);
            return { 
                connected: false, 
                ready: false 
            };
        }
    }

    /**
     * Reconnect WhatsApp Web
     */
    static async reconnect(): Promise<boolean> {
        try {
            console.log('Reconnecting WhatsApp Web...');
            
            // Disconnect current session
            await this.disconnect();
            
            // Reinitialize client
            await this.initialize();
            
            return true;
            
        } catch (error) {
            console.error('Error reconnecting:', error);
            await this.logConnection('system', 'reconnect', 'failed', error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Disconnect WhatsApp Web
     */
    static async disconnect(): Promise<boolean> {
        try {
            console.log('Disconnecting WhatsApp Web...');
            
            if (this.client) {
                // Logout and destroy client
                await this.client.logout();
                await this.client.destroy();
                
                this.client = null;
                this.isReady = false;
                this.latestQRCode = null;
                this.qrCodeListeners = [];
                
                await this.logConnection('system', 'disconnect', 'success', 'Client disconnected and destroyed');
                
                console.log('✅ WhatsApp Web disconnected successfully');
            }
            
            return true;
            
        } catch (error) {
            console.error('Error disconnecting:', error);
            await this.logConnection('system', 'disconnect', 'failed', error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    /**
     * Kirim pesan via WhatsApp Web
     */
    static async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
        try {
            if (!this.client || !this.isReady) {
                throw new Error('WhatsApp Web client not ready. Please connect first.');
            }
            
            // Format phone number (remove + and ensure country code)
            let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            // Add @c.us suffix for WhatsApp ID
            if (!formattedNumber.includes('@')) {
                formattedNumber = `${formattedNumber}@c.us`;
            }
            
            // Send message using whatsapp-web.js
            await this.client.sendMessage(formattedNumber, message);
            
            console.log(`✅ Message sent to ${phoneNumber}: ${message}`);
            
            // Log message
            await this.logConnection('system', 'send_message', 'success', `Message sent to ${phoneNumber}`);
            
            return true;
            
        } catch (error) {
            console.error('Error sending message:', error);
            await this.logConnection('system', 'send_message', 'failed', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Terima pesan dari WhatsApp Web
     */
    static async receiveMessage(messageData: any): Promise<void> {
        try {
            const status = await this.getConnectionStatus();
            
            if (!status.connected) {
                console.log('WhatsApp Web not connected, ignoring message');
                return;
            }
            
            // Process incoming message
            console.log('Received WhatsApp Web message:', messageData);
            
            // Log message
            await this.logConnection(status.session?.device_id || 'unknown', 'receive_message', 'success', 'Message received');
            
        } catch (error) {
            console.error('Error processing received message:', error);
        }
    }

    /**
     * Simpan session ke database
     */
    private static async saveSession(deviceId: string, sessionData: any): Promise<void> {
        const query = `
            INSERT INTO whatsapp_web_sessions (device_id, session_data, is_connected, last_activity)
            VALUES (?, ?, FALSE, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
            session_data = VALUES(session_data),
            last_activity = VALUES(last_activity)
        `;
        
        await databasePool.execute(query, [deviceId, JSON.stringify(sessionData)]);
    }

    /**
     * Log koneksi
     */
    private static async logConnection(deviceId: string, action: string, status: string, message: string): Promise<void> {
        try {
        const query = `
            INSERT INTO whatsapp_connection_logs (session_id, action, status, message)
            VALUES (?, ?, ?, ?)
        `;
        
        await databasePool.execute(query, [deviceId, action, status, message]);
        } catch (error) {
            // Ignore log errors to not break main functionality
            console.error('Error logging connection (table may not exist):', error);
        }
    }

    /**
     * Get connection logs
     */
    static async getConnectionLogs(limit: number = 50): Promise<any[]> {
        try {
        const query = `
            SELECT * FROM whatsapp_connection_logs 
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        
        const [result] = await databasePool.execute(query, [limit]);
        return result as any[];
        } catch (error) {
            console.error('Error fetching connection logs:', error);
            // Return empty array instead of throwing error
            return [];
        }
    }
}
