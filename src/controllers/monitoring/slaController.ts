/**
 * SLA Controller - Service Level Agreement Management
 * Handles SLA dashboard, reports, and discount approvals
 */

import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import slaMonitoringService from '../../services/slaMonitoringService';
import bandwidthLogService from '../../services/bandwidthLogService';
import pingService from '../../services/pingService';

export class SLAController {
    
    /**
     * GET /monitoring/sla
     * SLA Dashboard - Overview of all customers' SLA performance
     */
    async dashboard(req: Request, res: Response): Promise<void> {
        try {
            const month = req.query.month as string || new Date().toISOString().slice(0, 7);
            const monthDate = new Date(month + '-01');
            
            // Get SLA summary for the month
            const [summary] = await pool.query<RowDataPacket[]>(`
                SELECT * FROM v_monthly_sla_summary
                WHERE month_year = ?
            `, [monthDate]);
            
            // Get customers with SLA breach
            const [breaches] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    sr.*,
                    c.name AS customer_name,
                    c.area,
                    c.connection_type as service_type
                FROM sla_records sr
                JOIN customers c ON sr.customer_id = c.id
                WHERE sr.month_year = ?
                    AND sr.sla_status IN ('breach', 'warning')
                ORDER BY sr.sla_percentage ASC
                LIMIT 50
            `, [monthDate]);
            
            // Get active incidents
            const [activeIncidents] = await pool.query<RowDataPacket[]>(`
                SELECT * FROM v_active_incidents
                ORDER BY duration_minutes DESC
                LIMIT 20
            `);
            
            // Get current connection status
            const [connectionStatus] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    current_status,
                    COUNT(*) AS count
                FROM v_current_connection_status
                GROUP BY current_status
            `);
            
            res.render('monitoring/sla/dashboard', {
                title: 'SLA Monitoring Dashboard',
                month,
                summary: summary[0] || {},
                breaches,
                activeIncidents,
                connectionStatus,
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in SLA dashboard:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Gagal memuat SLA dashboard',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * GET /monitoring/sla/customer/:customerId
     * Detailed SLA view for specific customer
     */
    async customerDetail(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;
        if (!customerId) {
            return res.status(400).json({ success: false, error: 'customerId is required' });
        }
        const parsedCustomerId = parseInt(customerId);
            const month = req.query.month as string || new Date().toISOString().slice(0, 7);
            const monthDate = new Date(month + '-01');
            
            // Get customer info
            const [customers] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    c.*,
                    c.connection_type as service_type,
                    CASE 
                        WHEN c.connection_type = 'pppoe' THEN c.pppoe_username
                        ELSE sic.ip_address
                    END AS username,
                    sic.ip_address,
                    CASE 
                        WHEN c.connection_type = 'pppoe' THEN pp.name
                        WHEN c.connection_type = 'static_ip' THEN sp.name
                    END AS package_name,
                    CASE 
                        WHEN c.connection_type = 'pppoe' THEN pp.sla_target
                        WHEN c.connection_type = 'static_ip' THEN sp.sla_target
                    END AS sla_target
                FROM customers c
                LEFT JOIN subscriptions sub ON c.id = sub.customer_id AND sub.status = 'active'
                LEFT JOIN pppoe_packages pp ON c.connection_type = 'pppoe' AND sub.package_id = pp.id
                LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
                LEFT JOIN static_ip_packages sp ON c.connection_type = 'static_ip' AND sic.package_id = sp.id
                WHERE c.id = ?
            `, [parsedCustomerId]);
            
            if (customers.length === 0) {
                res.status(404).json({ success: false, message: 'Customer not found' });
                return;
            }
            
            const customer = customers[0];
            
            // Get SLA record for the month
            const slaRecord = await slaMonitoringService.getCustomerSLASummary(parsedCustomerId, monthDate);
            
            // Get incidents history
            const [incidents] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    *,
                    DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS start_time_formatted,
                    DATE_FORMAT(end_time, '%Y-%m-%d %H:%i') AS end_time_formatted
                FROM sla_incidents
                WHERE customer_id = ?
                    AND start_time >= ?
                    AND start_time < DATE_ADD(?, INTERVAL 1 MONTH)
                ORDER BY start_time DESC
            `, [parsedCustomerId, monthDate, monthDate]);
            
            // Get bandwidth data (if PPPoE)
            let bandwidthData = null;
            if (!customer) {
                return res.status(404).json({ success: false, error: 'Customer not found' });
            }
            if (customer.service_type === 'pppoe') {
                bandwidthData = await bandwidthLogService.getCustomerBandwidth24h(parsedCustomerId);
            }
            
            // Get ping status (if Static IP)
            let pingStatus = null;
            if (customer.service_type === 'static_ip') {
                pingStatus = await pingService.getCustomerStatus(parsedCustomerId);
            }
            
            // Get monthly SLA history (last 6 months)
            const [slaHistory] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    DATE_FORMAT(month_year, '%Y-%m') AS month,
                    sla_percentage,
                    sla_target,
                    sla_status,
                    incident_count,
                    discount_amount,
                    discount_approved
                FROM sla_records
                WHERE customer_id = ?
                ORDER BY month_year DESC
                LIMIT 6
            `, [customerId]);
            
            res.render('monitoring/sla/customer-detail', {
                title: `SLA Detail - ${customer.name}`,
                customer,
                month,
                slaRecord,
                incidents,
                bandwidthData,
                pingStatus,
                slaHistory,
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in customer SLA detail:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Gagal memuat detail SLA customer',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * GET /monitoring/sla/incidents
     * List all SLA incidents
     */
    async incidents(req: Request, res: Response): Promise<void> {
        try {
            const status = req.query.status as string || 'ongoing';
            const area = req.query.area as string;
            const month = req.query.month as string || new Date().toISOString().slice(0, 7);
            const page = parseInt(req.query.page as string) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            
            let whereConditions = [`si.status = ?`];
            const params: any[] = [status];
            
            if (area) {
                whereConditions.push(`c.area = ?`);
                params.push(area);
            }
            
            const whereClause = whereConditions.join(' AND ');
            
            // Get incidents
            const [incidents] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    si.*,
                    c.name AS customer_name,
                    c.area,
                    c.odc_location,
                    c.connection_type as service_type,
                    CASE 
                        WHEN c.connection_type = 'pppoe' THEN c.pppoe_username
                        ELSE sic.ip_address
                    END AS username,
                    t.first_name AS technician_name,
                    DATE_FORMAT(si.start_time, '%Y-%m-%d %H:%i') AS start_time_formatted,
                    DATE_FORMAT(si.end_time, '%Y-%m-%d %H:%i') AS end_time_formatted
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
                LEFT JOIN telegram_users t ON si.technician_id = t.id
                WHERE ${whereClause}
                ORDER BY si.start_time DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);
            
            // Get total count
            const [countResult] = await pool.query<RowDataPacket[]>(`
                SELECT COUNT(*) AS total
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                WHERE ${whereClause}
            `, params);
            
            const total = countResult[0]?.total || 0;
            const totalPages = Math.ceil(total / limit);
            
            // Get areas for filter
            const [areas] = await pool.query<RowDataPacket[]>(`
                SELECT DISTINCT area FROM customers WHERE area IS NOT NULL ORDER BY area
            `);
            
            res.render('monitoring/sla/incidents', {
                title: 'SLA Incidents',
                incidents,
                status,
                area,
                month,
                areas,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                },
                user: req.user
            });
            
        } catch (error) {
            console.error('Error in SLA incidents:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Gagal memuat incidents',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /monitoring/sla/incident/:id/exclude
     * Exclude incident from SLA calculation (Admin only)
     */
    async excludeIncident(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            const { exclude_reason, exclude_notes } = req.body;
            
            // Validate exclude reason
            const validReasons = ['maintenance', 'force_majeure', 'customer_fault', 'transient', 'isolated'];
            if (!validReasons.includes(exclude_reason)) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Invalid exclude reason' 
                });
                return;
            }
            
            await pool.query(`
                UPDATE sla_incidents
                SET 
                    status = 'excluded',
                    exclude_reason = ?,
                    exclude_notes = ?,
                    is_counted_in_sla = 0
                WHERE id = ?
            `, [exclude_reason, exclude_notes, incidentId]);
            
            res.json({ 
                success: true, 
                message: 'Incident excluded from SLA calculation' 
            });
            
        } catch (error) {
            console.error('Error excluding incident:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to exclude incident',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /monitoring/sla/discount/:id/approve
     * Approve SLA discount (Admin only)
     */
    async approveDiscount(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id is required' });
        }
        const customerId = parseInt(id);
            const userId = (req.user as any)?.id;
            
            if (!userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            
            await slaMonitoringService.approveDiscount(slaRecordId, userId);
            
            res.json({ 
                success: true, 
                message: 'Discount approved successfully' 
            });
            
        } catch (error) {
            console.error('Error approving discount:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to approve discount',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * GET /api/monitoring/bandwidth/:customerId
     * Get bandwidth trend data for charts (API)
     */
    async getBandwidthTrend(req: Request, res: Response): Promise<void> {
        try {
            const { customerId } = req.params;
        if (!customerId) {
            return res.status(400).json({ success: false, error: 'customerId is required' });
        }
        const parsedCustomerId = parseInt(customerId);
            
            const trend = await bandwidthLogService.getBandwidthTrend24h(parsedCustomerId);
            
            res.json({ 
                success: true, 
                data: trend 
            });
            
        } catch (error) {
            console.error('Error getting bandwidth trend:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to get bandwidth trend',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * GET /api/monitoring/sla/stats
     * Get SLA statistics (API)
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const month = req.query.month as string || new Date().toISOString().slice(0, 7);
            const monthDate = new Date(month + '-01');
            
            const [stats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) AS total_customers,
                    SUM(CASE WHEN sla_status = 'met' THEN 1 ELSE 0 END) AS customers_met_sla,
                    SUM(CASE WHEN sla_status = 'breach' THEN 1 ELSE 0 END) AS customers_breach_sla,
                    SUM(CASE WHEN sla_status = 'warning' THEN 1 ELSE 0 END) AS customers_warning,
                    ROUND(AVG(sla_percentage), 2) AS avg_sla,
                    SUM(incident_count) AS total_incidents,
                    SUM(downtime_minutes) AS total_downtime_minutes,
                    SUM(discount_amount) AS total_discount_amount,
                    SUM(CASE WHEN discount_approved = 1 THEN discount_amount ELSE 0 END) AS approved_discount_amount,
                    SUM(CASE WHEN discount_approved = 0 AND discount_amount > 0 THEN 1 ELSE 0 END) AS pending_approvals
                FROM sla_records
                WHERE month_year = ?
            `, [monthDate]);
            
            res.json({ 
                success: true, 
                data: stats[0] 
            });
            
        } catch (error) {
            console.error('Error getting SLA stats:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to get stats',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * POST /api/monitoring/sla/calculate
     * Manually trigger SLA calculation (Admin only)
     */
    async triggerCalculation(req: Request, res: Response): Promise<void> {
        try {
            const month = req.body.month as string || new Date().toISOString().slice(0, 7);
            const monthDate = new Date(month + '-01');
            
            // Run calculation asynchronously
            slaMonitoringService.calculateMonthlySLA(monthDate).catch(err => {
                console.error('Error in async SLA calculation:', err);
            });
            
            res.json({ 
                success: true, 
                message: 'SLA calculation started. This may take a few minutes.' 
            });
            
        } catch (error) {
            console.error('Error triggering calculation:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to trigger calculation',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default SLAController;
