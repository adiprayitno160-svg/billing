"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnomalyDetectionService = void 0;
/**
 * AIAnomalyDetectionService - AI-powered anomaly detection for billing system
 * Detects bugs, errors, and anomalies in real-time using pattern analysis
 */
const pool_1 = require("../../db/pool");
class AIAnomalyDetectionService {
    constructor() {
        this.anomalyPatterns = new Map();
    }
    /**
     * Initialize anomaly patterns
     */
    async initialize() {
        await this.loadAnomalyPatterns();
        await this.initializeDefaultPatterns();
    }
    /**
     * Detect anomaly in log entry
     */
    async detectAnomaly(entry, logId) {
        const results = [];
        // Check against known patterns
        results.push(...await this.checkKnownPatterns(entry));
        // Check for repetitive errors
        results.push(await this.checkRepetitiveErrors(entry));
        // Check for unusual patterns
        results.push(await this.checkUnusualPatterns(entry));
        // Check for business logic anomalies
        results.push(await this.checkBusinessAnomalies(entry));
        // Check for performance anomalies
        results.push(await this.checkPerformanceAnomalies(entry));
        // Check for security anomalies
        results.push(await this.checkSecurityAnomalies(entry));
        // Select the highest scoring anomaly
        const maxAnomaly = results.reduce((max, current) => current.score > max.score ? current : max, { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } });
        if (maxAnomaly.score > 0.5) {
            return {
                isAnomaly: true,
                type: maxAnomaly.type,
                score: maxAnomaly.score,
                analysis: maxAnomaly.analysis
            };
        }
        return {
            isAnomaly: false,
            type: 'none',
            score: 0,
            analysis: { reason: 'No anomalies detected', severity: 'low' }
        };
    }
    /**
     * Check against known anomaly patterns
     */
    async checkKnownPatterns(entry) {
        const results = [];
        const message = entry.message.toLowerCase();
        const errorMessage = entry.error?.message?.toLowerCase() || '';
        // Database connection errors
        if (message.includes('connection') && (message.includes('refused') || message.includes('timeout') || message.includes('lost'))) {
            results.push({
                isAnomaly: true,
                type: 'database_connection',
                score: 0.9,
                analysis: {
                    pattern: 'Database connection issue',
                    reason: 'Database connection failed or lost',
                    suggestions: [
                        'Check database server status',
                        'Verify network connectivity',
                        'Check database credentials',
                        'Review connection pool settings'
                    ],
                    severity: 'critical'
                }
            });
        }
        // Payment processing errors
        if (entry.type === 'payment' && entry.level === 'error') {
            results.push({
                isAnomaly: true,
                type: 'payment_error',
                score: 0.85,
                analysis: {
                    pattern: 'Payment processing error',
                    reason: 'Error occurred during payment processing',
                    suggestions: [
                        'Verify payment gateway connection',
                        'Check payment transaction logs',
                        'Verify customer payment information',
                        'Review payment configuration'
                    ],
                    severity: 'high'
                }
            });
        }
        // Invoice generation errors
        if (entry.type === 'invoice' && entry.level === 'error') {
            results.push({
                isAnomaly: true,
                type: 'invoice_generation_error',
                score: 0.8,
                analysis: {
                    pattern: 'Invoice generation failed',
                    reason: 'Failed to generate invoice',
                    suggestions: [
                        'Check customer data integrity',
                        'Verify package/plan information',
                        'Review invoice template',
                        'Check database constraints'
                    ],
                    severity: 'high'
                }
            });
        }
        // MikroTik connection errors
        if ((message.includes('mikrotik') || entry.service.toLowerCase().includes('mikrotik')) && entry.level === 'error') {
            results.push({
                isAnomaly: true,
                type: 'mikrotik_error',
                score: 0.8,
                analysis: {
                    pattern: 'MikroTik router error',
                    reason: 'Error connecting to or communicating with MikroTik router',
                    suggestions: [
                        'Check MikroTik router status',
                        'Verify network connectivity',
                        'Check router credentials',
                        'Review API settings'
                    ],
                    severity: 'high'
                }
            });
        }
        // SQL injection or suspicious query patterns
        if (errorMessage.includes('syntax error') || errorMessage.includes('unknown column') || errorMessage.includes('table') && errorMessage.includes("doesn't exist")) {
            results.push({
                isAnomaly: true,
                type: 'sql_error',
                score: 0.75,
                analysis: {
                    pattern: 'SQL error detected',
                    reason: 'Database query error or potential SQL injection attempt',
                    suggestions: [
                        'Review query construction',
                        'Check for SQL injection attempts',
                        'Verify database schema',
                        'Review query parameters'
                    ],
                    severity: 'high'
                }
            });
        }
        // Unauthorized access attempts
        if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('access denied')) {
            results.push({
                isAnomaly: true,
                type: 'security_breach',
                score: 0.9,
                analysis: {
                    pattern: 'Unauthorized access attempt',
                    reason: 'Unauthorized access or permission denied',
                    suggestions: [
                        'Review user permissions',
                        'Check authentication logs',
                        'Verify user credentials',
                        'Review security policies'
                    ],
                    severity: 'critical'
                }
            });
        }
        // Memory or performance issues
        if (message.includes('memory') || message.includes('out of memory') || message.includes('heap')) {
            results.push({
                isAnomaly: true,
                type: 'performance_issue',
                score: 0.85,
                analysis: {
                    pattern: 'Memory/Performance issue',
                    reason: 'Memory or performance degradation detected',
                    suggestions: [
                        'Check server memory usage',
                        'Review application memory leaks',
                        'Optimize database queries',
                        'Consider scaling resources'
                    ],
                    severity: 'high'
                }
            });
        }
        // Null reference or undefined errors
        if (errorMessage.includes('cannot read property') || errorMessage.includes('null') || errorMessage.includes('undefined')) {
            results.push({
                isAnomaly: true,
                type: 'null_reference',
                score: 0.7,
                analysis: {
                    pattern: 'Null/Undefined reference error',
                    reason: 'Attempted to access property of null or undefined object',
                    suggestions: [
                        'Add null checks',
                        'Review data validation',
                        'Check data initialization',
                        'Add defensive programming'
                    ],
                    severity: 'medium'
                }
            });
        }
        // Timeout errors
        if (message.includes('timeout') || errorMessage.includes('timeout')) {
            results.push({
                isAnomaly: true,
                type: 'timeout_error',
                score: 0.75,
                analysis: {
                    pattern: 'Operation timeout',
                    reason: 'Operation exceeded maximum time limit',
                    suggestions: [
                        'Increase timeout settings',
                        'Optimize slow operations',
                        'Check network connectivity',
                        'Review resource usage'
                    ],
                    severity: 'medium'
                }
            });
        }
        return results;
    }
    /**
     * Check for repetitive errors (same error occurring multiple times)
     */
    async checkRepetitiveErrors(entry) {
        if (entry.level !== 'error' && entry.level !== 'critical') {
            return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
        }
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Check for similar errors in last hour
            const [rows] = await conn.execute(`
                SELECT COUNT(*) as count 
                FROM system_logs 
                WHERE log_level IN ('error', 'critical')
                AND service_name = ?
                AND message LIKE ?
                AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `, [entry.service, `%${entry.message.substring(0, 50)}%`]);
            const count = rows[0]?.count || 0;
            if (count >= 5) {
                return {
                    isAnomaly: true,
                    type: 'repetitive_error',
                    score: Math.min(0.95, 0.6 + (count * 0.05)),
                    analysis: {
                        pattern: 'Repetitive error pattern',
                        reason: `Same error occurred ${count} times in the last hour`,
                        suggestions: [
                            'Investigate root cause immediately',
                            'Check for system degradation',
                            'Review recent code changes',
                            'Check related services'
                        ],
                        severity: count >= 10 ? 'critical' : 'high'
                    }
                };
            }
        }
        catch (error) {
            // Silent fail
        }
        finally {
            conn.release();
        }
        return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
    }
    /**
     * Check for unusual patterns
     */
    async checkUnusualPatterns(entry) {
        // Check for unusual error messages
        const unusualKeywords = ['hack', 'exploit', 'vulnerability', 'breach', 'attack'];
        const message = entry.message.toLowerCase();
        for (const keyword of unusualKeywords) {
            if (message.includes(keyword)) {
                return {
                    isAnomaly: true,
                    type: 'security_alert',
                    score: 0.95,
                    analysis: {
                        pattern: 'Security-related keyword detected',
                        reason: `Security-related keyword "${keyword}" found in log`,
                        suggestions: [
                            'Immediate security review required',
                            'Check system access logs',
                            'Review user activities',
                            'Notify security team'
                        ],
                        severity: 'critical'
                    }
                };
            }
        }
        return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
    }
    /**
     * Check for business logic anomalies
     */
    async checkBusinessAnomalies(entry) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Check for negative invoice amounts
            if (entry.type === 'invoice' && entry.context) {
                const amount = entry.context.amount || entry.context.total || 0;
                if (amount < 0) {
                    return {
                        isAnomaly: true,
                        type: 'business_logic_error',
                        score: 0.85,
                        analysis: {
                            pattern: 'Negative invoice amount',
                            reason: 'Invoice amount is negative, which is unusual',
                            suggestions: [
                                'Review invoice calculation logic',
                                'Check for refund/credit issues',
                                'Verify customer balance',
                                'Review transaction history'
                            ],
                            severity: 'high'
                        }
                    };
                }
            }
            // Check for payment larger than invoice
            if (entry.type === 'payment' && entry.context) {
                const paymentAmount = entry.context.amount || 0;
                const invoiceAmount = entry.context.invoice_amount || 0;
                if (invoiceAmount > 0 && paymentAmount > invoiceAmount * 1.5) {
                    return {
                        isAnomaly: true,
                        type: 'business_logic_error',
                        score: 0.75,
                        analysis: {
                            pattern: 'Unusual payment amount',
                            reason: `Payment amount (${paymentAmount}) is significantly larger than invoice (${invoiceAmount})`,
                            suggestions: [
                                'Verify payment amount',
                                'Check for duplicate payments',
                                'Review customer payment history',
                                'Verify invoice details'
                            ],
                            severity: 'medium'
                        }
                    };
                }
            }
        }
        catch (error) {
            // Silent fail
        }
        finally {
            conn.release();
        }
        return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
    }
    /**
     * Check for performance anomalies
     */
    async checkPerformanceAnomalies(entry) {
        if (entry.context?.responseTime) {
            const responseTime = entry.context.responseTime;
            // Response time > 5 seconds is unusual
            if (responseTime > 5000) {
                return {
                    isAnomaly: true,
                    type: 'performance_degradation',
                    score: 0.8,
                    analysis: {
                        pattern: 'Slow response time',
                        reason: `Response time (${responseTime}ms) exceeds normal threshold`,
                        suggestions: [
                            'Optimize database queries',
                            'Check server resources',
                            'Review caching strategy',
                            'Investigate slow operations'
                        ],
                        severity: 'medium'
                    }
                };
            }
        }
        return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
    }
    /**
     * Check for security anomalies
     */
    async checkSecurityAnomalies(entry) {
        // Check for SQL injection patterns
        const sqlInjectionPatterns = [
            /union.*select/i,
            /drop.*table/i,
            /insert.*into/i,
            /delete.*from/i,
            /'or'1'='1/i
        ];
        const message = entry.message + (entry.context ? JSON.stringify(entry.context) : '');
        for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(message)) {
                return {
                    isAnomaly: true,
                    type: 'security_threat',
                    score: 0.95,
                    analysis: {
                        pattern: 'Potential SQL injection attempt',
                        reason: 'SQL injection pattern detected in log message',
                        suggestions: [
                            'Immediate security review required',
                            'Check source IP address',
                            'Review user activity',
                            'Enhance input validation',
                            'Notify security team'
                        ],
                        severity: 'critical'
                    }
                };
            }
        }
        // Check for XSS patterns
        const xssPatterns = [
            /<script/i,
            /javascript:/i,
            /onerror=/i,
            /onload=/i
        ];
        for (const pattern of xssPatterns) {
            if (pattern.test(message)) {
                return {
                    isAnomaly: true,
                    type: 'security_threat',
                    score: 0.85,
                    analysis: {
                        pattern: 'Potential XSS attempt',
                        reason: 'XSS pattern detected in log message',
                        suggestions: [
                            'Review input sanitization',
                            'Check user input handling',
                            'Enhance security filters',
                            'Review security policies'
                        ],
                        severity: 'high'
                    }
                };
            }
        }
        return { isAnomaly: false, type: 'none', score: 0, analysis: { reason: '', severity: 'low' } };
    }
    /**
     * Load anomaly patterns from database
     */
    async loadAnomalyPatterns() {
        const conn = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await conn.execute(`
                SELECT * FROM anomaly_patterns WHERE is_active = 1
            `);
            rows.forEach((pattern) => {
                this.anomalyPatterns.set(pattern.pattern_name, pattern);
            });
        }
        catch (error) {
            // Table might not exist yet, ignore
        }
        finally {
            conn.release();
        }
    }
    /**
     * Initialize default anomaly patterns
     */
    async initializeDefaultPatterns() {
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Insert default patterns if they don't exist
            const defaultPatterns = [
                {
                    pattern_name: 'database_connection_failure',
                    pattern_type: 'error',
                    description: 'Database connection failures',
                    severity: 'critical',
                    pattern_rules: JSON.stringify({
                        keywords: ['connection', 'refused', 'timeout', 'lost'],
                        service_match: ['database', 'mysql', 'db'],
                        threshold: 1
                    })
                },
                {
                    pattern_name: 'repetitive_errors',
                    pattern_type: 'error',
                    description: 'Same error occurring multiple times',
                    severity: 'high',
                    pattern_rules: JSON.stringify({
                        time_window: 3600,
                        threshold: 5
                    })
                },
                {
                    pattern_name: 'unauthorized_access',
                    pattern_type: 'security',
                    description: 'Unauthorized access attempts',
                    severity: 'critical',
                    pattern_rules: JSON.stringify({
                        keywords: ['unauthorized', 'forbidden', 'access denied'],
                        threshold: 1
                    })
                }
            ];
            for (const pattern of defaultPatterns) {
                await conn.execute(`
                    INSERT INTO anomaly_patterns (
                        pattern_name, pattern_type, description, severity, pattern_rules
                    ) VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        pattern_type = VALUES(pattern_type),
                        description = VALUES(description),
                        severity = VALUES(severity),
                        pattern_rules = VALUES(pattern_rules)
                `, [
                    pattern.pattern_name,
                    pattern.pattern_type,
                    pattern.description,
                    pattern.severity,
                    pattern.pattern_rules
                ]);
            }
        }
        catch (error) {
            // Table might not exist yet, ignore
        }
        finally {
            conn.release();
        }
    }
    /**
     * Get anomaly statistics
     */
    async getAnomalyStatistics(days = 7) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await conn.execute(`
                SELECT 
                    anomaly_type,
                    COUNT(*) as count,
                    AVG(anomaly_score) as avg_score,
                    MAX(anomaly_score) as max_score
                FROM system_logs
                WHERE anomaly_detected = 1
                AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY anomaly_type
                ORDER BY count DESC
            `, [days]);
            return rows;
        }
        finally {
            conn.release();
        }
    }
}
exports.AIAnomalyDetectionService = AIAnomalyDetectionService;
//# sourceMappingURL=AIAnomalyDetectionService.js.map