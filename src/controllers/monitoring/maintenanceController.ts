/**
 * Maintenance Schedule Controller
 * Manage planned maintenance schedules
 */

import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import alertRoutingService from '../../services/alertRoutingService';

export class MaintenanceController {
    
    /**
     * GET /monitoring/maintenance
     * List all maintenance schedules
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const status = req.query.status as string || 'all';
            
            let whereClause = '1=1';
            const params: any[] = [];
            
            if (status !== 'all') {
                whereClause += ' AND status = ?';
                params.push(status);
            }
            
            const [schedules] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    ms.*,
                    u.username as created_by_name,
                    TIMESTAMPDIFF(HOUR, NOW(), start_time) as hours_until_start,
                    JSON_LENGTH(affected_customers) as customer_count
                FROM maintenance_schedules ms
                LEFT JOIN users u ON ms.created_by = u.id
                WHERE ${whereClause}
                ORDER BY ms.start_time DESC
                LIMIT 50
            `, params);
            
            // Parse affected_customers JSON
            schedules.forEach((schedule: any) => {
                schedule.affected_customers_array = JSON.parse(schedule.affected_customers || '[]');
            });
            
            res.render('monitoring/maintenance/list', {
                title: 'Maintenance Schedules',
                schedules,
                status,
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in list maintenance:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat maintenance schedules: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    }
    
    /**
     * GET /monitoring/maintenance/create
     * Show create form
     */
    async showCreate(req: Request, res: Response): Promise<void> {
        try {
            // Get areas
            const [areas] = await databasePool.query<RowDataPacket[]>(`
                SELECT DISTINCT area, COUNT(*) as customer_count
                FROM customers 
                WHERE area IS NOT NULL AND area != ''
                GROUP BY area
                ORDER BY area
            `);
            
            // Get all customers
            const [customers] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    id, 
                    name, 
                    area,
                    connection_type as service_type
                FROM customers
                WHERE status = 'active'
                ORDER BY area, name
            `);
            
            res.render('monitoring/maintenance/create', {
                title: 'Create Maintenance Schedule',
                areas,
                customers,
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in showCreate:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat form: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    }
    
    /**
     * POST /api/monitoring/maintenance
     * Create new maintenance schedule
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const {
                title,
                description,
                maintenance_type,
                affected_area,
                affected_customers,
                start_time,
                end_time
            } = req.body;
            
            const userId = (req.user as any)?.id;
            
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            
            // Validate
            if (!title || !start_time || !end_time) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Title, start time, and end time are required' 
                });
                return;
            }
            
            // Parse affected customers
            const customerIds = Array.isArray(affected_customers) 
                ? affected_customers.map((id: any) => parseInt(id))
                : (affected_customers ? [parseInt(affected_customers)] : []);
            
            // Calculate duration
            const startDate = new Date(start_time);
            const endDate = new Date(end_time);
            const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 60000); // minutes
            
            // Insert schedule
            const [result] = await databasePool.query<ResultSetHeader>(`
                INSERT INTO maintenance_schedules (
                    title,
                    description,
                    maintenance_type,
                    affected_area,
                    affected_customers,
                    start_time,
                    end_time,
                    estimated_duration_minutes,
                    status,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
            `, [
                title,
                description,
                maintenance_type,
                affected_area,
                JSON.stringify(customerIds),
                start_time,
                end_time,
                duration,
                userId
            ]);
            
            const scheduleId = result.insertId;
            
            // Send notifications if start time is within 48 hours
            const hoursUntilStart = (startDate.getTime() - Date.now()) / (1000 * 60 * 60);
            
            if (hoursUntilStart > 0 && hoursUntilStart <= 48) {
                // Send WhatsApp notifications to affected customers
                await alertRoutingService.sendMaintenanceNotification({
                    title,
                    description: description || '',
                    start_time: startDate,
                    end_time: endDate,
                    affected_customers: customerIds
                });
                
                // Mark as sent
                await databasePool.query(`
                    UPDATE maintenance_schedules
                    SET notification_sent = 1, notification_sent_at = NOW()
                    WHERE id = ?
                `, [scheduleId]);
            }
            
            res.json({ 
                success: true, 
                message: 'Maintenance schedule created successfully',
                id: scheduleId
            });
            
        } catch (error) {
            console.error('Error creating maintenance:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create maintenance schedule',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * GET /monitoring/maintenance/:id
     * View maintenance detail
     */
    async detail(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            
            const [schedules] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    ms.*,
                    u.username as created_by_name
                FROM maintenance_schedules ms
                LEFT JOIN users u ON ms.created_by = u.id
                WHERE ms.id = ?
            `, [id]);
            
            if (schedules.length === 0) {
                res.status(404).json({ success: false, message: 'Maintenance not found' });
                return;
            }
            
            const schedule = schedules[0];
            if (!schedule) {
                res.status(404).json({ success: false, message: 'Maintenance not found' });
                return;
            }
            
            schedule.affected_customers_array = JSON.parse(schedule.affected_customers || '[]');
            
            // Get affected customer details
            if (schedule.affected_customers_array.length > 0) {
                const placeholders = schedule.affected_customers_array.map(() => '?').join(',');
                
                const [customers] = await databasePool.query<RowDataPacket[]>(`
                    SELECT id, name, area, phone
                    FROM customers
                    WHERE id IN (${placeholders})
                `, schedule.affected_customers_array);
                
                schedule.customers = customers;
            } else {
                schedule.customers = [];
            }
            
            // Get incidents during this maintenance
            const [incidents] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    si.*,
                    c.name as customer_name
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.start_time >= ?
                    AND si.start_time <= ?
                    AND si.customer_id IN (${schedule.affected_customers_array.map(() => '?').join(',')})
            `, [schedule.start_time, schedule.end_time, ...schedule.affected_customers_array]);
            
            schedule.incidents = incidents;
            
            res.render('monitoring/maintenance/detail', {
                title: `Maintenance: ${schedule.title}`,
                schedule,
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in detail:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Gagal memuat detail',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /api/monitoring/maintenance/:id/start
     * Start maintenance
     */
    async start(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            
            await databasePool.query(`
                UPDATE maintenance_schedules
                SET status = 'in_progress'
                WHERE id = ?
            `, [id]);
            
            res.json({ 
                success: true, 
                message: 'Maintenance started' 
            });
            
        } catch (error) {
            console.error('Error starting maintenance:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to start maintenance',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /api/monitoring/maintenance/:id/complete
     * Complete maintenance
     */
    async complete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            
            await databasePool.query(`
                UPDATE maintenance_schedules
                SET status = 'completed'
                WHERE id = ?
            `, [id]);
            
            res.json({ 
                success: true, 
                message: 'Maintenance completed' 
            });
            
        } catch (error) {
            console.error('Error completing maintenance:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to complete maintenance',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /api/monitoring/maintenance/:id/cancel
     * Cancel maintenance
     */
    async cancel(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            
            await databasePool.query(`
                UPDATE maintenance_schedules
                SET status = 'cancelled'
                WHERE id = ?
            `, [id]);
            
            res.json({ 
                success: true, 
                message: 'Maintenance cancelled' 
            });
            
        } catch (error) {
            console.error('Error cancelling maintenance:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to cancel maintenance',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /api/monitoring/maintenance/:id/send-notification
     * Send notification manually
     */
    async sendNotification(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            
            const [schedules] = await databasePool.query<RowDataPacket[]>(`
                SELECT * FROM maintenance_schedules WHERE id = ?
            `, [id]);
            
            if (schedules.length === 0) {
                res.status(404).json({ success: false, message: 'Maintenance not found' });
                return;
            }
            
            const schedule = schedules[0];
            if (!schedule) {
                res.status(404).json({ success: false, message: 'Maintenance not found' });
                return;
            }
            const customerIds = JSON.parse(schedule.affected_customers || '[]');
            
            await alertRoutingService.sendMaintenanceNotification({
                title: schedule.title,
                description: schedule.description || '',
                start_time: new Date(schedule.start_time),
                end_time: new Date(schedule.end_time),
                affected_customers: customerIds
            });
            
            await databasePool.query(`
                UPDATE maintenance_schedules
                SET notification_sent = 1, notification_sent_at = NOW()
                WHERE id = ?
            `, [id]);
            
            res.json({ 
                success: true, 
                message: 'Notifications sent to ' + customerIds.length + ' customers' 
            });
            
        } catch (error) {
            console.error('Error sending notification:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send notifications',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default MaintenanceController;

