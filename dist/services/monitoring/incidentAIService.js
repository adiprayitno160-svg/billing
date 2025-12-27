"use strict";
/**
 * Incident AI Service - AI-Powered Anomaly Detection & Root Cause Analysis
 * - Real-time anomaly detection
 * - Incident classification & root cause analysis
 * - Auto-recommendations for mitigation
 * - Pattern detection & prediction
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentAIService = void 0;
const pool_1 = require("../../db/pool");
const alertRoutingService_1 = __importDefault(require("../alertRoutingService"));
class IncidentAIService {
    /**
     * Analyze incident and detect root cause
     */
    static async analyzeIncident(incidentId) {
        try {
            // Get incident details
            const [incidents] = await pool_1.databasePool.query(`
                SELECT 
                    si.*,
                    c.name as customer_name,
                    c.odc_id,
                    odc.name as area,
                    c.connection_type
                FROM sla_incidents si
                JOIN customers c ON si.customer_id = c.id
                LEFT JOIN odc_list odc ON c.odc_id = odc.id
                WHERE si.id = ?
            `, [incidentId]);
            if (incidents.length === 0)
                return null;
            const incident = incidents[0];
            // Classify incident type
            const analysis = await this.classifyIncident(incident);
            // Detect root causes
            const rootCauses = await this.detectRootCauses(incident);
            analysis.root_cause_hypotheses = rootCauses;
            // Generate recommendations
            analysis.recommended_actions = this.generateRecommendations(analysis, rootCauses);
            // Save analysis
            await this.saveIncidentAnalysis(incidentId, analysis);
            // Auto-escalate if critical
            if (analysis.severity === 'critical') {
                await this.autoEscalate(incident, analysis);
            }
            return analysis;
        }
        catch (error) {
            console.error('[IncidentAI] Error analyzing incident:', error);
            return null;
        }
    }
    /**
     * Classify incident type using pattern analysis
     */
    static async classifyIncident(incident) {
        const analysis = {
            incident_id: incident.id,
            analysis_type: 'customer_issue',
            confidence: 0.5,
            severity: 'minor',
            root_cause_hypotheses: [],
            recommended_actions: [],
            affected_customers_count: 1,
            affected_area: incident.area,
            anomaly_score: 0
        };
        // Check if mass outage
        const [affectedInArea] = await pool_1.databasePool.query(`
            SELECT COUNT(DISTINCT si.customer_id) as count
            FROM sla_incidents si
            JOIN customers c ON si.customer_id = c.id
            LEFT JOIN odc_list odc ON c.odc_id = odc.id
            WHERE si.status = 'ongoing'
                AND si.incident_type = 'downtime'
                AND TIMESTAMPDIFF(MINUTE, si.start_time, NOW()) <= 120
                AND (
                    (c.odc_id = ? AND odc.id IS NOT NULL)
                    OR (odc.name = ? AND c.odc_id IS NULL)
                )
        `, [incident.odc_id, incident.area]);
        const affectedCount = affectedInArea[0]?.count || 0;
        analysis.affected_customers_count = affectedCount;
        if (affectedCount >= 10) {
            analysis.analysis_type = 'mass_outage';
            analysis.confidence = 0.90;
            analysis.severity = 'critical';
            analysis.anomaly_score = 95;
        }
        else if (affectedCount >= 5) {
            analysis.analysis_type = 'infrastructure';
            analysis.confidence = 0.80;
            analysis.severity = 'major';
            analysis.anomaly_score = 75;
        }
        else if (affectedCount >= 2) {
            analysis.analysis_type = 'infrastructure';
            analysis.confidence = 0.70;
            analysis.severity = 'major';
            analysis.anomaly_score = 60;
        }
        else {
            // Single customer issue
            analysis.analysis_type = 'customer_issue';
            analysis.confidence = 0.95;
            analysis.severity = 'minor';
            analysis.anomaly_score = 20;
        }
        // Check network degradation indicators
        const durationMinutes = incident.duration_minutes || 0;
        if (durationMinutes > 60) {
            analysis.severity = analysis.severity === 'critical' ? 'critical' : 'major';
        }
        if (durationMinutes > 240) {
            analysis.severity = 'critical';
        }
        return analysis;
    }
    /**
     * Detect root causes based on context
     */
    static async detectRootCauses(incident) {
        const hypotheses = [];
        // Hypothesis 1: Power outage in area
        const [powerRelated] = await pool_1.databasePool.query(`
            SELECT COUNT(DISTINCT si.customer_id) as count
            FROM sla_incidents si
            JOIN customers c ON si.customer_id = c.id
            LEFT JOIN odc_list odc ON c.odc_id = odc.id
            WHERE si.status = 'ongoing'
                AND si.incident_type = 'downtime'
                AND TIMESTAMPDIFF(MINUTE, si.start_time, NOW()) <= 60
                AND (
                    (c.odc_id = ? AND odc.id IS NOT NULL)
                    OR (odc.name = ? AND c.odc_id IS NULL)
                )
        `, [incident.odc_id, incident.area]);
        const affectedCount = powerRelated[0]?.count || 0;
        if (affectedCount >= 5) {
            hypotheses.push({
                hypothesis: 'Power outage di area ODC/Infrastruktur',
                confidence: 0.85,
                evidence: [`${affectedCount} pelanggan terdampak di area yang sama`],
                impact_score: 90
            });
        }
        // Hypothesis 2: Fiber cut
        if (incident.connection_type === 'pppoe' && incident.area) {
            if (affectedCount >= 3) {
                hypotheses.push({
                    hypothesis: 'Fiber optic cable terputus atau rusak',
                    confidence: 0.75,
                    evidence: ['Multiple pelanggan PPPoE terdampak', 'Lokasi ODC sama'],
                    impact_score: 85
                });
            }
        }
        // Hypothesis 3: Router/equipment failure
        if (incident.connection_type === 'static_ip' && affectedCount >= 2) {
            hypotheses.push({
                hypothesis: 'Gagal perangkat router/OLT',
                confidence: 0.70,
                evidence: ['Multiple pelanggan Static IP terdampak', 'Kemungkinan OLT/Node bermasalah'],
                impact_score: 80
            });
        }
        // Hypothesis 4: Network congestion
        const [congestion] = await pool_1.databasePool.query(`
            SELECT AVG(response_time_ms) as avg_latency
            FROM connection_logs
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                AND service_type = ?
                AND status = 'online'
                AND response_time_ms IS NOT NULL
        `, [incident.service_type]);
        if (congestion[0]?.avg_latency > 300) {
            hypotheses.push({
                hypothesis: 'Network congestion - bandwidth terbatas',
                confidence: 0.60,
                evidence: [`Latency tinggi: ${Math.round(congestion[0].avg_latency)}ms`],
                impact_score: 50
            });
        }
        // Hypothesis 5: Customer equipment issue (single customer)
        if (affectedCount === 1 && incident.connection_type === 'static_ip') {
            hypotheses.push({
                hypothesis: 'Masalah di sisi pelanggan (customer premise)',
                confidence: 0.80,
                evidence: ['Hanya 1 pelanggan terdampak', 'Periksa router/ONU pelanggan'],
                impact_score: 30
            });
        }
        // Sort by impact score (highest first)
        hypotheses.sort((a, b) => b.impact_score - a.impact_score);
        return hypotheses;
    }
    /**
     * Generate recommended actions
     */
    static generateRecommendations(analysis, rootCauses) {
        const actions = [];
        if (analysis.severity === 'critical') {
            actions.push('🔴 Segera hubungi teknisi untuk tindakan darurat');
            actions.push('📞 Kontak pelanggan terdampak dengan prioritas');
        }
        if (analysis.affected_customers_count >= 5) {
            actions.push('🏢 Cek status ODC dan infrastruktur area');
            actions.push('🔌 Periksa pasokan daya dan UPS');
        }
        if (rootCauses.length > 0) {
            const topCause = rootCauses[0];
            if (topCause.hypothesis.includes('Power')) {
                actions.push('⚡ Verifikasi power supply dan backup generator');
            }
            if (topCause.hypothesis.includes('Fiber')) {
                actions.push('🔗 Kirim tim lapangan untuk verifikasi fiber optic');
            }
            if (topCause.hypothesis.includes('Router')) {
                actions.push('🖥️ Cek status hardware router/OLT');
            }
            if (topCause.hypothesis.includes('Customer')) {
                actions.push('🏠 Koordinasikan dengan pelanggan untuk pengecekan perangkat');
            }
        }
        // Add monitoring recommendations
        if (analysis.severity !== 'minor') {
            actions.push('📊 Tingkatkan monitoring interval untuk area terdampak');
        }
        // Add notification recommendations
        if (analysis.affected_customers_count > 0) {
            actions.push(`📢 Kirim notifikasi ke ${analysis.affected_customers_count} pelanggan terdampak`);
        }
        return actions;
    }
    /**
     * Auto-escalate critical incidents
     */
    static async autoEscalate(incident, analysis) {
        try {
            const alertBody = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🚨 INSIDEN KRITIS TERDETEKSI\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📍 Area: ${incident.area || 'N/A'}\n` +
                `👥 Dampak: ${analysis.affected_customers_count} pelanggan\n` +
                `⏱️ Durasi: ${incident.duration_minutes || 0} menit\n` +
                `🔌 Type: ${incident.connection_type?.toUpperCase() || 'UNKNOWN'}\n\n` +
                `📋 Kemungkinan Penyebab:\n` +
                analysis.root_cause_hypotheses.slice(0, 2).map((h, i) => `${i + 1}. ${h.hypothesis} (${(h.confidence * 100).toFixed(0)}% confidence)`).join('\n') +
                `\n\n📝 Rekomendasi:\n` +
                analysis.recommended_actions.slice(0, 3).map(a => `• ${a}`).join('\n') +
                `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            // Send alert via existing routing service
            await alertRoutingService_1.default.routeAlert({
                alert_type: 'critical',
                recipient_type: 'internal',
                recipient_id: 0,
                role: 'admin',
                area: incident.area,
                title: '🚨 CRITICAL INCIDENT - AUTO DETECTED',
                body: alertBody,
                metadata: {
                    incident_id: incident.id,
                    analysis_type: analysis.analysis_type,
                    affected_count: analysis.affected_customers_count
                }
            });
            console.log(`[IncidentAI] Auto-escalated critical incident #${incident.id}`);
        }
        catch (error) {
            console.error('[IncidentAI] Error auto-escalating:', error);
        }
    }
    /**
     * Detect real-time anomalies
     */
    static async detectRealTimeAnomalies() {
        const anomalies = [];
        try {
            // 1. Check downtime spike
            const downtimeAnomaly = await this.analyzeDowntimeSpike();
            if (downtimeAnomaly)
                anomalies.push(downtimeAnomaly);
            // 2. Check latency degradation
            const latencyAnomaly = await this.analyzeLatencyDegradation();
            if (latencyAnomaly)
                anomalies.push(latencyAnomaly);
            // 3. Check packet loss spike
            const packetLossAnomaly = await this.analyzePacketLossSpike();
            if (packetLossAnomaly)
                anomalies.push(packetLossAnomaly);
            return anomalies;
        }
        catch (error) {
            console.error('[IncidentAI] Error detecting anomalies:', error);
            return anomalies;
        }
    }
    /**
     * Analyze downtime spike
     */
    static async analyzeDowntimeSpike() {
        const query = `
            SELECT 
                COUNT(*) as incident_count
            FROM sla_incidents
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                AND incident_type = 'downtime'
                AND status = 'ongoing'
        `;
        const [rows] = await pool_1.databasePool.query(query);
        if (!rows[0]?.incident_count)
            return null;
        const currentCount = rows[0]?.incident_count || 0;
        // Get baseline (average of last 7 days same hour)
        const baselineQuery = `
            SELECT AVG(incident_count) as baseline
            FROM (
                SELECT 
                    HOUR(timestamp) as hour,
                    COUNT(*) as incident_count
                FROM sla_incidents
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    AND incident_type = 'downtime'
                GROUP BY HOUR(timestamp)
            ) hourly
            WHERE hour = HOUR(NOW())
        `;
        const [baselineRows] = await pool_1.databasePool.query(baselineQuery);
        const baseline = baselineRows[0]?.baseline || 1;
        // Calculate anomaly score
        const ratio = currentCount / baseline;
        if (ratio > 3) {
            return {
                timestamp: new Date(),
                metric: 'downtime_count',
                current_value: currentCount,
                normal_range: { min: 0, max: baseline * 2 },
                anomaly_score: Math.min(ratio * 25, 100),
                severity: ratio > 5 ? 'critical' : 'major'
            };
        }
        return null;
    }
    /**
     * Analyze latency degradation
     */
    static async analyzeLatencyDegradation() {
        const query = `
            SELECT AVG(response_time_ms) as avg_latency
            FROM connection_logs
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                AND status = 'online'
                AND response_time_ms IS NOT NULL
        `;
        const [rows] = await pool_1.databasePool.query(query);
        if (!rows[0]?.avg_latency)
            return null;
        const currentAvg = rows[0]?.avg_latency || 0;
        const baseline = 50; // 50ms baseline
        const increasePercentage = ((currentAvg - baseline) / baseline) * 100;
        if (increasePercentage > 50) {
            return {
                timestamp: new Date(),
                metric: 'avg_latency',
                current_value: currentAvg,
                normal_range: { min: baseline * 0.8, max: baseline * 1.5 },
                anomaly_score: Math.min(increasePercentage / 10, 100),
                severity: increasePercentage > 100 ? 'critical' : 'major'
            };
        }
        return null;
    }
    /**
     * Analyze packet loss spike
     */
    static async analyzePacketLossSpike() {
        const query = `
            SELECT AVG(packet_loss_percent) as avg_packet_loss
            FROM connection_logs
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                AND packet_loss_percent IS NOT NULL
        `;
        const [rows] = await pool_1.databasePool.query(query);
        if (!rows[0]?.avg_packet_loss)
            return null;
        const currentLoss = rows[0]?.avg_packet_loss || 0;
        const baselineLoss = 0.5; // 0.5% baseline
        const ratio = currentLoss / baselineLoss;
        if (ratio > 3) {
            return {
                timestamp: new Date(),
                metric: 'packet_loss',
                current_value: currentLoss,
                normal_range: { min: 0, max: baselineLoss * 2 },
                anomaly_score: Math.min(ratio * 20, 100),
                severity: ratio > 5 ? 'critical' : 'major'
            };
        }
        return null;
    }
    /**
     * Save incident analysis
     */
    static async saveIncidentAnalysis(incidentId, analysis) {
        try {
            // Check if table exists
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS incident_analyses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    incident_id INT NOT NULL,
                    analysis_type VARCHAR(50),
                    confidence DECIMAL(5,2),
                    severity VARCHAR(20),
                    affected_customers_count INT,
                    affected_area VARCHAR(255),
                    anomaly_score INT,
                    root_causes JSON,
                    recommendations JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_incident (incident_id),
                    FOREIGN KEY (incident_id) REFERENCES sla_incidents(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `;
            await pool_1.databasePool.query(createTableQuery);
            // Insert or update analysis
            const insertQuery = `
                INSERT INTO incident_analyses (
                    incident_id, analysis_type, confidence, severity, 
                    affected_customers_count, affected_area, anomaly_score,
                    root_causes, recommendations
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    analysis_type = VALUES(analysis_type),
                    confidence = VALUES(confidence),
                    severity = VALUES(severity),
                    affected_customers_count = VALUES(affected_customers_count),
                    affected_area = VALUES(affected_area),
                    anomaly_score = VALUES(anomaly_score),
                    root_causes = VALUES(root_causes),
                    recommendations = VALUES(recommendations),
                    created_at = CURRENT_TIMESTAMP
            `;
            await pool_1.databasePool.query(insertQuery, [
                incidentId,
                analysis.analysis_type,
                analysis.confidence,
                analysis.severity,
                analysis.affected_customers_count,
                analysis.affected_area,
                analysis.anomaly_score,
                JSON.stringify(analysis.root_cause_hypotheses),
                JSON.stringify(analysis.recommended_actions)
            ]);
        }
        catch (error) {
            console.error('[IncidentAI] Error saving analysis:', error);
        }
    }
}
exports.IncidentAIService = IncidentAIService;
exports.default = IncidentAIService;
//# sourceMappingURL=incidentAIService.js.map