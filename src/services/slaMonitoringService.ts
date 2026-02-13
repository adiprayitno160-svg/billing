/**
 * SLA Monitoring Service - Service Level Agreement Monitoring
 * - Detect downtime incidents
 * - Calculate SLA percentage
 * - Apply discount rules
 * - Exclude maintenance/force majeure
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import IncidentAIService from './monitoring/incidentAIService';

interface SLAIncident {
    id: number;
    customer_id: number;
    service_type: 'pppoe' | 'static_ip';
    incident_type: 'downtime' | 'degraded' | 'maintenance';
    start_time: Date;
    end_time?: Date;
    duration_minutes: number;
    status: 'ongoing' | 'resolved' | 'excluded';
    exclude_reason?: string;
    is_counted_in_sla: boolean;
}

interface SLARecord {
    id: number;
    customer_id: number;
    month_year: Date;
    total_minutes: number;
    downtime_minutes: number;
    excluded_downtime_minutes: number;
    counted_downtime_minutes: number;
    sla_percentage: number;
    sla_target: number;
    sla_status: 'met' | 'breach' | 'warning';
    incident_count: number;
    discount_amount: number;
    discount_approved: boolean;
}

interface MaintenanceSchedule {
    id: number;
    start_time: Date;
    end_time: Date;
    affected_customers: number[];
}

export class SLAMonitoringService {
    private readonly DOWNTIME_THRESHOLD_MINUTES = 30;
    private readonly TRANSIENT_THRESHOLD_MINUTES = 30;

    /**
     * Detect and create new downtime incidents from connection logs
     * Called every 5 minutes by scheduler
     */
    async detectDowntimeIncidents(): Promise<void> {
        console.log('[SLAMonitoring] Detecting downtime incidents...');

        try {
            // Find customers that have been offline for more than threshold
            const query = `
                SELECT 
                    cl.customer_id,
                    cl.service_type,
                    MIN(cl.timestamp) AS start_time,
                    COUNT(*) AS consecutive_offline_checks
                FROM connection_logs cl
                WHERE cl.status = 'offline'
                    AND cl.timestamp >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                    AND NOT EXISTS (
                        -- No online status after this offline period
                        SELECT 1 FROM connection_logs cl2
                        WHERE cl2.customer_id = cl.customer_id
                            AND cl2.status = 'online'
                            AND cl2.timestamp > cl.timestamp
                            AND cl2.timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                    )
                    AND NOT EXISTS (
                        -- No existing ongoing incident
                        SELECT 1 FROM sla_incidents si
                        WHERE si.customer_id = cl.customer_id
                            AND si.status = 'ongoing'
                    )
                GROUP BY cl.customer_id, cl.service_type
                HAVING TIMESTAMPDIFF(MINUTE, MIN(cl.timestamp), NOW()) >= ?
            `;

            const [rows] = await pool.query<RowDataPacket[]>(query, [this.DOWNTIME_THRESHOLD_MINUTES]);

            console.log(`[SLAMonitoring] Found ${rows.length} new downtime incidents`);

            for (const row of rows) {
                const incidentId = await this.createIncident({
                    customer_id: row.customer_id,
                    service_type: row.service_type,
                    incident_type: 'downtime',
                    start_time: row.start_time,
                    status: 'ongoing'
                });

                console.log(`[SLAMonitoring] Created incident for customer ${row.customer_id}`);

                // AI Analysis - async, don't wait
                IncidentAIService.analyzeIncident(incidentId).catch(error => {
                    console.error('[SLAMonitoring] AI analysis error:', error);
                });
            }

        } catch (error) {
            console.error('[SLAMonitoring] Error detecting downtime:', error);
            throw error;
        }
    }

    /**
     * Create new SLA incident
     */
    async createIncident(incident: {
        customer_id: number;
        service_type: 'pppoe' | 'static_ip';
        incident_type: 'downtime' | 'degraded' | 'maintenance';
        start_time: Date;
        status: 'ongoing' | 'resolved' | 'excluded';
        exclude_reason?: string;
        exclude_notes?: string;
    }): Promise<number> {
        const query = `
            INSERT INTO sla_incidents (
                customer_id,
                service_type,
                incident_type,
                start_time,
                status,
                exclude_reason,
                exclude_notes,
                is_counted_in_sla
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const isCountedInSLA = !incident.exclude_reason;

        const [result] = await pool.query<ResultSetHeader>(query, [
            incident.customer_id,
            incident.service_type,
            incident.incident_type,
            incident.start_time,
            incident.status,
            incident.exclude_reason || null,
            incident.exclude_notes || null,
            isCountedInSLA
        ]);

        return result.insertId;
    }

    /**
     * Resolve ongoing incidents when customer comes back online
     */
    async resolveIncidents(): Promise<void> {
        console.log('[SLAMonitoring] Resolving incidents...');

        try {
            // Find ongoing incidents where customer is now online
            const query = `
                UPDATE sla_incidents si
                SET 
                    status = 'resolved',
                    end_time = (
                        SELECT MAX(cl.timestamp)
                        FROM connection_logs cl
                        WHERE cl.customer_id = si.customer_id
                            AND cl.status = 'offline'
                            AND cl.timestamp >= si.start_time
                    ),
                    resolved_at = NOW()
                WHERE si.status = 'ongoing'
                    AND EXISTS (
                        -- Customer is online in last 5 minutes
                        SELECT 1 FROM connection_logs cl
                        WHERE cl.customer_id = si.customer_id
                            AND cl.status = 'online'
                            AND cl.timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                            AND cl.timestamp > si.start_time
                    )
            `;

            const [result] = await pool.query<ResultSetHeader>(query);

            console.log(`[SLAMonitoring] Resolved ${result.affectedRows} incidents`);

        } catch (error) {
            console.error('[SLAMonitoring] Error resolving incidents:', error);
            throw error;
        }
    }

    /**
     * Auto-exclude transient disconnects (<30 minutes)
     */
    async excludeTransientIncidents(): Promise<void> {
        console.log('[SLAMonitoring] Excluding transient incidents...');

        try {
            const query = `
                UPDATE sla_incidents
                SET 
                    status = 'excluded',
                    exclude_reason = 'transient',
                    exclude_notes = 'Auto-excluded: Duration less than 30 minutes (transient disconnect/relogin)',
                    is_counted_in_sla = 0
                WHERE status = 'resolved'
                    AND duration_minutes < ?
                    AND exclude_reason IS NULL
            `;

            const [result] = await pool.query<ResultSetHeader>(query, [this.TRANSIENT_THRESHOLD_MINUTES]);

            console.log(`[SLAMonitoring] Excluded ${result.affectedRows} transient incidents`);

        } catch (error) {
            console.error('[SLAMonitoring] Error excluding transient incidents:', error);
            throw error;
        }
    }

    /**
     * Exclude incidents during planned maintenance
     */
    async excludeMaintenanceIncidents(): Promise<void> {
        console.log('[SLAMonitoring] Excluding maintenance incidents...');

        try {
            // Get active maintenance schedules
            const [schedules] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    id,
                    start_time,
                    end_time,
                    affected_customers
                FROM maintenance_schedules
                WHERE status IN ('scheduled', 'in_progress', 'completed')
                    AND start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);

            let totalExcluded = 0;

            for (const schedule of schedules) {
                const affectedCustomers = JSON.parse(schedule.affected_customers || '[]');

                if (affectedCustomers.length === 0) continue;

                const placeholders = affectedCustomers.map(() => '?').join(',');

                const query = `
                    UPDATE sla_incidents
                    SET 
                        status = 'excluded',
                        exclude_reason = 'maintenance',
                        exclude_notes = CONCAT('Planned maintenance: Schedule #', ?),
                        is_counted_in_sla = 0
                    WHERE customer_id IN (${placeholders})
                        AND start_time >= ?
                        AND start_time <= ?
                        AND status = 'resolved'
                        AND exclude_reason IS NULL
                `;

                const [result] = await pool.query<ResultSetHeader>(
                    query,
                    [schedule.id, ...affectedCustomers, schedule.start_time, schedule.end_time]
                );

                totalExcluded += result.affectedRows;
            }

            console.log(`[SLAMonitoring] Excluded ${totalExcluded} maintenance incidents`);

        } catch (error) {
            console.error('[SLAMonitoring] Error excluding maintenance incidents:', error);
            throw error;
        }
    }

    /**
     * Exclude incidents for isolated customers
     */
    async excludeIsolatedCustomerIncidents(): Promise<void> {
        console.log('[SLAMonitoring] Excluding isolated customer incidents...');

        try {
            // Exclude incidents for customers that were isolated (non-payment)
            const query = `
                UPDATE sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                SET 
                    si.status = 'excluded',
                    si.exclude_reason = 'isolated',
                    si.exclude_notes = 'Customer was isolated due to non-payment',
                    si.is_counted_in_sla = 0
                WHERE si.status = 'resolved'
                    AND si.exclude_reason IS NULL
                    AND c.is_isolated = 1
                    AND si.start_time >= c.isolated_at
            `;

            const [result] = await pool.query<ResultSetHeader>(query);

            console.log(`[SLAMonitoring] Excluded ${result.affectedRows} isolated customer incidents`);

        } catch (error) {
            console.error('[SLAMonitoring] Error excluding isolated incidents:', error);
            throw error;
        }
    }

    /**
     * Calculate monthly SLA for all customers
     * Called daily by scheduler
     */
    async calculateMonthlySLA(monthYear?: Date): Promise<void> {
        const targetMonth = monthYear || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthStr = targetMonth.toISOString().slice(0, 10);

        console.log(`[SLAMonitoring] Calculating SLA for ${monthStr}...`);

        try {
            // Get all active customers with their SLA targets
            const [customers] = await pool.query<RowDataPacket[]>(`
                SELECT DISTINCT 
                    c.id AS customer_id,
                    c.connection_type AS service_type,
                    COALESCE(
                        (SELECT pp.sla_target FROM pppoe_packages pp 
                         WHERE pp.id = c.pppoe_package_id AND c.connection_type = 'pppoe'),
                        (SELECT sip.sla_target FROM static_ip_packages sip 
                         WHERE sip.id = c.static_ip_package_id AND c.connection_type = 'static_ip'),
                        95.00
                    ) AS sla_target
                FROM customers c
                WHERE c.status = 'active'
            `);

            console.log(`[SLAMonitoring] Processing ${customers.length} customers`);

            // Calculate total minutes in month
            const nextMonth = new Date(targetMonth);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const totalMinutes = Math.floor((nextMonth.getTime() - targetMonth.getTime()) / 60000);

            for (const customer of customers) {
                await this.calculateCustomerMonthlySLA(
                    customer.customer_id,
                    targetMonth,
                    totalMinutes,
                    customer.sla_target
                );
            }

            console.log('[SLAMonitoring] Monthly SLA calculation completed');

        } catch (error) {
            console.error('[SLAMonitoring] Error calculating monthly SLA:', error);
            throw error;
        }
    }

    /**
     * Calculate SLA for single customer
     */
    async calculateCustomerMonthlySLA(
        customerId: number,
        monthYear: Date,
        totalMinutes: number,
        slaTarget: number
    ): Promise<void> {
        // Format period YYYY-MM
        const periodStr = monthYear.toISOString().slice(0, 7);

        // Get incidents for this customer in this month
        const [incidents] = await pool.query<RowDataPacket[]>(`
            SELECT 
                SUM(CASE WHEN is_counted_in_sla = 1 THEN duration_minutes ELSE 0 END) AS downtime_minutes,
                SUM(CASE WHEN is_counted_in_sla = 0 THEN duration_minutes ELSE 0 END) AS excluded_downtime,
                COUNT(*) AS incident_count
            FROM sla_incidents
            WHERE customer_id = ?
                AND start_time >= ?
                AND start_time < DATE_ADD(?, INTERVAL 1 MONTH)
                AND status IN ('resolved', 'excluded')
        `, [customerId, monthYear, monthYear]);

        const downtimeMinutes = incidents[0]?.downtime_minutes || 0;
        const excludedDowntime = incidents[0]?.excluded_downtime || 0;
        const incidentCount = incidents[0]?.incident_count || 0;

        // Calculate discount if SLA breached
        // Prevent division by zero
        const slaPercentage = totalMinutes > 0 ? ((totalMinutes - downtimeMinutes) / totalMinutes) * 100 : 100;
        let discountAmount = 0;

        if (slaPercentage < slaTarget) {
            discountAmount = await this.calculateDiscount(customerId, slaPercentage, slaTarget);
        }

        // Insert or update SLA record
        await pool.query(`
            INSERT INTO sla_records (
                customer_id,
                period,
                total_minutes,
                downtime_minutes,
                excluded_downtime_minutes,
                sla_target,
                incident_count,
                discount_amount,
                sla_percentage,
                calculated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                downtime_minutes = VALUES(downtime_minutes),
                excluded_downtime_minutes = VALUES(excluded_downtime_minutes),
                incident_count = VALUES(incident_count),
                discount_amount = VALUES(discount_amount),
                sla_percentage = VALUES(sla_percentage),
                calculated_at = NOW()
        `, [
            customerId,
            periodStr,
            totalMinutes,
            downtimeMinutes,
            excludedDowntime,
            slaTarget,
            incidentCount,
            discountAmount,
            slaPercentage
        ]);
    }

    /**
     * Calculate discount amount based on SLA breach
     */
    async calculateDiscount(customerId: number, actualSLA: number, targetSLA: number): Promise<number> {
        // Get customer's monthly invoice amount
        const [invoices] = await pool.query<RowDataPacket[]>(`
            SELECT amount 
            FROM invoices 
            WHERE customer_id = ? 
            ORDER BY invoice_date DESC 
            LIMIT 1
        `, [customerId]);

        if (invoices.length === 0) return 0;

        const invoiceAmount = parseFloat(invoices[0].amount);

        // Get discount rate from SLA settings
        const [settings] = await pool.query<RowDataPacket[]>(`
            SELECT 
                ss.discount_rate,
                ss.max_discount_percent
            FROM subscriptions s
            JOIN sla_settings ss ON ss.package_id = s.package_id AND ss.package_type = s.service_type
            WHERE s.customer_id = ?
            LIMIT 1
        `, [customerId]);

        const discountRate = settings.length > 0 ? parseFloat(settings[0].discount_rate) : 10.00;
        const maxDiscountPercent = settings.length > 0 ? parseFloat(settings[0].max_discount_percent) : 50.00;

        // Calculate: discount rate per 1% SLA breach
        const slaBreach = targetSLA - actualSLA;
        let discountPercent = slaBreach * discountRate;

        // Cap at maximum
        discountPercent = Math.min(discountPercent, maxDiscountPercent);

        const discountAmount = (invoiceAmount * discountPercent) / 100;

        return Math.round(discountAmount);
    }

    /**
     * Ensure SLA record exists for a customer and month
     * Calculates it if missing
     */
    async ensureSLARecord(customerId: number, monthYear: Date): Promise<SLARecord | null> {
        // Check if exists
        const existing = await this.getCustomerSLASummary(customerId, monthYear);
        if (existing) return existing;

        // Verify customer exists and gets target
        const [customerRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                c.id,
                c.connection_type,
                COALESCE(
                    (SELECT pp.sla_target FROM pppoe_packages pp WHERE pp.id = c.pppoe_package_id AND c.connection_type = 'pppoe'),
                    (SELECT sip.sla_target FROM static_ip_packages sip WHERE sip.id = c.static_ip_package_id AND c.connection_type = 'static_ip'),
                    95.00
                ) AS sla_target
            FROM customers c
            WHERE c.id = ?
        `, [customerId]);

        if (customerRows.length === 0) return null;

        const slaTarget = customerRows[0].sla_target;

        // Calculate total minutes
        const targetMonth = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1);
        const nextMonth = new Date(targetMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const totalMinutes = Math.floor((nextMonth.getTime() - targetMonth.getTime()) / 60000);

        // Calculate
        await this.calculateCustomerMonthlySLA(customerId, targetMonth, totalMinutes, slaTarget);

        // Return new record
        return await this.getCustomerSLASummary(customerId, targetMonth);
    }

    /**
     * Get SLA summary for customer
     */
    /**
     * Get SLA summary for customer
     */
    async getCustomerSLASummary(customerId: number, monthYear?: Date): Promise<SLARecord | null> {
        const targetMonth = monthYear || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const periodStr = targetMonth.toISOString().slice(0, 7);

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT * FROM sla_records
            WHERE customer_id = ?
                AND period = ?
        `, [customerId, periodStr]);

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            ...row,
            sla_percentage: parseFloat(row.uptime_percentage || row.sla_percentage || 100),
            month_year: targetMonth // Backwards compatibility for runtime objects
        } as unknown as SLARecord;
    }

    /**
     * Get active incidents for customer
     */
    async getCustomerActiveIncidents(customerId: number): Promise<SLAIncident[]> {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT * FROM sla_incidents
            WHERE customer_id = ?
                AND status = 'ongoing'
            ORDER BY start_time DESC
        `, [customerId]);

        return rows as SLAIncident[];
    }

    /**
     * Approve SLA discount (Admin action)
     */
    async approveDiscount(slaRecordId: number, approvedBy: number): Promise<void> {
        await pool.query(`
            UPDATE sla_records
            SET 
                discount_approved = 1,
                approved_by = ?,
                approved_at = NOW()
            WHERE id = ?
        `, [approvedBy, slaRecordId]);
    }

    /**
     * Main monitoring loop - called every 5 minutes
     */
    async runMonitoring(): Promise<void> {
        console.log('[SLAMonitoring] === Starting SLA monitoring cycle ===');

        try {
            // 1. Detect new incidents
            await this.detectDowntimeIncidents();

            // 2. Resolve incidents that are back online
            await this.resolveIncidents();

            // 3. Exclude transient incidents
            await this.excludeTransientIncidents();

            // 4. Exclude maintenance incidents
            await this.excludeMaintenanceIncidents();

            // 5. Exclude isolated customer incidents
            await this.excludeIsolatedCustomerIncidents();

            console.log('[SLAMonitoring] === Monitoring cycle completed ===');

        } catch (error) {
            console.error('[SLAMonitoring] Error in monitoring cycle:', error);
        }
    }
    /**
     * Get detailed SLA analysis for dashboard
     */
    async getSLAAnalysis(customerId: number): Promise<any> {
        try {
            // Get current month stats
            const currentMonth = new Date();
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

            const [currentStats] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as incident_count,
                    SUM(duration_minutes) as total_downtime,
                    MAX(end_time) as last_incident
                FROM sla_incidents
                WHERE customer_id = ?
                AND start_time >= ?
            `, [customerId, startOfMonth]);

            // Get historical reliability score (last 3 months)
            const [history] = await pool.query<RowDataPacket[]>(`
                SELECT AVG(sla_percentage) as reliability_score
                FROM sla_records
                WHERE customer_id = ?
                AND month_year >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
            `, [customerId]);

            return {
                current_month: {
                    incidents: currentStats[0]?.incident_count || 0,
                    downtime_minutes: currentStats[0]?.total_downtime || 0,
                    last_incident: currentStats[0]?.last_incident || null
                },
                reliability_score: history[0]?.reliability_score || 100,
                status: 'active' // You might want to derive this from real status
            };
        } catch (error) {
            console.error('[SLAMonitoring] Error getting SLA analysis:', error);
            throw error;
        }
    }
}

export default new SLAMonitoringService();
