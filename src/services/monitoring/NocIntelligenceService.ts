/**
 * NOC Intelligence Service - Smart Monitoring Brain
 * ================================================
 * Provides:
 * 1. Customer Health Scores (0-100) based on uptime, latency, packet loss
 * 2. Predictive Alerts - detect degradation trends before full outage
 * 3. Area/ODP Heatmap - health concentration per area
 * 4. Auto Daily Digest - formatted summary for WhatsApp/Telegram
 * 5. Network Risk Scoring - churn risk based on SLA breach history
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import { AdvancedMonitoringService } from './AdvancedMonitoringService';

// ==================== INTERFACES ====================

export interface CustomerHealthScore {
    customer_id: number;
    customer_name: string;
    customer_code: string;
    connection_type: 'pppoe' | 'static_ip';
    area: string;
    odp_name: string;
    health_score: number;           // 0-100
    health_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    uptime_score: number;           // 0-40 points
    latency_score: number;          // 0-25 points
    packet_loss_score: number;      // 0-20 points
    stability_score: number;        // 0-15 points (incident frequency)
    current_status: 'online' | 'offline' | 'degraded' | 'isolated' | 'unknown';
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    trend: 'improving' | 'stable' | 'degrading';
    last_incident_minutes_ago: number | null;
    total_incidents_30d: number;
    avg_latency_ms: number;
    avg_packet_loss: number;
    uptime_24h: number;
}

export interface PredictiveAlert {
    customer_id: number;
    customer_name: string;
    customer_code: string;
    connection_type: string;
    area: string;
    alert_type: 'latency_spike' | 'packet_loss_trend' | 'frequent_disconnects' | 'degrading_health' | 'predicted_outage';
    severity: 'warning' | 'critical';
    confidence: number;             // 0-100%
    message: string;
    evidence: string[];
    recommended_action: string;
    predicted_time_to_outage_minutes: number | null;
}

export interface AreaHealthMap {
    area: string;
    odp_name: string;
    total_customers: number;
    online_count: number;
    offline_count: number;
    degraded_count: number;
    avg_health_score: number;
    health_grade: 'A' | 'B' | 'C' | 'D' | 'F';
    worst_customers: { id: number; name: string; score: number; status: string }[];
    has_cluster_outage: boolean;
    latitude: number | null;
    longitude: number | null;
}

export interface NocDashboardData {
    overall_health: number;
    overall_grade: string;
    total_customers: number;
    online_count: number;
    offline_count: number;
    degraded_count: number;
    isolated_count: number;
    pppoe_stats: { total: number; online: number; offline: number };
    static_ip_stats: { total: number; online: number; offline: number };
    customer_scores: CustomerHealthScore[];
    predictive_alerts: PredictiveAlert[];
    area_health: AreaHealthMap[];
    top_risk_customers: CustomerHealthScore[];
    recent_incidents: any[];
    trend_data: { hour: string; online: number; offline: number; avg_health: number }[];
    last_updated: Date;
}

export interface DailyDigest {
    date: string;
    overall_health: number;
    total_customers: number;
    online_now: number;
    offline_now: number;
    incidents_today: number;
    resolved_today: number;
    avg_resolution_minutes: number;
    worst_areas: { area: string; offline_count: number; avg_health: number }[];
    at_risk_customers: { name: string; score: number; reason: string }[];
    comparison_yesterday: {
        health_change: number;
        incidents_change: number;
    };
    formatted_message: string;
}

// ==================== SERVICE ====================

export class NocIntelligenceService {

    // ==================== CUSTOMER HEALTH SCORES ====================

    /**
     * Calculate health score for ALL customers
     * Score breakdown: Uptime(40) + Latency(25) + PacketLoss(20) + Stability(15) = 100
     */
    static async calculateAllHealthScores(): Promise<CustomerHealthScore[]> {
        try {
            // Get all customers with monitoring data
            const [customers] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.customer_code,
                    c.connection_type,
                    c.is_isolated,
                    COALESCE(c.area, 'Tidak Diketahui') AS area,
                    COALESCE(odp.name, 'N/A') AS odp_name,
                    c.latitude,
                    c.longitude,
                    
                    -- Ping/Status data
                    sips.status AS ping_status,
                    COALESCE(sips.response_time_ms, 0) AS response_time_ms,
                    COALESCE(sips.packet_loss_percent, 0) AS packet_loss_percent,
                    COALESCE(sips.uptime_percent_24h, 100) AS uptime_24h,
                    COALESCE(sips.consecutive_failures, 0) AS consecutive_failures,
                    
                    -- Incident counts (last 30 days)
                    (SELECT COUNT(*) FROM sla_incidents si 
                     WHERE si.customer_id = c.id 
                     AND si.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                     AND si.status != 'excluded') AS incidents_30d,
                    
                    -- Last incident
                    (SELECT TIMESTAMPDIFF(MINUTE, MAX(si2.start_time), NOW()) 
                     FROM sla_incidents si2 
                     WHERE si2.customer_id = c.id 
                     AND si2.status != 'excluded') AS last_incident_minutes_ago,
                    
                    -- Avg latency last 24h
                    (SELECT AVG(cl.response_time_ms) 
                     FROM connection_logs cl 
                     WHERE cl.customer_id = c.id 
                     AND cl.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                     AND cl.response_time_ms > 0) AS avg_latency_24h,
                    
                    -- Avg packet loss last 24h
                    (SELECT AVG(cl2.packet_loss_percent) 
                     FROM connection_logs cl2 
                     WHERE cl2.customer_id = c.id 
                     AND cl2.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS avg_packet_loss_24h,
                    
                    -- Previous day health (for trend)
                    (SELECT AVG(cl3.response_time_ms) 
                     FROM connection_logs cl3 
                     WHERE cl3.customer_id = c.id 
                     AND cl3.timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 48 HOUR) AND DATE_SUB(NOW(), INTERVAL 24 HOUR)
                     AND cl3.response_time_ms > 0) AS avg_latency_prev_24h

                FROM customers c
                LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                LEFT JOIN static_ip_ping_status sips ON c.id = sips.customer_id
                WHERE c.status = 'active'
                ORDER BY c.name
            `);

            // Get online PPPoE sessions
            let onlineUsernames = new Set<string>();
            try {
                const result = await AdvancedMonitoringService.getAllCustomersWithStatus(false);
                if (result && result.customers) {
                    result.customers.forEach((c: any) => {
                        if (c.status === 'online') {
                            onlineUsernames.add(c.pppoe_username);
                        }
                    });
                }
            } catch (e) {
                console.warn('[NocIntelligence] Could not get PPPoE status:', e);
            }

            const scores: CustomerHealthScore[] = customers.map((c: any) => {
                // Determine current status
                let currentStatus: 'online' | 'offline' | 'degraded' | 'isolated' | 'unknown' = 'unknown';
                if (c.is_isolated) {
                    currentStatus = 'isolated';
                } else if (c.connection_type === 'pppoe') {
                    currentStatus = onlineUsernames.has(c.pppoe_username) ? 'online' : 'offline';
                } else if (c.connection_type === 'static_ip') {
                    if (c.ping_status === 'online') currentStatus = 'online';
                    else if (c.ping_status === 'offline') currentStatus = 'offline';
                    else if (c.ping_status === 'degraded') currentStatus = 'degraded';
                }

                // === Score Calculations ===

                // 1. Uptime Score (max 40 points)
                const uptime = c.uptime_24h || 100;
                let uptimeScore = 0;
                if (uptime >= 99.9) uptimeScore = 40;
                else if (uptime >= 99) uptimeScore = 35;
                else if (uptime >= 97) uptimeScore = 28;
                else if (uptime >= 95) uptimeScore = 22;
                else if (uptime >= 90) uptimeScore = 15;
                else if (uptime >= 80) uptimeScore = 8;
                else uptimeScore = Math.max(0, uptime * 0.4);

                // Bonus: if currently online, small boost
                if (currentStatus === 'online') uptimeScore = Math.min(40, uptimeScore + 2);
                if (currentStatus === 'offline') uptimeScore = Math.max(0, uptimeScore - 5);

                // 2. Latency Score (max 25 points)
                const avgLatency = c.avg_latency_24h || c.response_time_ms || 0;
                let latencyScore = 25;
                if (avgLatency > 0) {
                    if (avgLatency <= 5) latencyScore = 25;
                    else if (avgLatency <= 20) latencyScore = 22;
                    else if (avgLatency <= 50) latencyScore = 18;
                    else if (avgLatency <= 100) latencyScore = 13;
                    else if (avgLatency <= 200) latencyScore = 8;
                    else if (avgLatency <= 500) latencyScore = 4;
                    else latencyScore = 1;
                }

                // 3. Packet Loss Score (max 20 points)
                const avgPktLoss = c.avg_packet_loss_24h || c.packet_loss_percent || 0;
                let packetLossScore = 20;
                if (avgPktLoss > 0) {
                    if (avgPktLoss <= 0.5) packetLossScore = 20;
                    else if (avgPktLoss <= 1) packetLossScore = 17;
                    else if (avgPktLoss <= 2) packetLossScore = 13;
                    else if (avgPktLoss <= 5) packetLossScore = 8;
                    else if (avgPktLoss <= 10) packetLossScore = 4;
                    else packetLossScore = 1;
                }

                // 4. Stability Score (max 15 points) - based on incident frequency
                const incidents30d = c.incidents_30d || 0;
                let stabilityScore = 15;
                if (incidents30d === 0) stabilityScore = 15;
                else if (incidents30d <= 1) stabilityScore = 12;
                else if (incidents30d <= 3) stabilityScore = 9;
                else if (incidents30d <= 5) stabilityScore = 5;
                else if (incidents30d <= 10) stabilityScore = 2;
                else stabilityScore = 0;

                const healthScore = Math.round(
                    Math.min(100, Math.max(0, uptimeScore + latencyScore + packetLossScore + stabilityScore))
                );

                // Grade
                let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
                if (healthScore >= 90) grade = 'A';
                else if (healthScore >= 75) grade = 'B';
                else if (healthScore >= 60) grade = 'C';
                else if (healthScore >= 40) grade = 'D';
                else grade = 'F';

                // Risk Level
                let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
                if (healthScore <= 30 || (incidents30d > 5 && currentStatus === 'offline')) riskLevel = 'critical';
                else if (healthScore <= 50 || incidents30d > 3) riskLevel = 'high';
                else if (healthScore <= 70 || incidents30d > 1) riskLevel = 'medium';

                // Trend
                let trend: 'improving' | 'stable' | 'degrading' = 'stable';
                if (c.avg_latency_prev_24h && c.avg_latency_24h) {
                    const latencyChange = (c.avg_latency_24h - c.avg_latency_prev_24h) / Math.max(1, c.avg_latency_prev_24h) * 100;
                    if (latencyChange > 30) trend = 'degrading';
                    else if (latencyChange < -20) trend = 'improving';
                }

                return {
                    customer_id: c.customer_id,
                    customer_name: c.customer_name,
                    customer_code: c.customer_code,
                    connection_type: c.connection_type,
                    area: c.area,
                    odp_name: c.odp_name,
                    health_score: healthScore,
                    health_grade: grade,
                    uptime_score: Math.round(uptimeScore),
                    latency_score: Math.round(latencyScore),
                    packet_loss_score: Math.round(packetLossScore),
                    stability_score: Math.round(stabilityScore),
                    current_status: currentStatus,
                    risk_level: riskLevel,
                    trend,
                    last_incident_minutes_ago: c.last_incident_minutes_ago,
                    total_incidents_30d: incidents30d,
                    avg_latency_ms: Math.round(avgLatency * 100) / 100,
                    avg_packet_loss: Math.round(avgPktLoss * 100) / 100,
                    uptime_24h: Math.round(uptime * 100) / 100
                };
            });

            return scores;
        } catch (error) {
            console.error('[NocIntelligence] Error calculating health scores:', error);
            return [];
        }
    }

    // ==================== PREDICTIVE ALERTS ====================

    /**
     * Detect customers that are likely to go offline soon
     * Based on: latency trends, packet loss increases, frequent short disconnects
     */
    static async generatePredictiveAlerts(): Promise<PredictiveAlert[]> {
        const alerts: PredictiveAlert[] = [];

        try {
            // 1. Latency Spike Detection (latency increased >50% in last 2 hours)
            const [latencySpikes] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    c.id, c.name, c.customer_code, c.connection_type, c.area,
                    AVG(CASE WHEN cl.timestamp >= DATE_SUB(NOW(), INTERVAL 2 HOUR) THEN cl.response_time_ms END) AS recent_avg,
                    AVG(CASE WHEN cl.timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 6 HOUR) AND DATE_SUB(NOW(), INTERVAL 2 HOUR) THEN cl.response_time_ms END) AS baseline_avg
                FROM customers c
                JOIN connection_logs cl ON c.id = cl.customer_id
                WHERE cl.timestamp >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
                AND cl.response_time_ms > 0
                AND c.status = 'active'
                AND c.is_isolated = 0
                GROUP BY c.id, c.name, c.customer_code, c.connection_type, c.area
                HAVING recent_avg > baseline_avg * 1.5 AND baseline_avg > 5 AND recent_avg > 50
                ORDER BY (recent_avg / GREATEST(baseline_avg, 1)) DESC
                LIMIT 20
            `);

            for (const spike of latencySpikes) {
                const increase = Math.round(((spike.recent_avg - spike.baseline_avg) / spike.baseline_avg) * 100);
                alerts.push({
                    customer_id: spike.id,
                    customer_name: spike.name,
                    customer_code: spike.customer_code,
                    connection_type: spike.connection_type,
                    area: spike.area || 'Unknown',
                    alert_type: 'latency_spike',
                    severity: spike.recent_avg > 200 ? 'critical' : 'warning',
                    confidence: Math.min(95, 60 + increase / 5),
                    message: `Latency meningkat ${increase}% dalam 2 jam terakhir (${Math.round(spike.baseline_avg)}ms → ${Math.round(spike.recent_avg)}ms)`,
                    evidence: [
                        `Rata-rata latency 2 jam terakhir: ${Math.round(spike.recent_avg)}ms`,
                        `Baseline (2-6 jam lalu): ${Math.round(spike.baseline_avg)}ms`,
                        `Peningkatan: ${increase}%`
                    ],
                    recommended_action: spike.recent_avg > 200
                        ? 'Segera cek koneksi fisik dan perangkat ONT pelanggan'
                        : 'Monitor dalam 30 menit, cek apakah ada gangguan di area',
                    predicted_time_to_outage_minutes: spike.recent_avg > 300 ? 30 : spike.recent_avg > 200 ? 60 : null
                });
            }

            // 2. Packet Loss Trend Detection
            const [pktLossTrends] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    c.id, c.name, c.customer_code, c.connection_type, c.area,
                    AVG(CASE WHEN cl.timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN cl.packet_loss_percent END) AS recent_loss,
                    AVG(CASE WHEN cl.timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 4 HOUR) AND DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN cl.packet_loss_percent END) AS baseline_loss
                FROM customers c
                JOIN connection_logs cl ON c.id = cl.customer_id
                WHERE cl.timestamp >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
                AND c.status = 'active'
                AND c.is_isolated = 0
                GROUP BY c.id, c.name, c.customer_code, c.connection_type, c.area
                HAVING recent_loss > 3 AND recent_loss > baseline_loss * 2
                ORDER BY recent_loss DESC
                LIMIT 15
            `);

            for (const trend of pktLossTrends) {
                alerts.push({
                    customer_id: trend.id,
                    customer_name: trend.name,
                    customer_code: trend.customer_code,
                    connection_type: trend.connection_type,
                    area: trend.area || 'Unknown',
                    alert_type: 'packet_loss_trend',
                    severity: trend.recent_loss > 10 ? 'critical' : 'warning',
                    confidence: Math.min(90, 50 + trend.recent_loss * 3),
                    message: `Packet loss meningkat ke ${Math.round(trend.recent_loss)}% (baseline: ${Math.round(trend.baseline_loss || 0)}%)`,
                    evidence: [
                        `Packet loss 1 jam terakhir: ${Math.round(trend.recent_loss)}%`,
                        `Baseline: ${Math.round(trend.baseline_loss || 0)}%`
                    ],
                    recommended_action: 'Cek kualitas kabel fiber dan konektor ODP',
                    predicted_time_to_outage_minutes: trend.recent_loss > 20 ? 15 : null
                });
            }

            // 3. Frequent Disconnect Detection (3+ disconnects in 2 hours)
            const [frequentDisconnects] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    c.id, c.name, c.customer_code, c.connection_type, c.area,
                    COUNT(*) AS disconnect_count,
                    MAX(si.start_time) AS last_disconnect
                FROM customers c
                JOIN sla_incidents si ON c.id = si.customer_id
                WHERE si.start_time >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                AND si.incident_type = 'downtime'
                AND si.status != 'excluded'
                AND c.status = 'active'
                AND c.is_isolated = 0
                GROUP BY c.id, c.name, c.customer_code, c.connection_type, c.area
                HAVING disconnect_count >= 3
                ORDER BY disconnect_count DESC
                LIMIT 10
            `);

            for (const dc of frequentDisconnects) {
                alerts.push({
                    customer_id: dc.id,
                    customer_name: dc.name,
                    customer_code: dc.customer_code,
                    connection_type: dc.connection_type,
                    area: dc.area || 'Unknown',
                    alert_type: 'frequent_disconnects',
                    severity: dc.disconnect_count >= 5 ? 'critical' : 'warning',
                    confidence: Math.min(95, 70 + dc.disconnect_count * 5),
                    message: `${dc.disconnect_count}x disconnect dalam 2 jam terakhir - kemungkinan masalah perangkat/kabel`,
                    evidence: [
                        `Total disconnect: ${dc.disconnect_count}x`,
                        `Terakhir disconnect: ${new Date(dc.last_disconnect).toLocaleString('id-ID')}`
                    ],
                    recommended_action: 'Kirim teknisi untuk cek ONT, kabel fiber, dan konektor',
                    predicted_time_to_outage_minutes: 15
                });
            }

            // Sort by severity then confidence
            alerts.sort((a, b) => {
                if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
                return b.confidence - a.confidence;
            });

        } catch (error) {
            console.error('[NocIntelligence] Error generating predictive alerts:', error);
        }

        return alerts;
    }

    // ==================== AREA HEALTH MAP ====================

    /**
     * Get health scores aggregated by area/ODP for heatmap display
     */
    static async getAreaHealthMap(): Promise<AreaHealthMap[]> {
        try {
            const scores = await this.calculateAllHealthScores();
            const areaMap = new Map<string, {
                customers: CustomerHealthScore[];
                lat: number | null;
                lng: number | null;
            }>();

            // Group by ODP (or area if no ODP)
            for (const score of scores) {
                const key = score.odp_name !== 'N/A' ? `${score.area}|${score.odp_name}` : `${score.area}|General`;
                if (!areaMap.has(key)) {
                    areaMap.set(key, { customers: [], lat: null, lng: null });
                }
                areaMap.get(key)!.customers.push(score);
            }

            // Get ODP coordinates
            try {
                const [odpCoords] = await databasePool.query<RowDataPacket[]>(`
                    SELECT name, latitude, longitude FROM ftth_odp WHERE latitude IS NOT NULL
                `);
                for (const odp of odpCoords) {
                    for (const [key, data] of areaMap) {
                        if (key.includes(odp.name) && odp.latitude && odp.longitude) {
                            data.lat = odp.latitude;
                            data.lng = odp.longitude;
                        }
                    }
                }
            } catch (e) { /* ignore */ }

            const result: AreaHealthMap[] = [];

            for (const [key, data] of areaMap) {
                const [area, odp_name] = key.split('|');
                const customers = data.customers;
                const online = customers.filter(c => c.current_status === 'online').length;
                const offline = customers.filter(c => c.current_status === 'offline').length;
                const degraded = customers.filter(c => c.current_status === 'degraded').length;
                const avgScore = customers.reduce((sum, c) => sum + c.health_score, 0) / Math.max(1, customers.length);

                let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
                if (avgScore >= 90) grade = 'A';
                else if (avgScore >= 75) grade = 'B';
                else if (avgScore >= 60) grade = 'C';
                else if (avgScore >= 40) grade = 'D';
                else grade = 'F';

                // Cluster outage: 3+ customers offline at same ODP
                const hasClusterOutage = offline >= 3;

                result.push({
                    area,
                    odp_name,
                    total_customers: customers.length,
                    online_count: online,
                    offline_count: offline,
                    degraded_count: degraded,
                    avg_health_score: Math.round(avgScore),
                    health_grade: grade,
                    worst_customers: customers
                        .filter(c => c.health_score < 60)
                        .sort((a, b) => a.health_score - b.health_score)
                        .slice(0, 5)
                        .map(c => ({
                            id: c.customer_id,
                            name: c.customer_name,
                            score: c.health_score,
                            status: c.current_status
                        })),
                    has_cluster_outage: hasClusterOutage,
                    latitude: data.lat,
                    longitude: data.lng
                });
            }

            // Sort by avg_health_score ascending (worst first)
            result.sort((a, b) => a.avg_health_score - b.avg_health_score);

            return result;
        } catch (error) {
            console.error('[NocIntelligence] Error getting area health map:', error);
            return [];
        }
    }

    // ==================== NOC DASHBOARD DATA ====================

    /**
     * Get complete NOC dashboard data in one call
     */
    static async getNocDashboardData(): Promise<NocDashboardData> {
        try {
            // Run in parallel for performance
            const [scores, predictiveAlerts, areaHealth] = await Promise.all([
                this.calculateAllHealthScores(),
                this.generatePredictiveAlerts(),
                this.getAreaHealthMap()
            ]);

            const totalCustomers = scores.length;
            const onlineCount = scores.filter(s => s.current_status === 'online').length;
            const offlineCount = scores.filter(s => s.current_status === 'offline').length;
            const degradedCount = scores.filter(s => s.current_status === 'degraded').length;
            const isolatedCount = scores.filter(s => s.current_status === 'isolated').length;

            const overallHealth = totalCustomers > 0
                ? Math.round(scores.reduce((sum, s) => sum + s.health_score, 0) / totalCustomers)
                : 100;

            let overallGrade = 'A';
            if (overallHealth >= 90) overallGrade = 'A';
            else if (overallHealth >= 75) overallGrade = 'B';
            else if (overallHealth >= 60) overallGrade = 'C';
            else if (overallHealth >= 40) overallGrade = 'D';
            else overallGrade = 'F';

            // PPPoE stats
            const pppoeScores = scores.filter(s => s.connection_type === 'pppoe');
            const staticScores = scores.filter(s => s.connection_type === 'static_ip');

            // Top risk customers (worst health scores)
            const topRisk = scores
                .filter(s => s.risk_level === 'critical' || s.risk_level === 'high')
                .sort((a, b) => a.health_score - b.health_score)
                .slice(0, 10);

            // Recent incidents
            let recentIncidents: any[] = [];
            try {
                const [incidents] = await databasePool.query<RowDataPacket[]>(`
                    SELECT 
                        si.id, si.customer_id, c.name AS customer_name,
                        si.service_type, si.incident_type, si.status,
                        si.start_time, si.end_time, si.duration_minutes
                    FROM sla_incidents si
                    JOIN customers c ON si.customer_id = c.id
                    WHERE si.start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    ORDER BY si.start_time DESC
                    LIMIT 20
                `);
                recentIncidents = incidents;
            } catch (e) { /* ignore */ }

            // Hourly trend data (last 12 hours)
            let trendData: any[] = [];
            try {
                const [trends] = await databasePool.query<RowDataPacket[]>(`
                    SELECT 
                        DATE_FORMAT(cl.timestamp, '%H:00') AS hour,
                        SUM(CASE WHEN cl.status = 'online' THEN 1 ELSE 0 END) AS online,
                        SUM(CASE WHEN cl.status = 'offline' THEN 1 ELSE 0 END) AS offline,
                        AVG(cl.response_time_ms) AS avg_latency
                    FROM connection_logs cl
                    WHERE cl.timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
                    GROUP BY DATE_FORMAT(cl.timestamp, '%H:00')
                    ORDER BY hour
                `);
                trendData = trends.map((t: any) => ({
                    hour: t.hour,
                    online: t.online || 0,
                    offline: t.offline || 0,
                    avg_health: t.avg_latency ? Math.max(0, 100 - t.avg_latency) : 100
                }));
            } catch (e) { /* ignore */ }

            return {
                overall_health: overallHealth,
                overall_grade: overallGrade,
                total_customers: totalCustomers,
                online_count: onlineCount,
                offline_count: offlineCount,
                degraded_count: degradedCount,
                isolated_count: isolatedCount,
                pppoe_stats: {
                    total: pppoeScores.length,
                    online: pppoeScores.filter(s => s.current_status === 'online').length,
                    offline: pppoeScores.filter(s => s.current_status === 'offline').length
                },
                static_ip_stats: {
                    total: staticScores.length,
                    online: staticScores.filter(s => s.current_status === 'online').length,
                    offline: staticScores.filter(s => s.current_status === 'offline').length
                },
                customer_scores: scores,
                predictive_alerts: predictiveAlerts,
                area_health: areaHealth,
                top_risk_customers: topRisk,
                recent_incidents: recentIncidents,
                trend_data: trendData,
                last_updated: new Date()
            };
        } catch (error) {
            console.error('[NocIntelligence] Error getting NOC dashboard data:', error);
            return {
                overall_health: 0,
                overall_grade: 'F',
                total_customers: 0,
                online_count: 0,
                offline_count: 0,
                degraded_count: 0,
                isolated_count: 0,
                pppoe_stats: { total: 0, online: 0, offline: 0 },
                static_ip_stats: { total: 0, online: 0, offline: 0 },
                customer_scores: [],
                predictive_alerts: [],
                area_health: [],
                top_risk_customers: [],
                recent_incidents: [],
                trend_data: [],
                last_updated: new Date()
            };
        }
    }

    // ==================== DAILY DIGEST ====================

    /**
     * Generate daily digest for WhatsApp/Telegram
     */
    static async generateDailyDigest(): Promise<DailyDigest> {
        try {
            const scores = await this.calculateAllHealthScores();
            const overallHealth = scores.length > 0
                ? Math.round(scores.reduce((sum, s) => sum + s.health_score, 0) / scores.length)
                : 100;

            // Today's incidents
            const [incidentStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(CASE WHEN DATE(start_time) = CURDATE() THEN 1 END) AS incidents_today,
                    COUNT(CASE WHEN status = 'resolved' AND DATE(COALESCE(end_time, NOW())) = CURDATE() THEN 1 END) AS resolved_today,
                    AVG(CASE WHEN status = 'resolved' AND DATE(COALESCE(end_time, NOW())) = CURDATE() THEN duration_minutes END) AS avg_resolution
                FROM sla_incidents
                WHERE start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);

            // Yesterday's incidents for comparison
            const [yesterdayStats] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) AS incidents_yesterday
                FROM sla_incidents
                WHERE DATE(start_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            `);

            // Worst areas
            const areaScores = new Map<string, { scores: number[]; offline: number }>();
            for (const score of scores) {
                const area = score.area;
                if (!areaScores.has(area)) areaScores.set(area, { scores: [], offline: 0 });
                areaScores.get(area)!.scores.push(score.health_score);
                if (score.current_status === 'offline') areaScores.get(area)!.offline++;
            }

            const worstAreas = Array.from(areaScores.entries())
                .map(([area, data]) => ({
                    area,
                    offline_count: data.offline,
                    avg_health: Math.round(data.scores.reduce((a, b) => a + b, 0) / Math.max(1, data.scores.length))
                }))
                .filter(a => a.offline_count > 0 || a.avg_health < 70)
                .sort((a, b) => a.avg_health - b.avg_health)
                .slice(0, 5);

            // At-risk customers
            const atRisk = scores
                .filter(s => s.risk_level === 'critical' || s.risk_level === 'high')
                .sort((a, b) => a.health_score - b.health_score)
                .slice(0, 5)
                .map(s => ({
                    name: s.customer_name,
                    score: s.health_score,
                    reason: s.total_incidents_30d > 3
                        ? `${s.total_incidents_30d}x gangguan dalam 30 hari`
                        : s.current_status === 'offline'
                            ? 'Sedang offline'
                            : `Health score rendah (${s.health_score})`
                }));

            const onlineNow = scores.filter(s => s.current_status === 'online').length;
            const offlineNow = scores.filter(s => s.current_status === 'offline').length;
            const incidentsToday = incidentStats[0]?.incidents_today || 0;
            const resolvedToday = incidentStats[0]?.resolved_today || 0;
            const avgResolution = Math.round(incidentStats[0]?.avg_resolution || 0);
            const incidentsYesterday = yesterdayStats[0]?.incidents_yesterday || 0;

            // Format message
            const date = new Date().toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const gradeEmoji = overallHealth >= 90 ? '🟢' : overallHealth >= 75 ? '🟡' : overallHealth >= 60 ? '🟠' : '🔴';
            const trendEmoji = incidentsToday < incidentsYesterday ? '📈 Membaik' : incidentsToday > incidentsYesterday ? '📉 Memburuk' : '➡️ Stabil';

            let message = `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `🏢 *NOC DAILY DIGEST*\n`;
            message += `📅 ${date}\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            message += `${gradeEmoji} *Network Health: ${overallHealth}/100*\n`;
            message += `${trendEmoji} vs kemarin\n\n`;

            message += `📊 *Status Pelanggan:*\n`;
            message += `  ✅ Online: ${onlineNow}/${scores.length}\n`;
            message += `  ❌ Offline: ${offlineNow}\n`;
            message += `  ⚡ Uptime: ${scores.length > 0 ? ((onlineNow / scores.length) * 100).toFixed(1) : 100}%\n\n`;

            message += `🔧 *Insiden Hari Ini:*\n`;
            message += `  📝 Total: ${incidentsToday}\n`;
            message += `  ✅ Resolved: ${resolvedToday}\n`;
            message += `  ⏱️ Avg Resolution: ${avgResolution} menit\n\n`;

            if (worstAreas.length > 0) {
                message += `🗺️ *Area Bermasalah:*\n`;
                worstAreas.forEach(a => {
                    message += `  📍 ${a.area}: ${a.offline_count} offline (health: ${a.avg_health})\n`;
                });
                message += '\n';
            }

            if (atRisk.length > 0) {
                message += `⚠️ *Pelanggan Berisiko:*\n`;
                atRisk.forEach(r => {
                    message += `  👤 ${r.name}: ${r.reason}\n`;
                });
                message += '\n';
            }

            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `🤖 Generated by NOC Intelligence`;

            return {
                date,
                overall_health: overallHealth,
                total_customers: scores.length,
                online_now: onlineNow,
                offline_now: offlineNow,
                incidents_today: incidentsToday,
                resolved_today: resolvedToday,
                avg_resolution_minutes: avgResolution,
                worst_areas: worstAreas,
                at_risk_customers: atRisk,
                comparison_yesterday: {
                    health_change: 0,
                    incidents_change: incidentsToday - incidentsYesterday
                },
                formatted_message: message
            };
        } catch (error) {
            console.error('[NocIntelligence] Error generating daily digest:', error);
            return {
                date: new Date().toLocaleDateString('id-ID'),
                overall_health: 0,
                total_customers: 0,
                online_now: 0,
                offline_now: 0,
                incidents_today: 0,
                resolved_today: 0,
                avg_resolution_minutes: 0,
                worst_areas: [],
                at_risk_customers: [],
                comparison_yesterday: { health_change: 0, incidents_change: 0 },
                formatted_message: 'Error generating digest'
            };
        }
    }

    /**
     * Send daily digest via Telegram
     */
    static async sendDailyDigestTelegram(): Promise<boolean> {
        try {
            const digest = await this.generateDailyDigest();
            const alertRoutingService = (await import('../alertRoutingService')).default;

            await alertRoutingService.routeAlert({
                alert_type: 'info',
                recipient_type: 'internal',
                recipient_id: 0,
                title: '📊 NOC Daily Digest',
                body: digest.formatted_message,
                metadata: { type: 'daily_digest', health: digest.overall_health }
            });

            console.log('[NocIntelligence] Daily digest sent via Telegram');
            return true;
        } catch (error) {
            console.error('[NocIntelligence] Error sending daily digest:', error);
            return false;
        }
    }
}

export default NocIntelligenceService;
