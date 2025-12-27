/**
 * Telegram User Management Controller
 * Manage internal staff registration via Telegram bot
 */

import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import telegramBotService from '../../services/telegramBotService';

export class TelegramUserController {

    /**
     * GET /monitoring/telegram/users
     * List all Telegram users
     */
    async listUsers(req: Request, res: Response): Promise<void> {
        try {
            const [users] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    tu.*,
                    u.username as system_username,
                    (SELECT COUNT(*) FROM sla_incidents WHERE technician_id = tu.id AND status = 'ongoing') as active_incidents,
                    TIMESTAMPDIFF(DAY, tu.last_active_at, NOW()) as days_since_active
                FROM telegram_users tu
                LEFT JOIN users u ON tu.user_id = u.id
                ORDER BY tu.is_active DESC, tu.registered_at DESC
            `);

            // Get Telegram bot info
            const botInfo = telegramBotService.getBotInfo();

            res.render('monitoring/telegram/users', {
                title: 'Telegram Users Management',
                users,
                botInfo,
                user: req.user
            });

        } catch (error) {
            console.error('Error in listUsers:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat Telegram users',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /monitoring/telegram/create-invite
     * Show create invite form
     */
    async showCreateInvite(req: Request, res: Response): Promise<void> {
        try {
            // Get areas from customers
            const [areas] = await pool.query<RowDataPacket[]>(`
                SELECT DISTINCT area 
                FROM customers 
                WHERE area IS NOT NULL AND area != ''
                ORDER BY area
            `);

            res.render('monitoring/telegram/create-invite', {
                title: 'Create Invite Code',
                areas,
                user: req.user
            });

        } catch (error) {
            console.error('Error in showCreateInvite:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memuat form',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/monitoring/telegram/create-invite
     * Create new invite code
     */
    async createInvite(req: Request, res: Response): Promise<void> {
        try {
            const { role, areas } = req.body;
            const userId = (req.user as any)?.id;

            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }

            // Validate role
            if (!['admin', 'teknisi', 'kasir'].includes(role)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid role. Must be: admin, teknisi, or kasir'
                });
                return;
            }

            // Parse areas
            const areaCoverage = Array.isArray(areas) ? areas : (areas ? [areas] : []);

            // Create invite code
            const inviteCode = await telegramBotService.createInviteCode(
                role,
                areaCoverage,
                userId
            );

            res.json({
                success: true,
                message: 'Invite code created successfully',
                inviteCode,
                expiresIn: '7 days'
            });

        } catch (error) {
            console.error('Error creating invite:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create invite code',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/monitoring/telegram/users/:id/deactivate
     * Deactivate user
     */
    async deactivateUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const userId = parseInt(id);

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
            console.error('Error deactivating user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to deactivate user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/monitoring/telegram/users/:id/activate
     * Activate user
     */
    async activateUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const userId = parseInt(id);

            await pool.query(`
                UPDATE telegram_users
                SET is_active = 1
                WHERE id = ?
            `, [userId]);

            res.json({
                success: true,
                message: 'User activated successfully'
            });

        } catch (error) {
            console.error('Error activating user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to activate user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * DELETE /api/monitoring/telegram/users/:id
     * Delete user
     */
    async deleteUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'id is required' });
            }
            const userId = parseInt(id);

            await pool.query(`
                DELETE FROM telegram_users
                WHERE id = ?
            `, [userId]);

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/monitoring/telegram/bot-info
     * Get bot information
     */
    async getBotInfo(req: Request, res: Response): Promise<void> {
        try {
            const botInfo = telegramBotService.getBotInfo();

            // Get statistics
            const [stats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as total_users,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
                    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
                    SUM(CASE WHEN role = 'teknisi' THEN 1 ELSE 0 END) as teknisi_count,
                    SUM(CASE WHEN role = 'kasir' THEN 1 ELSE 0 END) as kasir_count
                FROM telegram_users
            `);

            res.json({
                success: true,
                data: {
                    ...botInfo,
                    statistics: stats[0]
                }
            });

        } catch (error) {
            console.error('Error getting bot info:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get bot info',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default TelegramUserController;

