import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface NotificationTemplate {
  id?: number;
  template_code: string;
  template_name: string;
  notification_type: string;
  channel: string;
  title_template: string;
  message_template: string;
  variables: string[] | string;
  is_active: boolean;
  priority: 'low' | 'normal' | 'high';
  schedule_days_before?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class NotificationTemplateService {
  /**
   * Get a notification template from database
   */
  static async getTemplate(notificationType: string, channel: string): Promise<NotificationTemplate | null> {
    try {
      const [rows] = await databasePool.query<RowDataPacket[]>(
        'SELECT * FROM notification_templates WHERE notification_type = ? AND channel = ? AND is_active = 1',
        [notificationType, channel]
      );

      if (rows.length === 0) {
        return null;
      }

      const template = rows[0] as NotificationTemplate;
      if (typeof template.variables === 'string') {
        try { template.variables = JSON.parse(template.variables); } catch { template.variables = []; }
      }
      return template;
    } catch (error) {
      console.error('Error fetching notification template:', error);
      return null;
    }
  }

  /**
   * Get template by code
   */
  static async getTemplateByCode(code: string): Promise<NotificationTemplate | null> {
    try {
      const [rows] = await databasePool.query<RowDataPacket[]>(
        'SELECT * FROM notification_templates WHERE template_code = ?',
        [code]
      );

      if (rows.length === 0) {
        return null;
      }

      const template = rows[0] as NotificationTemplate;
      if (typeof template.variables === 'string') {
        try { template.variables = JSON.parse(template.variables); } catch { template.variables = []; }
      }
      return template;
    } catch (error) {
      console.error('Error fetching template by code:', error);
      return null;
    }
  }

  /**
   * Get all templates with optional filters
   */
  static async getAllTemplates(filters: { notification_type?: string, channel?: string, is_active?: boolean } = {}): Promise<NotificationTemplate[]> {
    try {
      let query = 'SELECT * FROM notification_templates WHERE 1=1';
      const params: any[] = [];

      if (filters.notification_type) {
        query += ' AND notification_type = ?';
        params.push(filters.notification_type);
      }
      if (filters.channel) {
        query += ' AND channel = ?';
        params.push(filters.channel);
      }
      if (filters.is_active !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.is_active ? 1 : 0);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
      return rows.map(r => {
        const t = r as NotificationTemplate;
        if (typeof t.variables === 'string') {
          try { t.variables = JSON.parse(t.variables); } catch { t.variables = []; }
        }
        return t;
      });
    } catch (error) {
      console.error('Error fetching all templates:', error);
      return [];
    }
  }

  /**
   * Create new template
   */
  static async createTemplate(data: Partial<NotificationTemplate>): Promise<number> {
    try {
      const [result] = await databasePool.query<ResultSetHeader>(
        `INSERT INTO notification_templates 
         (template_code, template_name, notification_type, channel, title_template, message_template, variables, is_active, priority, schedule_days_before)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.template_code,
          data.template_name,
          data.notification_type,
          data.channel,
          data.title_template,
          data.message_template,
          JSON.stringify(data.variables || []),
          data.is_active !== false ? 1 : 0,
          data.priority || 'normal',
          data.schedule_days_before || null
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(code: string, data: Partial<NotificationTemplate>): Promise<boolean> {
    try {
      const allowedFields = ['template_name', 'notification_type', 'channel', 'title_template', 'message_template', 'variables', 'is_active', 'priority', 'schedule_days_before'];
      const updates: string[] = [];
      const params: any[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          params.push(key === 'variables' ? JSON.stringify(value) : value);
        }
      }

      if (updates.length === 0) return false;

      params.push(code);
      const [result] = await databasePool.query<ResultSetHeader>(
        `UPDATE notification_templates SET ${updates.join(', ')} WHERE template_code = ?`,
        params
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(code: string): Promise<boolean> {
    try {
      const [result] = await databasePool.query<ResultSetHeader>(
        'DELETE FROM notification_templates WHERE template_code = ?',
        [code]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Replace variables in a template string
   */
  static replaceVariables(template: string, variables: Record<string, any>): string {
    if (!template) return '';

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(value !== undefined && value !== null ? value.toString() : '');
    }

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.split(placeholder).join(value !== undefined && value !== null ? value.toString() : '');
    }

    // New: Remove any remaining placeholders that weren't replaced to keep the message clean
    result = result.replace(/\{{1,2}[a-zA-Z0-9_-]+\}{1,2}/g, '');

    return result;
  }

  /**
   * Format currency for display in messages
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format date for display in messages
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format notification message for anomalies
   */
  formatNotificationMessage(
    connectionType: string,
    severity: string,
    isMassOutage: boolean | undefined,
    variables: Record<string, any>
  ): string {
    let template = '';
    if (isMassOutage) {
      template = "⚠️ *GANGGUAN MASSAL*\nTerdeteksi gangguan jaringan di area *{location}*.\n{affectedCustomers} pelanggan terdampak.\nTeknisi sedang menindaklanjuti.";
    } else if (severity === 'critical' || severity === 'high') {
      template = "🚨 *ALERT JARINGAN*\nTerdeteksi gangguan pada koneksi {connectionType} Anda ({ipAddress}).\nMohon jangan restart perangkat selama 5 menit.";
    } else {
      // default
      template = "⚠️ *INFO JARINGAN*\nTerdeteksi gangguan sesaat pada koneksi {connectionType} Anda.\nSistem sedang memonitor stabilitas koneksi.";
    }

    return NotificationTemplateService.replaceVariables(template, variables);
  }
}