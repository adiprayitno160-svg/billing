import { PppoeSecret, PppoeActiveConnection, PppProfile } from '../mikrotikService';
import { getMikrotikConfig } from '../../utils/mikrotikConfigHelper';
import { mikrotikPool } from '../MikroTikConnectionPool';

export interface MikrotikConfig {
  host: string;
  username: string;
  password: string;
  port?: number;
}

export interface MikrotikUser {
  id: string;
  name: string;
  password: string;
  profile: string;
  comment?: string;
}

export interface MikrotikAddressList {
  id: string;
  address: string;
  list: string;
  comment?: string;
}

export interface MikrotikProfile {
  id: string;
  name: string;
  localAddress?: string;
  remoteAddress?: string;
  rateLimit?: string;
  comment?: string;
}

export class MikrotikService {
  private static instance: MikrotikService | null = null;
  private config: MikrotikConfig;

  constructor(config: MikrotikConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance of MikrotikService
   * Loads config from database automatically
   */
  static async getInstance(): Promise<MikrotikService> {
    const config = await getMikrotikConfig();

    if (!config) {
      throw new Error('MikroTik configuration not found. Please configure in Settings > MikroTik.');
    }

    return new MikrotikService({
      host: config.host,
      username: config.username,
      password: config.password,
      port: config.port || config.api_port || 8728
    });
  }

  private getPoolConfig() {
    return {
      host: this.config.host,
      port: this.config.port || 8728,
      username: this.config.username,
      password: this.config.password
    };
  }

  /**
   * Test koneksi ke Mikrotik
   */
  async testConnection(): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/system/identity/print', [], 'identity', 10000);
      return true;
    } catch (error) {
      console.error('Mikrotik connection test failed:', error);
      return false;
    }
  }

  /**
   * Buat PPPoE user baru
   */
  async createPPPoEUser(userData: {
    name: string;
    password: string;
    profile: string;
    comment?: string;
  }): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/add', [
        `=name=${userData.name}`,
        `=password=${userData.password}`,
        `=profile=${userData.profile}`,
        `=comment=${userData.comment || `Customer: ${userData.name}`}`
      ]);
      return true;
    } catch (error) {
      console.error('Failed to create PPPoE user:', error);
      return false;
    }
  }

  /**
   * Update PPPoE user by ID
   */
  async updatePPPoEUser(userId: string, userData: {
    password?: string;
    profile?: string;
    comment?: string;
  }): Promise<boolean> {
    try {
      const updateData: any = {};
      if (userData.password) updateData.password = userData.password;
      if (userData.profile) updateData.profile = userData.profile;
      if (userData.comment) updateData.comment = userData.comment;

      const updateParams = Object.entries(updateData).map(([key, value]) => `=${key}=${value}`);
      await mikrotikPool.execute(this.getPoolConfig(), `/ppp/secret/set`, [`.id=${userId}`, ...updateParams]);
      return true;
    } catch (error) {
      console.error('Failed to update PPPoE user:', error);
      return false;
    }
  }

  /**
   * Update PPPoE user by username
   */
  async updatePPPoEUserByUsername(username: string, userData: {
    password?: string;
    profile?: string;
    comment?: string;
    disabled?: boolean;
  }): Promise<boolean> {
    try {
      // Find user by username
      const users = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [`?name=${username}`]);

      if (!Array.isArray(users) || users.length === 0) {
        console.error(`PPPoE user ${username} not found`);
        return false;
      }

      const userId = users[0]['.id'];

      // Build update params
      const updateParams: string[] = [`=.id=${userId}`];
      if (userData.password !== undefined) updateParams.push(`=password=${userData.password}`);
      if (userData.profile !== undefined) updateParams.push(`=profile=${userData.profile}`);
      if (userData.comment !== undefined) updateParams.push(`=comment=${userData.comment}`);
      if (userData.disabled !== undefined) updateParams.push(`=disabled=${userData.disabled ? 'yes' : 'no'}`);

      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/set', updateParams);
      console.log(`✅ Updated PPPoE user: ${username} (profile: ${userData.profile || 'unchanged'})`);
      return true;
    } catch (error) {
      console.error(`Failed to update PPPoE user ${username}:`, error);
      return false;
    }
  }

  /**
   * Disconnect active PPPoE user (force reconnect)
   */
  async disconnectPPPoEUser(username: string): Promise<boolean> {
    try {
      // Find active connection
      const connections = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/print', [`?name=${username}`]);

      if (!Array.isArray(connections) || connections.length === 0) {
        console.log(`⚠️  PPPoE user ${username} not currently connected`);
        return true;
      }

      // Disconnect all active connections for this user
      for (const conn of connections) {
        const connId = conn['.id'];
        if (connId) {
          await mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/remove', [`=.id=${connId}`]);
          console.log(`✅ Disconnected PPPoE user: ${username}`);
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to disconnect PPPoE user ${username}:`, error);
      return false;
    }
  }

  /**
   * Get PPPoE user by username
   */
  async getPPPoEUserByUsername(username: string): Promise<PppoeSecret | null> {
    try {
      const users = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [`?name=${username}`]);
      if (Array.isArray(users) && users.length > 0) {
        return users[0] as PppoeSecret;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get PPPoE user ${username}:`, error);
      return null;
    }
  }

  /**
   * Hapus PPPoE user
   */
  async deletePPPoEUser(userId: string): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/remove', [`.id=${userId}`]);
      return true;
    } catch (error) {
      console.error('Failed to delete PPPoE user:', error);
      return false;
    }
  }

  /**
   * Toggle status PPPoE user
   */
  async togglePPPoEUser(userId: string, disabled: boolean): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/set', [
        `.id=${userId}`,
        `=disabled=${disabled ? 'yes' : 'no'}`
      ]);
      return true;
    } catch (error) {
      console.error('Failed to toggle PPPoE user:', error);
      return false;
    }
  }

  /**
   * Dapatkan semua PPPoE users
   */
  async getPPPoEUsers(): Promise<MikrotikUser[]> {
    try {
      const result = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/secret/print', [], 'pppoe_users', 60000);
      return Array.isArray(result) ? result.map((user: PppoeSecret) => ({
        id: user['.id'],
        name: user.name || '',
        password: user.password || '',
        profile: user.profile || '',
        comment: user.comment || ''
      })) : [];
    } catch (error) {
      console.error('Failed to get PPPoE users:', error);
      return [];
    }
  }

  /**
   * Buat PPPoE profile baru
   */
  async createPPPoEProfile(profileData: {
    name: string;
    localAddress?: string;
    remoteAddress?: string;
    rateLimit?: string;
    comment?: string;
  }): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/profile/add', [
        `=name=${profileData.name}`,
        `=local-address=${profileData.localAddress || ''}`,
        `=remote-address=${profileData.remoteAddress || ''}`,
        `=rate-limit=${profileData.rateLimit || ''}`,
        `=comment=${profileData.comment || `Profile: ${profileData.name}`}`
      ]);
      return true;
    } catch (error) {
      console.error('Failed to create PPPoE profile:', error);
      return false;
    }
  }

  /**
   * Dapatkan semua PPPoE profiles
   */
  async getPPPoEProfiles(): Promise<MikrotikProfile[]> {
    try {
      const result = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/profile/print', [], 'pppoe_profiles', 60000);
      return Array.isArray(result) ? result.map((profile: PppProfile) => ({
        id: profile['.id'],
        name: profile.name,
        localAddress: profile['local-address'],
        remoteAddress: profile['remote-address'],
        rateLimit: profile['rate-limit'],
        comment: profile.comment
      })) : [];
    } catch (error) {
      console.error('Failed to get PPPoE profiles:', error);
      return [];
    }
  }

  /**
   * Tambah IP ke address list
   */
  async addToAddressList(addressData: {
    address: string;
    list: string;
    comment?: string;
  }): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/add', [
        `=address=${addressData.address}`,
        `=list=${addressData.list}`,
        `=comment=${addressData.comment || `Customer IP: ${addressData.address}`}`
      ]);
      return true;
    } catch (error) {
      console.error('Failed to add to address list:', error);
      return false;
    }
  }

  /**
   * Hapus IP dari address list
   */
  async removeFromAddressList(addressId: string): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`.id=${addressId}`]);
      return true;
    } catch (error) {
      console.error('Failed to remove from address list:', error);
      return false;
    }
  }

  /**
   * Dapatkan semua address list entries
   */
  async getAddressList(): Promise<MikrotikAddressList[]> {
    try {
      const result = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [], 'address_list', 60000);
      return Array.isArray(result) ? result.map((addr: any) => ({
        id: addr['.id'],
        address: addr.address,
        list: addr.list,
        comment: addr.comment
      })) : [];
    } catch (error) {
      console.error('Failed to get address list:', error);
      throw error;
    }
  }

  /**
   * Dapatkan active PPPoE sessions
   */
  async getActivePPPoESessions(): Promise<PppoeActiveConnection[]> {
    try {
      const result = await mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/print', [], 'active_sessions', 30000);
      return Array.isArray(result) ? result as PppoeActiveConnection[] : [];
    } catch (error) {
      console.error('Failed to get active PPPoE sessions:', error);
      return [];
    }
  }

  /**
   * Disconnect PPPoE session
   */
  async disconnectPPPoESession(sessionId: string): Promise<boolean> {
    try {
      await mikrotikPool.execute(this.getPoolConfig(), '/ppp/active/remove', [`.id=${sessionId}`]);
      return true;
    } catch (error) {
      console.error('Failed to disconnect PPPoE session:', error);
      return false;
    }
  }

  /**
   * Bulk create PPPoE users
   */
  async bulkCreatePPPoEUsers(users: Array<{
    name: string;
    password: string;
    profile: string;
    comment?: string;
  }>): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const result = await this.createPPPoEUser(user);
        if (result) {
          success++;
        } else {
          failed++;
          errors.push(`Failed to create user: ${user.name}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error creating user ${user.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Bulk add to address list
   */
  async bulkAddToAddressList(addresses: Array<{
    address: string;
    list: string;
    comment?: string;
  }>): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const addr of addresses) {
      try {
        const result = await this.addToAddressList(addr);
        if (result) {
          success++;
        } else {
          failed++;
          errors.push(`Failed to add address: ${addr.address}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error adding address ${addr.address}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }
}