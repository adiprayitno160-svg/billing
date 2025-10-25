import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface SpeedProfile {
  id: number;
  name: string;
  download_mbps: number;
  upload_mbps: number;
  burst_limit_mbps: number;
  burst_time_seconds: number;
  burst_threshold_mbps: number;
  priority: number;
  mikrotik_profile_name: string;
  is_active: boolean;
}

/**
 * Service untuk mengelola Speed Profiles
 * Includes MikroTik integration
 */
class SpeedProfileService {
  /**
   * Get all active speed profiles
   */
  async getAllActiveProfiles(): Promise<SpeedProfile[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM speed_profiles WHERE is_active = 1 ORDER BY download_mbps ASC'
    );
    return rows as SpeedProfile[];
  }

  /**
   * Get speed profile by ID
   */
  async getProfileById(profileId: number): Promise<SpeedProfile | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM speed_profiles WHERE id = ?',
      [profileId]
    );
    return rows.length > 0 ? (rows[0] as SpeedProfile) : null;
  }

  /**
   * Get speed profile by MikroTik profile name
   */
  async getProfileByMikrotikName(mikrotikName: string): Promise<SpeedProfile | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM speed_profiles WHERE mikrotik_profile_name = ?',
      [mikrotikName]
    );
    return rows.length > 0 ? (rows[0] as SpeedProfile) : null;
  }

  /**
   * Create new speed profile
   */
  async createProfile(data: {
    name: string;
    download_mbps: number;
    upload_mbps: number;
    burst_limit_mbps?: number;
    burst_time_seconds?: number;
    priority?: number;
  }): Promise<number> {
    const mikrotikProfileName = `${data.download_mbps}M-PREP`;
    
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO speed_profiles 
       (name, download_mbps, upload_mbps, burst_limit_mbps, burst_time_seconds, priority, mikrotik_profile_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.download_mbps,
        data.upload_mbps,
        data.burst_limit_mbps || 0,
        data.burst_time_seconds || 0,
        data.priority || 8,
        mikrotikProfileName
      ]
    );

    return result.insertId;
  }

  /**
   * Get speed profile for a package
   */
  async getProfileForPackage(packageId: number): Promise<SpeedProfile | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sp.* FROM speed_profiles sp
       INNER JOIN prepaid_packages pp ON sp.id = pp.speed_profile_id
       WHERE pp.id = ?`,
      [packageId]
    );
    return rows.length > 0 ? (rows[0] as SpeedProfile) : null;
  }

  /**
   * Get current speed for customer
   */
  async getCustomerCurrentSpeed(customerId: number): Promise<SpeedProfile | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sp.* FROM speed_profiles sp
       INNER JOIN prepaid_packages pp ON sp.id = pp.speed_profile_id
       INNER JOIN prepaid_package_subscriptions pps ON pp.id = pps.package_id
       WHERE pps.customer_id = ? AND pps.status = 'active'
       ORDER BY pps.created_at DESC
       LIMIT 1`,
      [customerId]
    );
    return rows.length > 0 ? (rows[0] as SpeedProfile) : null;
  }

  /**
   * Log speed change
   */
  async logSpeedChange(data: {
    customer_id: number;
    subscription_id?: number;
    old_speed_profile_id?: number;
    new_speed_profile_id: number;
    change_reason: 'purchase' | 'upgrade' | 'downgrade' | 'admin' | 'expired';
    changed_by?: number;
  }): Promise<void> {
    // Get speed details for logging
    let oldSpeed = null;
    let newSpeed = null;

    if (data.old_speed_profile_id) {
      const oldProfile = await this.getProfileById(data.old_speed_profile_id);
      oldSpeed = oldProfile ? `${oldProfile.download_mbps}/${oldProfile.upload_mbps} Mbps` : null;
    }

    const newProfile = await this.getProfileById(data.new_speed_profile_id);
    newSpeed = newProfile ? `${newProfile.download_mbps}/${newProfile.upload_mbps} Mbps` : null;

    await pool.query(
      `INSERT INTO customer_speed_history 
       (customer_id, subscription_id, old_speed_profile_id, new_speed_profile_id, old_speed_mbps, new_speed_mbps, change_reason, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.customer_id,
        data.subscription_id || null,
        data.old_speed_profile_id || null,
        data.new_speed_profile_id,
        oldSpeed,
        newSpeed,
        data.change_reason,
        data.changed_by || null
      ]
    );
  }

  /**
   * Format speed for display
   */
  formatSpeed(profile: SpeedProfile): string {
    if (profile.download_mbps === profile.upload_mbps) {
      return `${profile.download_mbps} Mbps`;
    }
    return `${profile.download_mbps}/${profile.upload_mbps} Mbps`;
  }

  /**
   * Get speed change history for customer
   */
  async getCustomerSpeedHistory(customerId: number, limit: number = 10): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        csh.*,
        old_sp.name as old_profile_name,
        new_sp.name as new_profile_name
       FROM customer_speed_history csh
       LEFT JOIN speed_profiles old_sp ON csh.old_speed_profile_id = old_sp.id
       LEFT JOIN speed_profiles new_sp ON csh.new_speed_profile_id = new_sp.id
       WHERE csh.customer_id = ?
       ORDER BY csh.created_at DESC
       LIMIT ?`,
      [customerId, limit]
    );
    return rows;
  }
}

export default new SpeedProfileService();

