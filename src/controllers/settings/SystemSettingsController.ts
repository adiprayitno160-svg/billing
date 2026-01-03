import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

/**
 * Controller untuk System Settings
 * Manage konfigurasi sistem
 */
export class SystemSettingsController {
  /**
   * Show system settings page
   */
  static async index(req: Request, res: Response) {
    try {
      // Ensure system_settings table exists
      await SystemSettingsController.ensureSystemSettingsTable();

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
        title: 'Pengaturan Sistem',
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
  static async updateSettings(req: Request, res: Response) {
    try {
      const settings = req.body;
      console.log('Received settings:', Object.keys(settings));

      // Define boolean settings that use 'true'/'false'
      const boolTrueFalseSettings = [
        'auto_isolate_enabled',
        'auto_restore_enabled',
        'auto_notifications_enabled',

        'domain_mode_enabled',
        'local_mode_enabled',
        'auto_logout_enabled',

        'ppn_enabled',
        'device_rental_enabled'
      ];

      // Define boolean settings that use '1'/'0'
      const boolOneZeroSettings = [

        'late_payment_warning_at_3',
        'late_payment_warning_at_4'
      ];

      // Update each setting using INSERT ... ON DUPLICATE KEY UPDATE
      for (const [key, value] of Object.entries(settings)) {
        // Handle array values (happens when checkbox + hidden field both exist)
        let rawValue = value;
        if (Array.isArray(value)) {
          // Express sends array when multiple inputs have same name
          // Checkbox checked: ['true', 'false'] or ['1', '0'] 
          // Checkbox unchecked: ['false'] or ['0']
          // Check if any value indicates "checked" state
          const isChecked = value.includes('true') || value.includes('1') || value.includes(true);
          if (isChecked) {
            // Find the "checked" value
            rawValue = value.find(v => v === 'true' || v === '1' || v === true) || value[0];
          } else {
            // Unchecked, use the unchecked value
            rawValue = value[0];
          }
        }

        let settingValue: string = String(rawValue || '');

        // Handle boolean settings that use 'true'/'false'
        if (boolTrueFalseSettings.includes(key)) {
          // Check if checkbox was checked
          const isChecked = (Array.isArray(value) && (value.includes('true') || value.includes(true))) ||
            rawValue === 'true' || rawValue === true || rawValue === '1';
          settingValue = isChecked ? 'true' : 'false';
        }
        // Handle boolean settings that use '1'/'0'
        else if (boolOneZeroSettings.includes(key)) {
          const isChecked = (Array.isArray(value) && (value.includes('1') || value.includes(true))) ||
            rawValue === '1' || rawValue === 'true' || rawValue === true;
          settingValue = isChecked ? '1' : '0';
        }

        // Use INSERT ... ON DUPLICATE KEY UPDATE (compatible with all MySQL versions)
        try {
          await pool.query(
            `INSERT INTO system_settings (setting_key, setting_value, updated_at) 
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE 
               setting_value = VALUES(setting_value), 
               updated_at = NOW()`,
            [key, settingValue]
          );
          console.log(`✅ Updated setting: ${key} = ${settingValue}`);
        } catch (queryError: any) {
          // If INSERT ... ON DUPLICATE KEY UPDATE fails, try UPDATE
          console.error(`⚠️ Error updating setting ${key} with INSERT:`, queryError?.message || queryError);
          try {
            await pool.query(
              `UPDATE system_settings 
               SET setting_value = ?, updated_at = NOW() 
               WHERE setting_key = ?`,
              [settingValue, key]
            );
            console.log(`✅ Updated setting via UPDATE: ${key} = ${settingValue}`);
          } catch (updateError: any) {
            // If UPDATE also fails, try INSERT (in case record doesn't exist)
            console.error(`⚠️ Error updating setting ${key} with UPDATE:`, updateError?.message || updateError);
            try {
              await pool.query(
                `INSERT INTO system_settings (setting_key, setting_value, updated_at) 
                 VALUES (?, ?, NOW())`,
                [key, settingValue]
              );
              console.log(`✅ Inserted new setting: ${key} = ${settingValue}`);
            } catch (insertError: any) {
              console.error(`❌ All methods failed for setting ${key}:`, insertError?.message || insertError);
              throw new Error(`Failed to save setting '${key}': ${insertError?.sqlMessage || insertError?.message || 'Unknown error'}`);
            }
          }
        }
      }

      res.redirect('/settings/system?success=Pengaturan berhasil diupdate');
    } catch (error: any) {
      // Enhanced error logging
      const errorDetails = {
        message: error?.message || 'Unknown error',
        sqlMessage: error?.sqlMessage || null,
        sqlState: error?.sqlState || null,
        code: error?.code || null,
        errno: error?.errno || null,
        stack: error?.stack || null
      };

      console.error('❌ [SystemSettings] Update settings error:', errorDetails);
      console.error('   Error object:', error);

      // Get detailed error message
      let errorMsg = 'Unknown error occurred';
      if (error?.sqlMessage) {
        errorMsg = error.sqlMessage;
      } else if (error?.message) {
        errorMsg = error.message;
      } else if (error?.code) {
        errorMsg = `Database error: ${error.code}`;
      }

      // Log to file if logger is available
      try {
        const { BillingLogService } = await import('../../services/billing/BillingLogService');
        await BillingLogService.error('system', 'SystemSettings', 'Failed to update system settings', error as Error, {
          errorDetails,
          settingsReceived: Object.keys(req.body || {})
        });
      } catch (logError) {
        // If logging fails, continue with redirect
        console.error('Failed to log error:', logError);
      }

      // Redirect with error message (limit message length to avoid URL too long)
      const safeErrorMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;
      res.redirect(`/settings/system?error=${encodeURIComponent('Gagal update settings: ' + safeErrorMsg)}`);
    }
  }

  /**
   * Get setting value by key
   */
  static async getSettingValue(key: string): Promise<string | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT setting_value FROM system_settings WHERE setting_key = ?',
        [key]
      );

      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0]?.setting_value || null;
      }

      return null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Get active URL based on domain/local mode settings
   * This is a convenience method that uses UrlConfigService
   */
  static async getActiveUrl(): Promise<string> {
    try {
      const { UrlConfigService } = await import('../../utils/urlConfigService');
      return await UrlConfigService.getActiveUrl();
    } catch (error) {
      console.error('Error getting active URL:', error);
      return 'http://localhost:3000';
    }
  }

  /**
   * Check for application updates via Git
   */
  static async checkUpdate(req: Request, res: Response) {
    try {
      // 1. Fetch latest data from remote
      // Use timeout to prevent hanging
      await execPromise('git fetch origin', { timeout: 15000 }).catch(e => console.warn('Git fetch warning:', e.message));

      // 2. Check local vs remote status
      const { stdout: status } = await execPromise('git status -uno');

      const hasUpdate = status.includes('Your branch is behind');
      const currentVersion = process.env.npm_package_version || require('../../../package.json').version || 'Unknown';

      // 3. Get latest commit info
      const { stdout: lastCommit } = await execPromise('git log -1 --format="%h - %s (%cd)"');

      // 4. Get remote version info to determine if it's a Major update
      let remoteVersion = currentVersion;
      let isMajor = false;
      let remoteInfo = '';

      if (hasUpdate) {
        try {
          // Get remote package.json content
          const { stdout: remotePkg } = await execPromise('git show origin/main:package.json');
          const pkg = JSON.parse(remotePkg);
          remoteVersion = pkg.version;

          // Compare versions (simple string comparison for equality)
          if (remoteVersion !== currentVersion && remoteVersion !== 'Unknown') {
            isMajor = true;
          }

          // Get commit logs
          const { stdout: diff } = await execPromise('git log HEAD..origin/main --oneline -n 5');
          remoteInfo = diff;
        } catch (e) {
          console.warn('Failed to inspect remote version:', e);
          remoteInfo = '';
        }
      }

      res.json({
        success: true,
        hasUpdate,
        isMajor, // Flag to tell frontend if this is a major version update
        currentVersion,
        remoteVersion,
        lastCommit: lastCommit.trim(),
        message: hasUpdate ? (isMajor ? 'Versi Baru Tersedia!' : 'Update Tersedia') : 'Aplikasi sudah versi terbaru.',
        remoteDetails: remoteInfo
      });

    } catch (error: any) {
      console.error('Check update error:', error);
      res.json({
        success: false,
        error: 'Gagal mengecek update. Pastikan git terinstall dan dikonfigurasi. ' + (error.message || '')
      });
    }
  }

  /**
   * Perform application update
   */
  static async performUpdate(req: Request, res: Response) {
    try {
      console.log('Starting update process...');

      // 1. Pull changes
      await execPromise('git pull origin main');

      // 2. Build (if typescript)
      const hasTsConfig = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
      if (hasTsConfig) {
        console.log('Building TypeScript...');
        // Use npx tsc to be safe or npm run build if defined
        try {
          // Try npm run build first
          await execPromise('npm run build');
        } catch (e) {
          console.warn('npm run build failed, trying npx tsc directly...');
          await execPromise('npx tsc');
        }
      }

      // 3. Restart Application
      // Send response first because restart will kill the connection
      res.json({
        success: true,
        message: 'Update berhasil. Aplikasi sedang direstart, mohon tunggu beberapa saat...'
      });

      // Restart mechanism
      setTimeout(() => {
        console.log('Triggering restart...');
        // Detect if running under PM2
        if (process.env.pm_id || process.env.PM2_HOME) {
          // Try to reload "billing-app" or current process id
          exec('pm2 reload billing-app', (err) => {
            if (err) {
              console.error('PM2 reload billing-app failed:', err);
              // Fallback to updating by id if name fails
              if (process.env.pm_id) {
                exec(`pm2 reload ${process.env.pm_id}`);
              }
            }
          });
        } else {
          // Fallback: Just exit and hope a supervisor restarts it, or dev mode behavior
          console.log('Not running under PM2, exiting process...');
          process.exit(0);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Update failed:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Update gagal: ' + error.message });
      }
    }
  }

  /**
   * Ensure system_settings table exists
   */
  private static async ensureSystemSettingsTable(): Promise<void> {
    try {
      // Create table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          setting_description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Check if category column exists
      const [categoryColumn] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'system_settings' 
          AND COLUMN_NAME = 'category'
      `);

      const hasCategoryColumn = Array.isArray(categoryColumn) && categoryColumn.length > 0;

      // Add category column if it doesn't exist
      if (!hasCategoryColumn) {
        try {
          await pool.query(`
            ALTER TABLE system_settings 
            ADD COLUMN category VARCHAR(50) DEFAULT 'general' AFTER setting_description,
            ADD INDEX idx_category (category)
          `);
          console.log('✅ [AutoFix] Added category column to system_settings');
        } catch (alterError: any) {
          if (!alterError?.message?.includes('Duplicate column')) {
            console.warn('⚠️ [AutoFix] Could not add category column:', alterError?.message);
          }
        }
      }

      // Insert default settings based on available columns
      if (hasCategoryColumn) {
        await pool.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
          ('app_version', '1.0.0', 'Versi aplikasi sistem billing', 'general'),
          ('domain_url', 'https://billing.example.com', 'URL domain untuk akses aplikasi (production)', 'url'),
          ('local_url', 'http://localhost:3000', 'URL lokal untuk akses aplikasi (development)', 'url'),
          ('domain_mode_enabled', 'false', 'Aktifkan penggunaan domain URL', 'url'),
          ('local_mode_enabled', 'true', 'Aktifkan penggunaan local URL', 'url'),

          ('grace_period_days', '3', 'Jumlah hari grace period sebelum late payment dihitung', 'late_payment'),

          ('late_payment_rolling_months', '12', 'Periode rolling count (bulan)', 'late_payment'),
          ('consecutive_on_time_reset', '3', 'Jumlah pembayaran tepat waktu berturut-turut untuk reset counter', 'late_payment'),

          ('late_payment_warning_at_3', '1', 'Kirim warning setelah 3x late payment (1=enabled, 0=disabled)', 'late_payment'),
          ('late_payment_warning_at_4', '1', 'Kirim final warning setelah 4x late payment (1=enabled, 0=disabled)', 'late_payment'),
          ('auto_isolate_enabled', 'false', 'Enable/disable auto isolation untuk customer yang telat bayar', 'billing'),
          ('auto_restore_enabled', 'false', 'Enable/disable auto restore untuk customer yang sudah bayar', 'billing'),
          ('auto_notifications_enabled', 'true', 'Enable/disable auto notifications untuk billing', 'billing'),
          ('auto_logout_enabled', 'true', 'Enable/disable auto logout setelah 10 menit tidak ada aktivitas', 'general'),
          ('ppn_enabled', 'false', 'Enable PPN (VAT)', 'billing'),
          ('ppn_rate', '11', 'PPN Percentage (%)', 'billing'),
          ('device_rental_enabled', 'false', 'Enable Device Rental', 'billing'),
          ('device_rental_fee', '0', 'Default Device Rental Fee', 'billing')
        `);
      } else {
        // Insert without category column (backward compatible)
        await pool.query(`
          INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description) VALUES
          ('app_version', '1.0.0', 'Versi aplikasi sistem billing'),
          ('domain_url', 'https://billing.example.com', 'URL domain untuk akses aplikasi (production)'),
          ('local_url', 'http://localhost:3000', 'URL lokal untuk akses aplikasi (development)'),
          ('domain_mode_enabled', 'false', 'Aktifkan penggunaan domain URL'),
          ('local_mode_enabled', 'true', 'Aktifkan penggunaan local URL'),

          ('grace_period_days', '3', 'Jumlah hari grace period sebelum late payment dihitung'),

          ('late_payment_rolling_months', '12', 'Periode rolling count (bulan)'),
          ('consecutive_on_time_reset', '3', 'Jumlah pembayaran tepat waktu berturut-turut untuk reset counter'),

          ('late_payment_warning_at_3', '1', 'Kirim warning setelah 3x late payment (1=enabled, 0=disabled)'),
          ('late_payment_warning_at_4', '1', 'Kirim final warning setelah 4x late payment (1=enabled, 0=disabled)'),
          ('auto_isolate_enabled', 'false', 'Enable/disable auto isolation untuk customer yang telat bayar'),
          ('auto_restore_enabled', 'false', 'Enable/disable auto restore untuk customer yang sudah bayar'),
          ('auto_notifications_enabled', 'true', 'Enable/disable auto notifications untuk billing'),
          ('auto_logout_enabled', 'true', 'Enable/disable auto logout setelah 10 menit tidak ada aktivitas'),
          ('ppn_enabled', 'false', 'Enable PPN (VAT)'),
          ('ppn_rate', '11', 'PPN Percentage (%)'),
          ('device_rental_enabled', 'false', 'Enable Device Rental'),
          ('device_rental_fee', '0', 'Default Device Rental Fee')
        `);
      }
    } catch (error) {
      console.error('Error ensuring system_settings table:', error);
    }
  }
}

