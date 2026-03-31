"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfHealingNotificationService = void 0;
const pool_1 = require("../../db/pool");
const AIAnomalyDetectionService_1 = require("../billing/AIAnomalyDetectionService");
const WhatsAppService_1 = require("../whatsapp/WhatsAppService");
const NotificationTemplateService_1 = require("./NotificationTemplateService");
class SelfHealingNotificationService {
    constructor() {
        this.whatsappService = WhatsAppService_1.whatsappService;
        this.anomalyThresholdMinutes = 3; // 3 minutes threshold
        this.massOutageThreshold = 5; // Considered mass outage if 5+ customers affected in same area
        this.aiService = new AIAnomalyDetectionService_1.AIAnomalyDetectionService();
        this.notificationTemplateService = new NotificationTemplateService_1.NotificationTemplateService();
    }
    /**
     * Check for anomalies in PPPoE connections
     */
    async checkPPPoEAnomalies() {
        try {
            const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          c.pppoe_username as ipAddress,
          c.last_connection as lastActive, 
          c.status as isActive,
          c.address as area
        FROM customers c
        WHERE c.connection_type = 'pppoe' AND c.status = 'active'
          AND c.last_connection IS NOT NULL
      `;
            const [results] = await pool_1.databasePool.query(query);
            const customers = results;
            for (const customer of customers) {
                const customerConnection = {
                    id: customer.customerId,
                    customerId: customer.customerId,
                    customerName: customer.customerName,
                    customerPhone: customer.customerPhone,
                    ipAddress: customer.ipAddress,
                    connectionType: 'pppoe',
                    lastActive: new Date(customer.lastActive),
                    isActive: customer.isActive,
                    area: customer.area
                };
                await this.checkAnomalyForCustomer(customerConnection);
            }
        }
        catch (error) {
            console.error('Error checking PPPoE anomalies:', error);
        }
    }
    /**
     * Check for anomalies in Static IP connections
     */
    async checkStaticIPAnomalies() {
        try {
            // Get all static IP customers
            // Fix schema: active Static IP connections
            const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          COALESCE(sic.ip_address, c.ip_address) as ipAddress,
          c.last_connection as lastActive,
          c.status as isActive,
          c.address as area
        FROM customers c
        LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
        WHERE c.connection_type = 'static_ip' AND c.status = 'active'
          AND (c.last_connection IS NOT NULL OR c.ip_address IS NOT NULL)
      `;
            const [results] = await pool_1.databasePool.query(query);
            const customers = results;
            for (const customer of customers) {
                const customerConnection = {
                    id: customer.customerId,
                    customerId: customer.customerId,
                    customerName: customer.customerName,
                    customerPhone: customer.customerPhone,
                    ipAddress: customer.ipAddress || '0.0.0.0',
                    connectionType: 'static_ip',
                    lastActive: new Date(customer.lastActive || Date.now()),
                    isActive: customer.isActive === 'active',
                    area: customer.area
                };
                await this.checkAnomalyForCustomer(customerConnection);
            }
        }
        catch (error) {
            console.error('Error checking Static IP anomalies:', error);
        }
    }
    /**
     * Check if a customer has an anomaly (connection down for more than threshold)
     */
    async checkAnomalyForCustomer(connection) {
        const now = new Date();
        const timeDiffMinutes = (now.getTime() - connection.lastActive.getTime()) / (1000 * 60);
        // If connection has been down for more than threshold
        if (timeDiffMinutes >= this.anomalyThresholdMinutes && connection.isActive) {
            // Check if this is a mass outage by counting other affected customers in same area
            const affectedCount = await this.countAffectedCustomersInArea(connection.area, connection.connectionType);
            const anomalyEvent = {
                id: Date.now(), // In real implementation, this would be a DB ID
                customerId: connection.customerId,
                customerName: connection.customerName,
                customerPhone: connection.customerPhone,
                ipAddress: connection.ipAddress,
                connectionType: connection.connectionType,
                downtimeStart: connection.lastActive,
                detectedAt: now,
                location: connection.area,
                area: connection.area,
                severity: this.determineSeverity(affectedCount),
                affectedCustomers: affectedCount
            };
            await this.handleAnomaly(anomalyEvent);
        }
    }
    /**
     * Count how many customers are affected in the same area
     */
    async countAffectedCustomersInArea(area, connectionType) {
        if (!area)
            return 0;
        const query = `
      SELECT COUNT(*) as count
      FROM customers c
      WHERE c.connection_type = ? 
        AND c.area = ?
        AND c.status = 'active'
        AND TIMESTAMPDIFF(MINUTE, c.last_connection, NOW()) >= ?
    `;
        const [results] = await pool_1.databasePool.query(query, [connectionType, area, this.anomalyThresholdMinutes]);
        return results[0].count || 0;
    }
    /**
     * Determine severity based on number of affected customers
     */
    determineSeverity(affectedCount) {
        if (affectedCount >= 20)
            return 'critical';
        if (affectedCount >= 10)
            return 'high';
        if (affectedCount >= 5)
            return 'medium';
        return 'low';
    }
    /**
     * Handle detected anomaly
     */
    async handleAnomaly(event) {
        console.log(`Anomaly detected for customer ${event.customerName} (${event.connectionType}) at ${event.area}`);
        // Process with AI for personalized messaging
        const aiProcessedMessage = await this.processWithAI(event);
        // Send notifications based on severity
        await this.sendNotifications(event, aiProcessedMessage);
        // Log the event
        await this.logAnomalyEvent(event);
    }
    /**
     * Process anomaly with AI to generate personalized message
     */
    async processWithAI(event) {
        try {
            // First try to use AI if available
            const prompt = `
        Generate a personalized notification message for a network anomaly. 
        Customer: ${event.customerName}
        Connection Type: ${event.connectionType}
        Location: ${event.area}
        Severity: ${event.severity}
        Affected Customers: ${event.affectedCustomers}
        
        If severity is critical (many affected customers), mention that technicians are already dispatched.
        If severity is medium/high, mention estimated resolution time.
        If severity is low, provide general information about the issue.
        
        Keep the message friendly, informative, and reassuring.
        Language: Indonesian
        Max length: 160 characters.
        Base message on this template:
        ${this.notificationTemplateService.formatNotificationMessage(event.connectionType, event.severity, event.affectedCustomers && event.affectedCustomers >= this.massOutageThreshold, {
                customerName: event.customerName,
                location: event.area,
                ipAddress: event.ipAddress,
                affectedCustomers: event.affectedCustomers
            })}
      `;
            // Call AI Service
            console.log('Generating AI response for anomaly notification...');
            const aiResponse = await this.aiService.generateResponse(prompt);
            // Check if response is valid and NOT just the prompt echoed back
            if (aiResponse && aiResponse.length > 10 && !aiResponse.includes('Generate a personalized notification')) {
                return aiResponse;
            }
            throw new Error('AI response too short or returned prompt');
        }
        catch (error) {
            console.error('Error processing with AI, falling back to template:', error);
            // Fallback message using template service
            return this.notificationTemplateService.formatNotificationMessage(event.connectionType, event.severity, event.affectedCustomers && event.affectedCustomers >= this.massOutageThreshold, {
                customerName: event.customerName,
                location: event.area,
                ipAddress: event.ipAddress,
                affectedCustomers: event.affectedCustomers
            });
        }
    }
    /**
     * Send notifications through various channels
     */
    async sendNotifications(event, message) {
        // Send WhatsApp notification
        if (event.customerPhone) {
            try {
                await this.whatsappService.sendMessage(event.customerPhone, message);
                console.log(`WhatsApp sent to ${event.customerName}: ${message.substring(0, 50)}...`);
            }
            catch (error) {
                console.error(`Failed to send WhatsApp to ${event.customerName}:`, error);
            }
        }
        // In a full implementation, you might also send:
        // - Email notifications
        // - Internal dashboard alerts
        // - Technician dispatch notifications
    }
    /**
     * Log anomaly event to database
     */
    async logAnomalyEvent(event) {
        const query = `
      INSERT INTO anomaly_events (
        customer_id, 
        customer_name, 
        connection_type, 
        ip_address, 
        downtime_start, 
        detected_at, 
        location, 
        severity, 
        affected_customers_count,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        try {
            await pool_1.databasePool.query(query, [
                event.customerId,
                event.customerName,
                event.connectionType,
                event.ipAddress,
                event.downtimeStart,
                event.detectedAt,
                event.location,
                event.severity,
                event.affectedCustomers || 0,
                'open'
            ]);
        }
        catch (error) {
            console.error('Error logging anomaly event:', error);
        }
    }
    /**
     * Main method to run anomaly detection for both PPPoE and Static IP
     */
    async runAnomalyDetection() {
        console.log('Starting Self-Healing Network Notifications detection...');
        // Check both PPPoE and Static IP connections
        await this.checkPPPoEAnomalies();
        await this.checkStaticIPAnomalies();
        console.log('Self-Healing Network Notifications detection completed.');
    }
}
exports.SelfHealingNotificationService = SelfHealingNotificationService;
//# sourceMappingURL=SelfHealingNotificationService.js.map