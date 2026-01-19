import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { AIAnomalyDetectionService } from '../billing/AIAnomalyDetectionService';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { StaticIPMonitoringService } from './StaticIPMonitoringService';
import { NotificationTemplateService } from './NotificationTemplateService';

interface CustomerConnection {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string;
  ipAddress: string;
  connectionType: 'pppoe' | 'static_ip';
  lastActive: Date;
  isActive: boolean;
  location?: string;
  area?: string;
}

interface AnomalyEvent {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string;
  ipAddress: string;
  connectionType: 'pppoe' | 'static_ip';
  downtimeStart: Date;
  detectedAt: Date;
  location?: string;
  area?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedCustomers?: number;
}

export class SelfHealingNotificationService {
  private aiService: AIAnomalyDetectionService;
  private whatsappService: WhatsAppService;
  private notificationTemplateService: NotificationTemplateService;
  private anomalyThresholdMinutes = 3; // 3 minutes threshold
  private massOutageThreshold = 5; // Considered mass outage if 5+ customers affected in same area

  constructor() {
    this.aiService = new AIAnomalyDetectionService();
    this.whatsappService = new WhatsAppService();
    this.notificationTemplateService = new NotificationTemplateService();
  }



  /**
   * Check for anomalies in PPPoE connections
   */
  async checkPPPoEAnomalies(): Promise<void> {
    try {
      // Get all active PPPoE sessions from MikroTik (this would integrate with your existing PPPoE service)
      // For now, we'll simulate by checking recent customer activity
      const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          c.ip_address as ipAddress,
          c.last_connection as lastActive,
          c.is_active as isActive,
          c.area as area
        FROM customers c
        WHERE c.connection_type = 'pppoe' AND c.is_active = 1
      `;

      const [results] = await databasePool.query(query);
      const customers = results as any[];

      for (const customer of customers) {
        const customerConnection: CustomerConnection = {
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
    } catch (error) {
      console.error('Error checking PPPoE anomalies:', error);
    }
  }

  /**
   * Check for anomalies in Static IP connections
   */
  async checkStaticIPAnomalies(): Promise<void> {
    try {
      // Get all static IP customers
      const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          c.static_ip as ipAddress,
          c.last_connection as lastActive,
          c.is_active as isActive,
          c.area as area
        FROM customers c
        WHERE c.connection_type = 'static_ip' AND c.is_active = 1
      `;

      const [results] = await databasePool.query(query);
      const customers = results as any[];

      for (const customer of customers) {
        const customerConnection: CustomerConnection = {
          id: customer.customerId,
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          ipAddress: customer.ipAddress,
          connectionType: 'static_ip',
          lastActive: new Date(customer.lastActive),
          isActive: customer.isActive,
          area: customer.area
        };

        await this.checkAnomalyForCustomer(customerConnection);
      }
    } catch (error) {
      console.error('Error checking Static IP anomalies:', error);
    }
  }

  /**
   * Check if a customer has an anomaly (connection down for more than threshold)
   */
  private async checkAnomalyForCustomer(connection: CustomerConnection): Promise<void> {
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - connection.lastActive.getTime()) / (1000 * 60);

    // If connection has been down for more than threshold
    if (timeDiffMinutes >= this.anomalyThresholdMinutes && connection.isActive) {
      // Check if this is a mass outage by counting other affected customers in same area
      const affectedCount = await this.countAffectedCustomersInArea(connection.area, connection.connectionType);

      const anomalyEvent: AnomalyEvent = {
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
  private async countAffectedCustomersInArea(area: string, connectionType: 'pppoe' | 'static_ip'): Promise<number> {
    if (!area) return 0;

    const query = `
      SELECT COUNT(*) as count
      FROM customers c
      WHERE c.connection_type = ? 
        AND c.area = ?
        AND c.is_active = 1
        AND TIMESTAMPDIFF(MINUTE, c.last_connection, NOW()) >= ?
    `;

    const [results] = await databasePool.query(query, [connectionType, area, this.anomalyThresholdMinutes]);
    return (results[0] as any).count || 0;
  }

  /**
   * Determine severity based on number of affected customers
   */
  private determineSeverity(affectedCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (affectedCount >= 20) return 'critical';
    if (affectedCount >= 10) return 'high';
    if (affectedCount >= 5) return 'medium';
    return 'low';
  }

  /**
   * Handle detected anomaly
   */
  private async handleAnomaly(event: AnomalyEvent): Promise<void> {
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
  private async processWithAI(event: AnomalyEvent): Promise<string> {
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
        ${this.notificationTemplateService.formatNotificationMessage(
        event.connectionType,
        event.severity,
        event.affectedCustomers && event.affectedCustomers >= this.massOutageThreshold,
        {
          customerName: event.customerName,
          location: event.area,
          ipAddress: event.ipAddress,
          affectedCustomers: event.affectedCustomers
        }
      )}
      `;

      // Call AI Service
      console.log('Generating AI response for anomaly notification...');
      const aiResponse = await this.aiService.generateResponse(prompt);

      // Check if response is valid and NOT just the prompt echoed back
      if (aiResponse && aiResponse.length > 10 && !aiResponse.includes('Generate a personalized notification')) {
        return aiResponse;
      }

      throw new Error('AI response too short or returned prompt');
    } catch (error) {
      console.error('Error processing with AI, falling back to template:', error);
      // Fallback message using template service
      return this.notificationTemplateService.formatNotificationMessage(
        event.connectionType,
        event.severity,
        event.affectedCustomers && event.affectedCustomers >= this.massOutageThreshold,
        {
          customerName: event.customerName,
          location: event.area,
          ipAddress: event.ipAddress,
          affectedCustomers: event.affectedCustomers
        }
      );
    }
  }

  /**
   * Send notifications through various channels
   */
  private async sendNotifications(event: AnomalyEvent, message: string): Promise<void> {
    // Send WhatsApp notification
    if (event.customerPhone) {
      try {
        await this.whatsappService.sendMessage(event.customerPhone, message);
        console.log(`WhatsApp sent to ${event.customerName}: ${message.substring(0, 50)}...`);
      } catch (error) {
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
  private async logAnomalyEvent(event: AnomalyEvent): Promise<void> {
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
      await databasePool.query(query, [
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
    } catch (error) {
      console.error('Error logging anomaly event:', error);
    }
  }

  /**
   * Main method to run anomaly detection for both PPPoE and Static IP
   */
  async runAnomalyDetection(): Promise<void> {
    console.log('Starting Self-Healing Network Notifications detection...');

    // Check both PPPoE and Static IP connections
    await this.checkPPPoEAnomalies();
    await this.checkStaticIPAnomalies();

    console.log('Self-Healing Network Notifications detection completed.');
  }
}