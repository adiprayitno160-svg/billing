/**
 * Monitoring Analytics Service
 * - Total bandwidth aggregation (PPPoE + Static IP)
 * - Network health statistics
 * - Top customers & areas analysis
 * - Bandwidth usage trends
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

interface BandwidthStats {
    total_bytes: number;
    total_gb: number;
    total_tb: number;
    bytes_in: number;
    bytes_out: number;
    customer_count: number;
    avg_bandwidth_per_customer: number;
}

interface DailyBandwidth {
    date: string;
    total_bytes: number;
    total_gb: number;
    bytes_in: number;
    bytes_out: number;
    customer_count: number;
}

interface TopCustomer {
    customer_id: number;
    customer_name: string;
    username?: string;
    ip_address?: string;
    service_type: 'pppoe' | 'static_ip';
    total_bytes: number;
    total_gb: number;
    bytes_in: number;
    bytes_out: number;
}

interface NetworkHealth {
    total_customers: number;
    online_customers: number;
    offline_customers: number;
    degraded_customers: number;
    uptime_percentage: number;
    avg_latency_ms: number;
    avg_packet_loss: number;
}

export class MonitoringAnalyticsService {
    
    /**
     * Get total bandwidth statistics for today
     */
    static async getTodayBandwidthStats(): Promise<BandwidthStats> {
        try {
            const query = `
                SELECT 
                    COALESCE(SUM(bytes_in + bytes_out), 0) as total_bytes,
                    COALESCE(SUM(bytes_in), 0) as bytes_in,
                    COALESCE(SUM(bytes_out), 0) as bytes_out,
                    COUNT(DISTINCT customer_id) as customer_count
                FROM bandwidth_logs
                WHERE DATE(timestamp) = CURDATE()
            `;
            
            const [rows] = await databasePool.query<RowDataPacket[]>(query);
            const stats = rows[0];
            
            return {
                total_bytes: stats.total_bytes || 0,
                total_gb: (stats.total_bytes || 0) / (1024 * 1024 * 1024),
                total_tb: (stats.total_bytes || 0) / (1024 * 1024 * 1024 * 1024),
                bytes_in: stats.bytes_in || 0,
                bytes_out: stats.bytes_out || 0,
                customer_count: stats.customer_count || 0,
                avg_bandwidth_per_customer: stats.customer_count > 0 
                    ? (stats.total_bytes || 0) / stats.customer_count 
                    : 0
            };
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting today bandwidth stats:', error);
            return this.getEmptyBandwidthStats();
        }
    }
    
    /**
     * Get total bandwidth for last N days
     */
    static async getBandwidthTrend(days: number = 30): Promise<DailyBandwidth[]> {
        try {
            const query = `
                SELECT 
                    DATE(timestamp) as date,
                    SUM(bytes_in + bytes_out) as total_bytes,
                    SUM(bytes_in) as bytes_in,
                    SUM(bytes_out) as bytes_out,
                    COUNT(DISTINCT customer_id) as customer_count
                FROM bandwidth_logs
                WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(timestamp)
                ORDER BY date DESC
            `;
            
            const [rows] = await databasePool.query<RowDataPacket[]>(query, [days]);
            
            return rows.map(row => ({
                date: row.date,
                total_bytes: row.total_bytes || 0,
                total_gb: (row.total_bytes || 0) / (1024 * 1024 * 1024),
                bytes_in: row.bytes_in || 0,
                bytes_out: row.bytes_out || 0,
                customer_count: row.customer_count || 0
            }));
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting bandwidth trend:', error);
            return [];
        }
    }
    
    /**
     * Get top N customers by bandwidth usage
     */
    static async getTopCustomersByBandwidth(limit: number = 10, days: number = 7): Promise<TopCustomer[]> {
        try {
            const query = `
                SELECT 
                    bl.customer_id,
                    c.name as customer_name,
                    s.username,
                    c.connection_type as service_type,
                    SUM(bl.bytes_in + bl.bytes_out) as total_bytes,
                    SUM(bl.bytes_in) as bytes_in,
                    SUM(bl.bytes_out) as bytes_out
                FROM bandwidth_logs bl
                JOIN customers c ON bl.customer_id = c.id
                LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                WHERE bl.timestamp >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                    AND c.connection_type = 'pppoe'
                GROUP BY bl.customer_id, c.name, s.username, c.connection_type
                ORDER BY total_bytes DESC
                LIMIT ?
            `;
            
            const [rows] = await databasePool.query<RowDataPacket[]>(query, [days, limit]);
            
            return rows.map(row => ({
                customer_id: row.customer_id,
                customer_name: row.customer_name,
                username: row.username,
                service_type: row.service_type,
                total_bytes: row.total_bytes || 0,
                total_gb: (row.total_bytes || 0) / (1024 * 1024 * 1024),
                bytes_in: row.bytes_in || 0,
                bytes_out: row.bytes_out || 0
            }));
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting top customers:', error);
            return [];
        }
    }
    
    /**
     * Get network health overview
     */
    static async getNetworkHealth(): Promise<NetworkHealth> {
        try {
            // Get total and online customers
            const [customerStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as total_customers,
                    SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active_customers
                FROM customers c
                WHERE c.connection_type IN ('pppoe', 'static_ip')
            `);
            
            // Get online status from recent logs
            const [onlineStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(DISTINCT customer_id) as online_count
                FROM connection_logs
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                    AND status = 'online'
            `);
            
            // Get degraded customers (high latency or packet loss)
            const [degradedStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT COUNT(DISTINCT customer_id) as degraded_count
                FROM connection_logs
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    AND (
                        (response_time_ms IS NOT NULL AND response_time_ms > 200)
                        OR (packet_loss_percent IS NOT NULL AND packet_loss_percent > 5)
                    )
            `);
            
            // Get average latency
            const [latencyStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    AVG(response_time_ms) as avg_latency,
                    AVG(packet_loss_percent) as avg_packet_loss
                FROM connection_logs
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    AND status = 'online'
                    AND response_time_ms IS NOT NULL
            `);
            
            // Get uptime percentage (24h)
            const [uptimeStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_checks
                FROM connection_logs
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);
            
            const totalCustomers = customerStats[0]?.total_customers || 0;
            const onlineCustomers = onlineStats[0]?.online_count || 0;
            const degradedCustomers = degradedStats[0]?.degraded_count || 0;
            const offlineCustomers = totalCustomers - onlineCustomers;
            
            const totalChecks = uptimeStats[0]?.total_checks || 0;
            const onlineChecks = uptimeStats[0]?.online_checks || 0;
            const uptimePercentage = totalChecks > 0 ? (onlineChecks / totalChecks) * 100 : 100;
            
            return {
                total_customers: totalCustomers,
                online_customers: onlineCustomers,
                offline_customers: offlineCustomers,
                degraded_customers: degradedCustomers,
                uptime_percentage: Math.round(uptimePercentage * 100) / 100,
                avg_latency_ms: latencyStats[0]?.avg_latency ? Math.round(latencyStats[0].avg_latency) : 0,
                avg_packet_loss: latencyStats[0]?.avg_packet_loss ? Math.round(latencyStats[0].avg_packet_loss * 100) / 100 : 0
            };
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting network health:', error);
            return {
                total_customers: 0,
                online_customers: 0,
                offline_customers: 0,
                degraded_customers: 0,
                uptime_percentage: 0,
                avg_latency_ms: 0,
                avg_packet_loss: 0
            };
        }
    }
    
    /**
     * Get bandwidth by area/ODC
     */
    static async getBandwidthByArea(days: number = 7): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    COALESCE(odc.name, 'Unknown') as area_name,
                    COUNT(DISTINCT bl.customer_id) as customer_count,
                    SUM(bl.bytes_in + bl.bytes_out) as total_bytes,
                    SUM(bl.bytes_in) as bytes_in,
                    SUM(bl.bytes_out) as bytes_out
                FROM bandwidth_logs bl
                JOIN customers c ON bl.customer_id = c.id
                LEFT JOIN odc_list odc ON c.odc_id = odc.id
                WHERE bl.timestamp >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY odc.id, odc.name
                ORDER BY total_bytes DESC
            `;
            
            const [rows] = await databasePool.query<RowDataPacket[]>(query, [days]);
            
            return rows.map(row => ({
                area_name: row.area_name,
                customer_count: row.customer_count || 0,
                total_bytes: row.total_bytes || 0,
                total_gb: (row.total_bytes || 0) / (1024 * 1024 * 1024),
                bytes_in: row.bytes_in || 0,
                bytes_out: row.bytes_out || 0
            }));
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting bandwidth by area:', error);
            return [];
        }
    }
    
    /**
     * Get bandwidth summary (current hour, today, week, month)
     */
    static async getBandwidthSummary(): Promise<any> {
        try {
            const today = await this.getTodayBandwidthStats();
            const weekTrend = await this.getBandwidthTrend(7);
            const monthTrend = await this.getBandwidthTrend(30);
            
            // Calculate week total
            const weekTotal = weekTrend.reduce((sum, day) => sum + day.total_bytes, 0);
            
            // Calculate month total
            const monthTotal = monthTrend.reduce((sum, day) => sum + day.total_bytes, 0);
            
            return {
                today: today,
                week: {
                    total_bytes: weekTotal,
                    total_gb: weekTotal / (1024 * 1024 * 1024),
                    total_tb: weekTotal / (1024 * 1024 * 1024 * 1024),
                    customer_count: Math.max(...weekTrend.map(d => d.customer_count), 0)
                },
                month: {
                    total_bytes: monthTotal,
                    total_gb: monthTotal / (1024 * 1024 * 1024),
                    total_tb: monthTotal / (1024 * 1024 * 1024 * 1024),
                    customer_count: Math.max(...monthTrend.map(d => d.customer_count), 0)
                }
            };
        } catch (error) {
            console.error('[MonitoringAnalytics] Error getting bandwidth summary:', error);
            return {
                today: this.getEmptyBandwidthStats(),
                week: { total_bytes: 0, total_gb: 0, total_tb: 0, customer_count: 0 },
                month: { total_bytes: 0, total_gb: 0, total_tb: 0, customer_count: 0 }
            };
        }
    }
    
    /**
     * Helper: Get empty bandwidth stats
     */
    private static getEmptyBandwidthStats(): BandwidthStats {
        return {
            total_bytes: 0,
            total_gb: 0,
            total_tb: 0,
            bytes_in: 0,
            bytes_out: 0,
            customer_count: 0,
            avg_bandwidth_per_customer: 0
        };
    }
}

export default MonitoringAnalyticsService;


