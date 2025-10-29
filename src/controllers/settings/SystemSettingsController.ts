import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Controller untuk System Settings
 * Manage konfigurasi sistem termasuk Prepaid Portal URL
 */
class SystemSettingsController {
  /**
   * Show system settings page
   */
  async index(req: Request, res: Response) {
    try {
      // Ensure system_settings table exists
      await this.ensureSystemSettingsTable();

      // Get all settings grouped by category
      const [settings] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM system_settings ORDER BY category, setting_key`
      );

      // Group by category
      const groupedSettings: { [key: string]: any[] } = {};
      (settings as any[]).forEach((setting: any) => {
        const category = setting.category || 'general';
        if (!groupedSettings[category]) {
          groupedSettings[category] = [];
        }
        groupedSettings[category].push(setting);
      });

      res.render('settings/system', {
        title: 'System Settings',
        currentPath: '/settings/system',
        groupedSettings,
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (error) {
      console.error('System settings page error:', error);
      res.status(500).send('Error loading system settings');
    }
  }

  /**
   * Update system settings
   */
  async updateSettings(req: Request, res: Response) {
    try {
      const settings = req.body;

      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        await pool.query(
          `UPDATE system_settings 
           SET setting_value = ?, updated_at = NOW() 
           WHERE setting_key = ?`,
          [value, key]
        );
      }

      res.redirect('/settings/system?success=Settings berhasil diupdate');
    } catch (error) {
      console.error('Update settings error:', error);
      res.redirect('/settings/system?error=Gagal update settings');
    }
  }

  /**
   * Get setting value by key
   */
  async getSettingValue(key: string): Promise<string | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT setting_value FROM system_settings WHERE setting_key = ?',
        [key]
      );

      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0].setting_value;
      }

      return null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Ensure system_settings table exists
   */
  private async ensureSystemSettingsTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          setting_description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key),
          INDEX idx_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert default settings if not exist
      await pool.query(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
        ('prepaid_portal_url', 'http://localhost:3000', 'URL server billing untuk redirect prepaid portal', 'prepaid'),
        ('prepaid_portal_enabled', 'true', 'Enable/disable prepaid portal system', 'prepaid'),
        ('prepaid_redirect_splash_page', 'true', 'Redirect ke splash page atau langsung login', 'prepaid'),
        ('prepaid_auto_whatsapp_notification', 'true', 'Auto WhatsApp notification untuk prepaid', 'prepaid')
      `);
    } catch (error) {
      console.error('Error ensuring system_settings table:', error);
    }
  }
}

export default new SystemSettingsController();

