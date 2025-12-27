/**
 * WhatsApp Troubleshooting Controller
 * Handle WhatsApp troubleshooting and diagnostics
 */

import { Request, Response } from 'express';
import { WhatsAppService } from '../../services/whatsapp/WhatsAppService';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsAppTroubleshootingController {
    
    /**
     * Show troubleshooting page
     */
    static async showTroubleshooting(req: Request, res: Response): Promise<void> {
        try {
            const status = WhatsAppService.getStatus();
            const stats = await WhatsAppService.getNotificationStats();
            
            // Get recent failed notifications
            const [failedNotifications] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM notification_logs 
                 WHERE channel = 'whatsapp' AND status = 'failed'
                 ORDER BY created_at DESC 
                 LIMIT 20`
            );
            
            // Get pending notifications
            const [pendingNotifications] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM unified_notifications_queue 
                 WHERE channel = 'whatsapp' AND status = 'pending'
                 ORDER BY created_at DESC 
                 LIMIT 20`
            );
            
            // Check session folder
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');
            const sessionExists = fs.existsSync(sessionPath);
            let sessionSize = 0;
            let sessionFiles: string[] = [];
            
            if (sessionExists) {
                try {
                    const files = fs.readdirSync(sessionPath);
                    sessionFiles = files;
                    sessionSize = files.reduce((total, file) => {
                        const filePath = path.join(sessionPath, file);
                        try {
                            const stats = fs.statSync(filePath);
                            return total + (stats.isFile() ? stats.size : 0);
                        } catch {
                            return total;
                        }
                    }, 0);
                } catch (err) {
                    console.error('Error reading session folder:', err);
                }
            }
            
            // Get system info
            const systemInfo = {
                nodeVersion: process.version,
                platform: process.platform,
                uptime: Math.floor(process.uptime() / 60), // minutes
                memoryUsage: process.memoryUsage(),
                sessionExists,
                sessionSize: (sessionSize / 1024 / 1024).toFixed(2) + ' MB',
                sessionFilesCount: sessionFiles.length
            };
            
            res.render('whatsapp/troubleshooting', {
                title: 'Troubleshooting WhatsApp',
                currentPath: '/whatsapp/troubleshooting',
                status,
                stats,
                failedNotifications: failedNotifications || [],
                pendingNotifications: pendingNotifications || [],
                systemInfo,
                user: (req.session as any).user
            });
            
        } catch (error) {
            console.error('Error loading troubleshooting page:', error);
            res.status(500).render('error', {
                error: 'Failed to load troubleshooting page',
                user: (req.session as any).user
            });
        }
    }
    
    /**
     * Get diagnostic information
     */
    static async getDiagnostics(req: Request, res: Response): Promise<void> {
        try {
            const status = WhatsAppService.getStatus();
            const stats = await WhatsAppService.getNotificationStats();
            
            // Check session folder
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');
            const sessionExists = fs.existsSync(sessionPath);
            
            // Get recent errors
            const [recentErrors] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM notification_logs 
                 WHERE channel = 'whatsapp' AND status = 'failed'
                 ORDER BY created_at DESC 
                 LIMIT 10`
            );
            
            // Get queue status
            const [queueStats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    status,
                    COUNT(*) as count
                 FROM unified_notifications_queue
                 WHERE channel = 'whatsapp'
                 GROUP BY status`
            );
            
            res.json({
                success: true,
                data: {
                    status,
                    stats,
                    sessionExists,
                    recentErrors: recentErrors || [],
                    queueStats: queueStats || [],
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to get diagnostics'
            });
        }
    }
    
    /**
     * Clear failed notifications
     */
    static async clearFailedNotifications(req: Request, res: Response): Promise<void> {
        try {
            await databasePool.query(
                `UPDATE notification_logs 
                 SET status = 'cancelled' 
                 WHERE channel = 'whatsapp' AND status = 'failed'`
            );
            
            res.json({
                success: true,
                message: 'Failed notifications cleared'
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to clear notifications'
            });
        }
    }
    
    /**
     * Retry failed notifications
     */
    static async retryFailedNotifications(req: Request, res: Response): Promise<void> {
        try {
            const { limit = 10 } = req.body;
            
            // Get failed notifications
            const [failed] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM unified_notifications_queue 
                 WHERE channel = 'whatsapp' AND status = 'failed'
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [limit]
            );
            
            let retried = 0;
            let errors = 0;
            
            for (const notif of failed) {
                try {
                    // Reset to pending
                    await databasePool.query(
                        `UPDATE unified_notifications_queue 
                         SET status = 'pending', retry_count = 0, error_message = NULL
                         WHERE id = ?`,
                        [notif.id]
                    );
                    retried++;
                } catch (err) {
                    errors++;
                    console.error(`Error retrying notification ${notif.id}:`, err);
                }
            }
            
            res.json({
                success: true,
                message: `Retried ${retried} notifications`,
                data: {
                    retried,
                    errors
                }
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to retry notifications'
            });
        }
    }
    
    /**
     * Test WhatsApp connection
     */
    static async testConnection(req: Request, res: Response): Promise<void> {
        try {
            const status = WhatsAppService.getStatus();
            
            if (!status.ready) {
                res.json({
                    success: false,
                    error: 'WhatsApp tidak terhubung. Silakan scan QR code terlebih dahulu.'
                });
                return;
            }
            
            // Try to get client info
            const diagnostics = {
                ready: status.ready,
                initialized: status.initialized,
                authenticated: status.authenticated,
                hasQRCode: status.hasQRCode,
                timestamp: new Date().toISOString()
            };
            
            res.json({
                success: true,
                message: 'Koneksi WhatsApp aktif',
                data: diagnostics
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to test connection'
            });
        }
    }
    
    /**
     * Get notification logs with filters
     */
    static async getNotificationLogs(req: Request, res: Response): Promise<void> {
        try {
            const { 
                limit = 50, 
                status, 
                customerId,
                startDate,
                endDate
            } = req.query;
            
            let query = `
                SELECT 
                    nl.*,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM notification_logs nl
                LEFT JOIN customers c ON nl.customer_id = c.id
                WHERE nl.channel = 'whatsapp'
            `;
            
            const params: any[] = [];
            
            if (status) {
                query += ' AND nl.status = ?';
                params.push(status);
            }
            
            if (customerId) {
                query += ' AND nl.customer_id = ?';
                params.push(parseInt(customerId as string));
            }
            
            if (startDate) {
                query += ' AND nl.created_at >= ?';
                params.push(startDate);
            }
            
            if (endDate) {
                query += ' AND nl.created_at <= ?';
                params.push(endDate);
            }
            
            query += ' ORDER BY nl.created_at DESC LIMIT ?';
            params.push(parseInt(limit as string));
            
            const [logs] = await databasePool.query<RowDataPacket[]>(query, params);
            
            res.json({
                success: true,
                data: logs
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to get notification logs'
            });
        }
    }
    
    /**
     * Delete old notification logs
     */
    static async cleanupLogs(req: Request, res: Response): Promise<void> {
        try {
            const { days = 30 } = req.body;
            
            const [result] = await databasePool.query(
                `DELETE FROM notification_logs 
                 WHERE channel = 'whatsapp' 
                   AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND status IN ('sent', 'failed', 'cancelled')`,
                [days]
            );
            
            const deleted = (result as any).affectedRows || 0;
            
            res.json({
                success: true,
                message: `Deleted ${deleted} old notification logs`,
                data: { deleted }
            });
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to cleanup logs'
            });
        }
    }
}






