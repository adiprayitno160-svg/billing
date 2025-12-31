/**
 * Telegram Admin Controller
 * Handles HTTP requests for Telegram Bot management
 */

import { Request, Response } from 'express';
import TelegramAdminService from '../../services/telegram/TelegramAdminService';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class TelegramAdminController {

    /**
     * Dashboard - Display Telegram Bot dashboard
     */
    async dashboard(req: Request, res: Response): Promise<any> {
        try {
            // Get bot info
            const botInfo = TelegramAdminService.getBotInfo();

            // Get active users count by role
            const [users] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    role,
                    COUNT(*) as count
                FROM telegram_users
                WHERE is_active = 1
                GROUP BY role
            `);

            // Get today's statistics
            const [todayStats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    total_messages,
                    total_commands,
                    total_notifications,
                    successful_sends,
                    failed_sends
                FROM telegram_bot_statistics
                WHERE date = CURDATE()
            `);

            // Get recent chat logs
            const [recentChats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    tcl.id,
                    tcl.telegram_chat_id,
                    tcl.message_type,
                    tcl.message_content,
                    tcl.bot_response,
                    tcl.is_success,
                    tcl.created_at,
                    tu.first_name,
                    tu.role
                FROM telegram_chat_logs tcl
                LEFT JOIN telegram_users tu ON tcl.user_id = tu.id
                ORDER BY tcl.created_at DESC
                LIMIT 50
            `);

            // Get recent notifications
            const [recentNotifications] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    id,
                    notification_type,
                    priority,
                    title,
                    message,
                    target_role,
                    sent_count,
                    failed_count,
                    status,
                    created_at
                FROM telegram_notifications
                ORDER BY created_at DESC
                LIMIT 20
            `);

            const stats = todayStats.length > 0 ? todayStats[0] : {
                total_messages: 0,
                total_commands: 0,
                total_notifications: 0,
                successful_sends: 0,
                failed_sends: 0
            };

            const usersByRole = {
                admin: 0,
                teknisi: 0,
                kasir: 0,
                superadmin: 0
            };

            users.forEach((u: any) => {
                usersByRole[u.role as keyof typeof usersByRole] = u.count;
            });

            res.render('telegram/dashboard', {
                title: 'Telegram Bot Dashboard',
                botInfo,
                stats,
                usersByRole,
                recentChats,
                recentNotifications,
                user: (req.session as any).user
            });

        } catch (error) {
            console.error('Telegram dashboard error:', error);
            res.status(500).render('error', {
                error: 'Failed to load dashboard',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get bot statistics (API)
     */
    async getStatistics(req: Request, res: Response): Promise<any> {
        try {
            const { dateFrom, dateTo } = req.query;

            const from = dateFrom ? new Date(dateFrom as string) : new Date();
            const to = dateTo ? new Date(dateTo as string) : new Date();

            const stats = await TelegramAdminService.getBotStatistics(from, to);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Get statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get statistics'
            });
        }
    }

    /**
     * Users Page - Display users list with layout
     */
    async usersPage(req: Request, res: Response): Promise<any> {
        try {
            const { role, area } = req.query;

            let query = `
                SELECT 
                    id,
                    telegram_chat_id,
                    telegram_username,
                    first_name,
                    last_name,
                    phone_number,
                    role,
                    area_coverage,
                    notification_enabled,
                    registered_at,
                    last_active_at
                FROM telegram_users
                WHERE is_active = 1
            `;

            const params: any[] = [];

            if (role) {
                query += ` AND role = ?`;
                params.push(role);
            }

            if (area) {
                query += ` AND JSON_CONTAINS(area_coverage, ?)`;
                params.push(JSON.stringify(area));
            }

            query += ` ORDER BY last_active_at DESC`;

            const [users] = await pool.query<RowDataPacket[]>(query, params);

            // Parse JSON fields
            const formattedUsers = users.map((u: any) => ({
                ...u,
                area_coverage: JSON.parse(u.area_coverage || '[]')
            }));

            res.render('telegram/users', {
                title: 'Telegram Users',
                users: formattedUsers,
                role: role || '',
                area: area || '',
                user: (req.session as any).user
            });

        } catch (error) {
            console.error('Users page error:', error);
            res.status(500).render('error', {
                error: 'Failed to load users page',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get active users list (API)
     */
    async getUsers(req: Request, res: Response): Promise<any> {
        try {
            const { role, area, userId } = req.query;

            let query = `
                SELECT 
                    id,
                    telegram_chat_id,
                    telegram_username,
                    first_name,
                    last_name,
                    phone_number,
                    role,
                    area_coverage,
                    notification_enabled,
                    registered_at,
                    last_active_at
                FROM telegram_users
                WHERE is_active = 1
            `;

            const params: any[] = [];

            if (userId) {
                query += ` AND id = ?`;
                params.push(userId);
            }

            if (role) {
                query += ` AND role = ?`;
                params.push(role);
            }

            if (area) {
                query += ` AND JSON_CONTAINS(area_coverage, ?)`;
                params.push(JSON.stringify(area));
            }

            query += ` ORDER BY last_active_at DESC`;

            const [users] = await pool.query<RowDataPacket[]>(query, params);

            // Parse JSON fields
            const formattedUsers = users.map((u: any) => ({
                ...u,
                area_coverage: JSON.parse(u.area_coverage || '[]')
            }));

            res.json({
                success: true,
                data: formattedUsers
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get users'
            });
        }
    }

    /**
     * Create invite code
     */
    async createInviteCode(req: Request, res: Response): Promise<any> {
        try {
            const { role, areaCoverage, expiryDays } = req.body;

            if (!role || !['admin', 'teknisi', 'kasir', 'superadmin'].includes(role)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid role'
                });
                return;
            }

            const areas = areaCoverage || [];
            const expiry = expiryDays || 7;

            const inviteCode = await TelegramAdminService.createInviteCode(role, areas, expiry);

            res.json({
                success: true,
                data: {
                    inviteCode,
                    role,
                    areaCoverage: areas,
                    expiresIn: `${expiry} days`
                },
                message: `Invite code created successfully. Send this to user: /register ${inviteCode}`
            });

        } catch (error) {
            console.error('Create invite code error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create invite code'
            });
        }
    }

    /**
     * Send custom notification
     */
    async sendNotification(req: Request, res: Response): Promise<any> {
        try {
            const { type, priority, title, message, targetRole, targetArea, customerId } = req.body;

            if (!type || !priority || !title || !message) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
                return;
            }

            const result = await TelegramAdminService.sendNotification({
                type,
                priority,
                title,
                message,
                targetRole: targetRole || 'all',
                targetArea,
                customerId,
                metadata: {
                    sentBy: (req.session as any).user?.username,
                    sentAt: new Date()
                }
            });

            res.json({
                success: true,
                data: result,
                message: `Notification sent to ${result.sent} users`
            });

        } catch (error) {
            console.error('Send notification error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send notification'
            });
        }
    }

    /**
     * Get chat logs
     */
    async getChatLogs(req: Request, res: Response): Promise<any> {
        try {
            const { limit = 100, userId, messageType } = req.query;

            let query = `
                SELECT 
                    tcl.id,
                    tcl.user_id,
                    tcl.telegram_chat_id,
                    tcl.message_type,
                    tcl.message_content,
                    tcl.command_name,
                    tcl.bot_response,
                    tcl.is_success,
                    tcl.error_message,
                    tcl.created_at,
                    tu.first_name,
                    tu.last_name,
                    tu.role
                FROM telegram_chat_logs tcl
                LEFT JOIN telegram_users tu ON tcl.user_id = tu.id
                WHERE 1=1
            `;

            const params: any[] = [];

            if (userId) {
                query += ` AND tcl.user_id = ?`;
                params.push(userId);
            }

            if (messageType) {
                query += ` AND tcl.message_type = ?`;
                params.push(messageType);
            }

            query += ` ORDER BY tcl.created_at DESC LIMIT ?`;
            params.push(parseInt(limit as string));

            const [logs] = await pool.query<RowDataPacket[]>(query, params);

            res.json({
                success: true,
                data: logs
            });

        } catch (error) {
            console.error('Get chat logs error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get chat logs'
            });
        }
    }

    /**
     * Get notifications history
     */
    async getNotifications(req: Request, res: Response): Promise<any> {
        try {
            const { limit = 50, type, status } = req.query;

            let query = `
                SELECT 
                    tn.id,
                    tn.notification_type,
                    tn.priority,
                    tn.title,
                    tn.message,
                    tn.target_role,
                    tn.target_area,
                    tn.sent_count,
                    tn.failed_count,
                    tn.status,
                    tn.sent_at,
                    tn.created_at,
                    c.name as customer_name
                FROM telegram_notifications tn
                LEFT JOIN customers c ON tn.customer_id = c.id
                WHERE 1=1
            `;

            const params: any[] = [];

            if (type) {
                query += ` AND tn.notification_type = ?`;
                params.push(type);
            }

            if (status) {
                query += ` AND tn.status = ?`;
                params.push(status);
            }

            query += ` ORDER BY tn.created_at DESC LIMIT ?`;
            params.push(parseInt(limit as string));

            const [notifications] = await pool.query<RowDataPacket[]>(query, params);

            res.json({
                success: true,
                data: notifications
            });

        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get notifications'
            });
        }
    }

    /**
     * Get incident assignments
     */
    async getIncidentAssignments(req: Request, res: Response): Promise<any> {
        try {
            const { technicianId, status, limit = 50 } = req.query;

            let query = `
                SELECT 
                    tia.id,
                    tia.incident_id,
                    tia.status,
                    tia.assignment_type,
                    tia.assigned_at,
                    tia.acknowledged_at,
                    tia.started_at,
                    tia.completed_at,
                    tu.first_name as technician_name,
                    tu.telegram_username,
                    c.customer_id,
                    c.name as customer_name,
                    c.area,
                    si.start_time,
                    TIMESTAMPDIFF(MINUTE, si.start_time, COALESCE(si.end_time, NOW())) as duration_minutes
                FROM telegram_incident_assignments tia
                JOIN telegram_users tu ON tia.technician_user_id = tu.id
                JOIN sla_incidents si ON tia.incident_id = si.id
                JOIN customers c ON si.customer_id = c.id
                WHERE 1=1
            `;

            const params: any[] = [];

            if (technicianId) {
                query += ` AND tia.technician_user_id = ?`;
                params.push(technicianId);
            }

            if (status) {
                query += ` AND tia.status = ?`;
                params.push(status);
            }

            query += ` ORDER BY tia.assigned_at DESC LIMIT ?`;
            params.push(parseInt(limit as string));

            const [assignments] = await pool.query<RowDataPacket[]>(query, params);

            res.json({
                success: true,
                data: assignments
            });

        } catch (error) {
            console.error('Get incident assignments error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get incident assignments'
            });
        }
    }

    /**
     * Get technician performance
     */
    async getTechnicianPerformance(req: Request, res: Response): Promise<any> {
        try {
            const { period = '7' } = req.query;
            const days = parseInt(period as string);

            const [performance] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    tu.id,
                    tu.first_name,
                    tu.last_name,
                    tu.telegram_username,
                    tu.area_coverage,
                    COUNT(DISTINCT tia.id) as total_assignments,
                    COUNT(DISTINCT CASE WHEN tia.status = 'completed' THEN tia.id END) as completed_assignments,
                    COUNT(DISTINCT CASE WHEN tia.status = 'working' THEN tia.id END) as ongoing_assignments,
                    AVG(CASE 
                        WHEN tia.completed_at IS NOT NULL 
                        THEN TIMESTAMPDIFF(MINUTE, tia.assigned_at, tia.completed_at)
                    END) as avg_completion_minutes,
                    MIN(tia.assigned_at) as first_assignment,
                    MAX(tia.assigned_at) as last_assignment
                FROM telegram_users tu
                LEFT JOIN telegram_incident_assignments tia ON tu.id = tia.technician_user_id
                    AND tia.assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                WHERE tu.role = 'teknisi' AND tu.is_active = 1
                GROUP BY tu.id
                ORDER BY completed_assignments DESC
            `, [days]);

            // Parse JSON fields
            const formattedPerformance = performance.map((p: any) => ({
                ...p,
                area_coverage: JSON.parse(p.area_coverage || '[]'),
                avg_completion_minutes: p.avg_completion_minutes ? Math.round(p.avg_completion_minutes) : null
            }));

            res.json({
                success: true,
                data: formattedPerformance
            });

        } catch (error) {
            console.error('Get technician performance error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get technician performance'
            });
        }
    }

    /**
     * Update user settings
     */
    async updateUserSettings(req: Request, res: Response): Promise<any> {
        try {
            const { userId } = req.params;
            const { notificationEnabled, areaCoverage } = req.body;

            const updates: string[] = [];
            const params: any[] = [];

            if (notificationEnabled !== undefined) {
                updates.push('notification_enabled = ?');
                params.push(notificationEnabled ? 1 : 0);
            }

            if (areaCoverage !== undefined) {
                updates.push('area_coverage = ?');
                params.push(JSON.stringify(areaCoverage));
            }

            if (updates.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'No updates provided'
                });
                return;
            }

            params.push(userId);

            await pool.query(`
                UPDATE telegram_users
                SET ${updates.join(', ')}
                WHERE id = ?
            `, params);

            res.json({
                success: true,
                message: 'User settings updated successfully'
            });

        } catch (error) {
            console.error('Update user settings error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user settings'
            });
        }
    }

    /**
     * Deactivate user
     */
    async deactivateUser(req: Request, res: Response): Promise<any> {
        try {
            const { userId } = req.params;

            await pool.query(`
                UPDATE telegram_users
                SET is_active = 0
                WHERE id = ?
            `, [userId]);

            res.json({
                success: true,
                message: 'User deactivated successfully'
            });

        } catch (error) {
            console.error('Deactivate user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to deactivate user'
            });
        }
    }

    /**
     * Test send message to user
     */
    async testSendMessage(req: Request, res: Response): Promise<any> {
        try {
            const { chatId, message } = req.body;

            if (!chatId || !message) {
                res.status(400).json({
                    success: false,
                    message: 'Chat ID and message are required'
                });
                return;
            }

            await TelegramAdminService.sendNotification({
                type: 'custom',
                priority: 'low',
                title: 'Test Message',
                message: message,
                targetRole: 'all',
                metadata: {
                    test: true,
                    sentBy: (req.session as any).user?.username
                }
            });

            res.json({
                success: true,
                message: 'Test message sent successfully'
            });

        } catch (error) {
            console.error('Test send message error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send test message'
            });
        }
    }

    /**
     * Get bot info
     */
    async getBotInfo(req: Request, res: Response): Promise<any> {
        try {
            const botInfo = TelegramAdminService.getBotInfo();

            res.json({
                success: true,
                data: botInfo
            });

        } catch (error) {
            console.error('Get bot info error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get bot info'
            });
        }
    }
}

export default new TelegramAdminController();

