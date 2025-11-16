import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Service untuk mendapatkan konfigurasi URL berdasarkan mode (domain/local)
 */
export class UrlConfigService {
  /**
   * Mendapatkan URL aktif berdasarkan mode yang diaktifkan
   * Prioritas: Domain Mode > Local Mode > Fallback ke localhost
   */
  static async getActiveUrl(): Promise<string> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_key, setting_value 
         FROM system_settings 
         WHERE setting_key IN ('domain_mode_enabled', 'local_mode_enabled', 'domain_url', 'local_url')`
      );

      const settings: { [key: string]: string } = {};
      rows.forEach((row: any) => {
        settings[row.setting_key] = row.setting_value;
      });

      const domainModeEnabled = settings.domain_mode_enabled === 'true';
      const localModeEnabled = settings.local_mode_enabled === 'true';
      const domainUrl = settings.domain_url || '';
      const localUrl = settings.local_url || 'http://localhost:3000';

      // Prioritas: Domain Mode > Local Mode > Fallback
      if (domainModeEnabled && domainUrl) {
        return domainUrl;
      } else if (localModeEnabled && localUrl) {
        return localUrl;
      } else {
        // Fallback ke localhost jika tidak ada yang diaktifkan
        return localUrl || 'http://localhost:3000';
      }
    } catch (error) {
      console.error('[UrlConfigService] Error getting active URL:', error);
      // Fallback ke localhost jika ada error
      return 'http://localhost:3000';
    }
  }

  /**
   * Mendapatkan domain URL jika domain mode aktif
   */
  static async getDomainUrl(): Promise<string | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'domain_url'`
      );

      if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
        return rows[0].setting_value || null;
      }

      return null;
    } catch (error) {
      console.error('[UrlConfigService] Error getting domain URL:', error);
      return null;
    }
  }

  /**
   * Mendapatkan local URL jika local mode aktif
   */
  static async getLocalUrl(): Promise<string | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'local_url'`
      );

      if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
        return rows[0].setting_value || null;
      }

      return null;
    } catch (error) {
      console.error('[UrlConfigService] Error getting local URL:', error);
      return null;
    }
  }

  /**
   * Cek apakah domain mode aktif
   */
  static async isDomainModeEnabled(): Promise<boolean> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'domain_mode_enabled'`
      );

      if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
        return rows[0].setting_value === 'true';
      }

      return false;
    } catch (error) {
      console.error('[UrlConfigService] Error checking domain mode:', error);
      return false;
    }
  }

  /**
   * Cek apakah local mode aktif
   */
  static async isLocalModeEnabled(): Promise<boolean> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'local_mode_enabled'`
      );

      if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
        return rows[0].setting_value === 'true';
      }

      return false;
    } catch (error) {
      console.error('[UrlConfigService] Error checking local mode:', error);
      return false;
    }
  }

  /**
   * Mendapatkan semua URL yang aktif (domain dan local jika keduanya aktif)
   */
  static async getAllActiveUrls(): Promise<string[]> {
    try {
      const urls: string[] = [];
      const domainModeEnabled = await this.isDomainModeEnabled();
      const localModeEnabled = await this.isLocalModeEnabled();
      const domainUrl = await this.getDomainUrl();
      const localUrl = await this.getLocalUrl();

      if (domainModeEnabled && domainUrl) {
        urls.push(domainUrl);
      }

      if (localModeEnabled && localUrl) {
        urls.push(localUrl);
      }

      // Jika tidak ada yang aktif, return fallback
      if (urls.length === 0) {
        urls.push(localUrl || 'http://localhost:3000');
      }

      return urls;
    } catch (error) {
      console.error('[UrlConfigService] Error getting all active URLs:', error);
      return ['http://localhost:3000'];
    }
  }
}



