/**
 * Notification Template Service
 * Manages notification templates that can be customized
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface NotificationTemplate {
  id?: number;
  template_code: string;
  template_name: string;
  notification_type: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'push';
  title_template: string;
  message_template: string;
  variables?: string[];
  is_active: boolean;
  priority: 'low' | 'normal' | 'high';
  schedule_days_before?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class NotificationTemplateService {
  /**
   * Get all templates
   */
  static async getAllTemplates(filters?: {
    notification_type?: string;
    channel?: string;
    is_active?: boolean;
  }): Promise<NotificationTemplate[]> {
    const connection = await databasePool.getConnection();

    try {
      let query = 'SELECT * FROM notification_templates WHERE 1=1';
      const params: any[] = [];

      if (filters?.notification_type) {
        query += ' AND notification_type = ?';
        params.push(filters.notification_type);
      }

      if (filters?.channel) {
        query += ' AND channel = ?';
        params.push(filters.channel);
      }

      if (filters?.is_active !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.is_active);
      }

      query += ' ORDER BY notification_type, template_name';

      const [rows] = await connection.query<RowDataPacket[]>(query, params);

      return rows.map(row => ({
        ...(row as any),
        variables: (row as any).variables ? JSON.parse((row as any).variables) : []
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Get template by code
   */
  static async getTemplateByCode(templateCode: string): Promise<NotificationTemplate | null> {
    const connection = await databasePool.getConnection();

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM notification_templates WHERE template_code = ?',
        [templateCode]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as any;
      return {
        ...row,
        variables: row.variables ? JSON.parse(row.variables) : []
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get template by notification type and channel
   */
  static async getTemplate(
    notificationType: string,
    channel: string = 'whatsapp'
  ): Promise<NotificationTemplate | null> {
    const connection = await databasePool.getConnection();

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM notification_templates 
         WHERE notification_type = ? AND channel = ? AND is_active = TRUE
         ORDER BY priority DESC, id ASC
         LIMIT 1`,
        [notificationType, channel]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as any;
      return {
        ...row,
        variables: row.variables ? JSON.parse(row.variables) : []
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Create new template
   */
  static async createTemplate(template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const connection = await databasePool.getConnection();

    try {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO notification_templates 
         (template_code, template_name, notification_type, channel, title_template, 
          message_template, variables, is_active, priority, schedule_days_before)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.template_code,
          template.template_name,
          template.notification_type,
          template.channel,
          template.title_template,
          template.message_template,
          template.variables ? JSON.stringify(template.variables) : null,
          template.is_active,
          template.priority,
          template.schedule_days_before || null
        ]
      );

      return result.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(
    templateCode: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'template_code' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    const connection = await databasePool.getConnection();

    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (updates.template_name !== undefined) {
        updateFields.push('template_name = ?');
        params.push(updates.template_name);
      }

      if (updates.notification_type !== undefined) {
        updateFields.push('notification_type = ?');
        params.push(updates.notification_type);
      }

      if (updates.channel !== undefined) {
        updateFields.push('channel = ?');
        params.push(updates.channel);
      }

      if (updates.title_template !== undefined) {
        updateFields.push('title_template = ?');
        params.push(updates.title_template);
      }

      if (updates.message_template !== undefined) {
        updateFields.push('message_template = ?');
        params.push(updates.message_template);
      }

      if (updates.variables !== undefined) {
        updateFields.push('variables = ?');
        params.push(JSON.stringify(updates.variables));
      }

      if (updates.is_active !== undefined) {
        updateFields.push('is_active = ?');
        params.push(updates.is_active);
      }

      if (updates.priority !== undefined) {
        updateFields.push('priority = ?');
        params.push(updates.priority);
      }

      if (updates.schedule_days_before !== undefined) {
        updateFields.push('schedule_days_before = ?');
        params.push(updates.schedule_days_before);
      }

      if (updateFields.length === 0) {
        return false;
      }

      params.push(templateCode);

      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE notification_templates 
         SET ${updateFields.join(', ')} 
         WHERE template_code = ?`,
        params
      );

      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateCode: string): Promise<boolean> {
    const connection = await databasePool.getConnection();

    try {
      const [result] = await connection.query<ResultSetHeader>(
        'DELETE FROM notification_templates WHERE template_code = ?',
        [templateCode]
      );

      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Replace template variables with actual values
   */
  static replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }

    return result;
  }

  /**
   * Format currency
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format date
   */
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}






