import { Request, Response } from 'express';
import { WhatsAppWebService } from '../../services/whatsapp/WhatsAppWebService';

export class WhatsAppWebController {
    /**
     * Generate QR Code untuk binding
     */
    static async getQRCode(req: Request, res: Response) {
        try {
            const qrCodeDataURL = await WhatsAppWebService.generateQRCode();
            
            res.json({
                success: true,
                qrCode: qrCodeDataURL,
                message: 'QR Code generated successfully'
            });
            
        } catch (error: any) {
            console.error('Error generating QR code:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate QR code'
            });
        }
    }

    /**
     * Binding device dengan WhatsApp Web
     */
    static async bindDevice(req: Request, res: Response) {
        try {
            const { deviceId, sessionData } = req.body;
            
            if (!deviceId || !sessionData) {
                return res.status(400).json({
                    success: false,
                    error: 'Device ID and session data are required'
                });
            }
            
            const success = await WhatsAppWebService.bindDevice(deviceId, sessionData);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Device bound successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to bind device'
                });
            }
            
        } catch (error) {
            console.error('Error binding device:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to bind device'
            });
        }
    }

    /**
     * Cek status koneksi
     */
    static async getConnectionStatus(req: Request, res: Response) {
        try {
            const status = await WhatsAppWebService.getConnectionStatus();
            
            res.json({
                success: true,
                connected: status.connected,
                ready: status.ready,
                session: status.session
            });
            
        } catch (error) {
            console.error('Error checking connection status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check connection status'
            });
        }
    }

    /**
     * Reconnect WhatsApp Web
     */
    static async reconnect(req: Request, res: Response) {
        try {
            const success = await WhatsAppWebService.reconnect();
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Reconnection initiated'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to reconnect'
                });
            }
            
        } catch (error) {
            console.error('Error reconnecting:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reconnect'
            });
        }
    }

    /**
     * Disconnect WhatsApp Web
     */
    static async disconnect(req: Request, res: Response) {
        try {
            const success = await WhatsAppWebService.disconnect();
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Disconnected successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to disconnect'
                });
            }
            
        } catch (error) {
            console.error('Error disconnecting:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to disconnect'
            });
        }
    }

    /**
     * Kirim pesan
     */
    static async sendMessage(req: Request, res: Response) {
        try {
            const { phoneNumber, message } = req.body;
            
            if (!phoneNumber || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number and message are required'
                });
            }
            
            const success = await WhatsAppWebService.sendMessage(phoneNumber, message);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Message sent successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send message'
                });
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send message'
            });
        }
    }

    /**
     * Terima pesan
     */
    static async receiveMessage(req: Request, res: Response) {
        try {
            const messageData = req.body;
            
            await WhatsAppWebService.receiveMessage(messageData);
            
            res.json({
                success: true,
                message: 'Message received successfully'
            });
            
        } catch (error) {
            console.error('Error receiving message:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to receive message'
            });
        }
    }

    /**
     * Get connection logs
     */
    static async getConnectionLogs(req: Request, res: Response) {
        try {
            const { limit = 50 } = req.query;
            const logs = await WhatsAppWebService.getConnectionLogs(parseInt(limit as string));
            
            res.json({
                success: true,
                logs
            });
            
        } catch (error) {
            console.error('Error getting connection logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get connection logs'
            });
        }
    }
}
