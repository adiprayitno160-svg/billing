import { mikrotikPool } from '../MikroTikConnectionPool';

/**
 * Service untuk manage Mikrotik Address List
 * Digunakan untuk redirect & firewall rules
 * REFACTORED TO USE GLOBAL CONNECTION POOL
 */

interface MikrotikConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class MikrotikAddressListService {
  private config: MikrotikConfig;

  constructor(config: MikrotikConfig) {
    this.config = config;
  }

  private getPoolConfig() {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password
    };
  }

  /**
   * Add IP address to address list
   */
  async addToAddressList(
    listName: string,
    ipAddress: string,
    comment?: string
  ): Promise<boolean> {
    try {
      console.log(`[AddressList] Adding ${ipAddress} to ${listName} via pool`);

      // Normalize IP address
      let normalizedIP = ipAddress.trim();
      if (normalizedIP.includes('/')) {
        normalizedIP = normalizedIP.split('/')[0].trim();
      }

      // Check if already exists (using cache if possible)
      const existing = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${normalizedIP}`
      ]);

      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`[AddressList] IP ${normalizedIP} already exists in ${listName}`);
        return true;
      }

      await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/add', [
        `=list=${listName}`,
        `=address=${normalizedIP}`,
        `=comment=${comment || `Added by billing at ${new Date().toISOString()}`}`
      ]);

      console.log(`✅ Successfully added ${normalizedIP} to address-list: ${listName}`);
      return true;
    } catch (error: any) {
      console.error(`[AddressList] Error adding to list:`, error.message);
      return false;
    }
  }

  /**
   * Remove IP address from address list
   */
  async removeFromAddressList(
    listName: string,
    ipAddress: string
  ): Promise<boolean> {
    try {
      // Normalize IP
      let normalizedIP = ipAddress.trim();
      if (normalizedIP.includes('/')) {
        normalizedIP = normalizedIP.split('/')[0].trim();
      }

      const entries = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${normalizedIP}`
      ]);

      if (!Array.isArray(entries) || entries.length === 0) {
        return true;
      }

      for (const entry of entries) {
        await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
      }

      return true;
    } catch (error: any) {
      console.error(`[AddressList] Error removing from list:`, error.message);
      return false;
    }
  }

  /**
   * Move IP from one address list to another
   */
  async moveToAddressList(
    ipAddress: string,
    fromList: string,
    toList: string,
    comment?: string
  ): Promise<boolean> {
    await this.removeFromAddressList(fromList, ipAddress);
    return await this.addToAddressList(toList, ipAddress, comment);
  }

  /**
   * Check if IP exists in address list
   */
  async isInAddressList(
    listName: string,
    ipAddress: string
  ): Promise<boolean> {
    try {
      let normalizedIP = ipAddress.trim();
      if (normalizedIP.includes('/')) normalizedIP = normalizedIP.split('/')[0].trim();

      const entries = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${normalizedIP}`
      ], `addresslist:${listName}:${normalizedIP}`, 60000);

      return Array.isArray(entries) && entries.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all IPs in address list
   */
  async getAddressListEntries(listName: string): Promise<any[]> {
    try {
      const result = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
        `?list=${listName}`
      ], `addresslist:${listName}`, 30000);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear all entries from address list
   */
  async clearAddressList(listName: string): Promise<boolean> {
    try {
      const entries = await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/print', [
        `?list=${listName}`
      ]);

      if (Array.isArray(entries)) {
        for (const entry of entries) {
          await mikrotikPool.execute(this.getPoolConfig(), '/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default MikrotikAddressListService;
