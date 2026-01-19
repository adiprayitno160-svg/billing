export interface NotificationTemplate {
  id: string;
  scenario: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'push';
  variables?: string[];
}

export class NotificationTemplateService {
  private templates: NotificationTemplate[] = [
    {
      id: 'pppoe-anomaly-individual',
      scenario: 'pppoe_individual_anomaly',
      severity: 'medium',
      title: 'Koneksi Bermasalah',
      message: 'Halo {{customerName}}, kami mendeteksi koneksi internet Anda sedang bermasalah. Tim teknisi kami sedang mengeceknya.',
      channel: 'whatsapp',
      variables: ['customerName', 'location']
    },
    {
      id: 'pppoe-anomaly-mass',
      scenario: 'pppoe_mass_outage',
      severity: 'high',
      title: 'Gangguan Jaringan',
      message: 'Halo {{customerName}}, saat ini kami sedang mengalami gangguan teknis di wilayah {{location}}. Tim teknisi sedang menuju lokasi untuk perbaikan.',
      channel: 'whatsapp',
      variables: ['customerName', 'location', 'affectedCount']
    },
    {
      id: 'static-ip-anomaly-individual',
      scenario: 'static_ip_individual_anomaly',
      severity: 'medium',
      title: 'Koneksi Bermasalah',
      message: 'Halo {{customerName}}, kami mendeteksi IP statis {{ipAddress}} Anda sedang bermasalah. Tim teknisi kami sedang mengeceknya.',
      channel: 'whatsapp',
      variables: ['customerName', 'ipAddress', 'location']
    },
    {
      id: 'static-ip-anomaly-mass',
      scenario: 'static_ip_mass_outage',
      severity: 'high',
      title: 'Gangguan Jaringan',
      message: 'Halo {{customerName}}, saat ini kami sedang mengalami gangguan teknis di wilayah {{location}} yang mempengaruhi banyak pelanggan termasuk layanan IP statis Anda. Tim teknisi sedang menuju lokasi untuk perbaikan.',
      channel: 'whatsapp',
      variables: ['customerName', 'location', 'affectedCount']
    },
    {
      id: 'critical-outage',
      scenario: 'critical_outage',
      severity: 'critical',
      title: 'Gangguan Jaringan Luas',
      message: 'Pemberitahuan Penting: Kami sedang mengalami gangguan jaringan luas di wilayah {{location}}. Tim teknisi kami sedang bekerja keras untuk memperbaikinya. Kami mohon maaf atas ketidaknyamanan ini.',
      channel: 'whatsapp',
      variables: ['location', 'affectedCount']
    },
    {
      id: 'service-restored',
      scenario: 'service_restored',
      severity: 'low',
      title: 'Layanan Dipulihkan',
      message: 'Halo {{customerName}}, layanan internet Anda telah kami pulihkan kembali. Terima kasih atas kesabarannya.',
      channel: 'whatsapp',
      variables: ['customerName']
    }
  ];

  /**
   * Get a notification template by scenario and severity
   */
  getTemplate(scenario: string, severity: 'low' | 'medium' | 'high' | 'critical', channel: 'whatsapp' | 'email' | 'sms' | 'push' = 'whatsapp'): NotificationTemplate | null {
    const template = this.templates.find(t => 
      t.scenario === scenario && 
      t.severity === severity && 
      t.channel === channel
    );

    return template || null;
  }

  /**
   * Get a notification template by ID
   */
  getTemplateById(id: string): NotificationTemplate | null {
    return this.templates.find(t => t.id === id) || null;
  }

  /**
   * Render a template with provided variables
   */
  renderTemplate(template: NotificationTemplate, variables: Record<string, any>): string {
    let renderedMessage = template.message;

    // Replace variables in the message
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedMessage = renderedMessage.replace(new RegExp(placeholder, 'g'), value?.toString() || '');
    }

    return renderedMessage;
  }

  /**
   * Get appropriate template based on anomaly event
   */
  getTemplateForAnomaly(
    connectionType: 'pppoe' | 'static_ip', 
    severity: 'low' | 'medium' | 'high' | 'critical',
    isMassOutage: boolean,
    isServiceRestored: boolean = false
  ): NotificationTemplate | null {
    if (isServiceRestored) {
      return this.getTemplate('service_restored', 'low');
    }

    const scenarioPrefix = `${connectionType}_${isMassOutage ? 'mass' : 'individual'}_anomaly`;
    return this.getTemplate(scenarioPrefix, severity);
  }

  /**
   * Format a notification message based on event data
   */
  formatNotificationMessage(
    connectionType: 'pppoe' | 'static_ip',
    severity: 'low' | 'medium' | 'high' | 'critical',
    isMassOutage: boolean,
    eventData: {
      customerName: string;
      location?: string;
      ipAddress?: string;
      affectedCustomers?: number;
      isServiceRestored?: boolean;
    }
  ): string {
    const template = this.getTemplateForAnomaly(
      connectionType,
      severity,
      isMassOutage,
      eventData.isServiceRestored
    );

    if (!template) {
      // Fallback message
      if (eventData.isServiceRestored) {
        return `Halo ${eventData.customerName}, layanan internet Anda telah kami pulihkan kembali. Terima kasih atas kesabarannya.`;
      }
      
      const baseMessage = isMassOutage
        ? `Halo ${eventData.customerName}, saat ini kami sedang mengalami gangguan teknis di wilayah ${eventData.location || 'Anda'}. Tim teknisi sedang menuju lokasi untuk perbaikan.`
        : `Halo ${eventData.customerName}, kami mendeteksi koneksi ${connectionType} Anda sedang bermasalah. Tim teknisi kami sedang mengeceknya.`;
      
      return baseMessage;
    }

    // Prepare variables for template rendering
    const variables: Record<string, any> = {
      customerName: eventData.customerName,
      location: eventData.location || 'wilayah Anda',
      ipAddress: eventData.ipAddress,
      affectedCount: eventData.affectedCustomers || 1
    };

    return this.renderTemplate(template, variables);
  }
}