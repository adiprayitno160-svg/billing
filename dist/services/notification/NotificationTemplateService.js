"use strict";
/**
 * Notification Template Service
 * Manages notification templates that can be customized
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTemplateService = void 0;
const pool_1 = require("../../db/pool");
class NotificationTemplateService {
    /**
     * Get all templates
     */
    static async getAllTemplates(filters) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            let query = 'SELECT * FROM notification_templates WHERE 1=1';
            const params = [];
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
            const [rows] = await connection.query(query, params);
            return rows.map(row => ({
                ...row,
                variables: row.variables ? JSON.parse(row.variables) : []
            }));
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get template by code
     */
    static async getTemplateByCode(templateCode) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM notification_templates WHERE template_code = ?', [templateCode]);
            if (rows.length === 0) {
                return null;
            }
            const row = rows[0];
            return {
                ...row,
                variables: row.variables ? JSON.parse(row.variables) : []
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Get template by notification type and channel
     */
    static async getTemplate(notificationType, channel = 'whatsapp') {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await connection.query(`SELECT * FROM notification_templates 
         WHERE notification_type = ? AND channel = ? AND is_active = TRUE
         ORDER BY priority DESC, id ASC
         LIMIT 1`, [notificationType, channel]);
            if (rows.length === 0) {
                return null;
            }
            const row = rows[0];
            return {
                ...row,
                variables: row.variables ? JSON.parse(row.variables) : []
            };
        }
        finally {
            connection.release();
        }
    }
    /**
     * Create new template
     */
    static async createTemplate(template) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [result] = await connection.query(`INSERT INTO notification_templates 
         (template_code, template_name, notification_type, channel, title_template, 
          message_template, variables, is_active, priority, schedule_days_before)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
            ]);
            return result.insertId;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Update template
     */
    static async updateTemplate(templateCode, updates) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const updateFields = [];
            const params = [];
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
            const [result] = await connection.query(`UPDATE notification_templates 
         SET ${updateFields.join(', ')} 
         WHERE template_code = ?`, params);
            return result.affectedRows > 0;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Delete template
     */
    static async deleteTemplate(templateCode) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [result] = await connection.query('DELETE FROM notification_templates WHERE template_code = ?', [templateCode]);
            return result.affectedRows > 0;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Replace template variables with actual values
     */
    static replaceVariables(template, variables) {
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
    static formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
    /**
     * Format date
     */
    static formatDate(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}
exports.NotificationTemplateService = NotificationTemplateService;
//# sourceMappingURL=NotificationTemplateService.js.map