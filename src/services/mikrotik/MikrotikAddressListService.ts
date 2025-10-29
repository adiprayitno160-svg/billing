import { RouterOSAPI } from 'node-routeros';
import MikrotikConnectionPool from './MikrotikConnectionPool';
import MikrotikCacheService from './MikrotikCacheService';

/**
 * Service untuk manage Mikrotik Address List
 * Digunakan untuk prepaid system: redirect & firewall rules
 * OPTIMIZED WITH CONNECTION POOL & CACHING
 */

interface MikrotikConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class MikrotikAddressListService {
  private config: MikrotikConfig;
  private static TIMEOUT = 3000; // 3 seconds (faster!)

  constructor(config: MikrotikConfig) {
    this.config = config;
  }

  /**
   * Add IP address to address list
   * @param listName - Name of address list (e.g., 'prepaid-no-package', 'prepaid-active')
   * @param ipAddress - IP address to add
   * @param comment - Optional comment
   */
  async addToAddressList(
    listName: string,
    ipAddress: string,
    comment?: string
  ): Promise<boolean> {
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      timeout: MikrotikAddressListService.TIMEOUT
    });

    try {
      await api.connect();

      // Check if already exists
      const existing = await api.write('/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${ipAddress}`
      ]);

      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`✅ IP ${ipAddress} already in list ${listName}`);
        return true;
      }

      // Add to address list
      const params = [
        `=list=${listName}`,
        `=address=${ipAddress}`,
        `=comment=${comment || `Added by billing system at ${new Date().toISOString()}`}`
      ];

      await api.write('/ip/firewall/address-list/add', params);
      console.log(`✅ Added ${ipAddress} to address-list: ${listName}`);
      
      // Clear cache for this list
      MikrotikCacheService.clearByPattern(`addresslist:${listName}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to add ${ipAddress} to address-list ${listName}:`, error);
      return false;
    } finally {
      api.close();
    }
  }

  /**
   * Remove IP address from address list
   * @param listName - Name of address list
   * @param ipAddress - IP address to remove
   */
  async removeFromAddressList(
    listName: string,
    ipAddress: string
  ): Promise<boolean> {
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      timeout: MikrotikAddressListService.TIMEOUT
    });

    try {
      await api.connect();

      // Find the entry
      const entries = await api.write('/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${ipAddress}`
      ]);

      if (!Array.isArray(entries) || entries.length === 0) {
        console.log(`⚠️  IP ${ipAddress} not found in list ${listName}`);
        return true; // Already not in list
      }

      // Remove all matching entries
      for (const entry of entries) {
        const id = entry['.id'];
        if (id) {
          await api.write('/ip/firewall/address-list/remove', [`=.id=${id}`]);
          console.log(`✅ Removed ${ipAddress} from address-list: ${listName}`);
        }
      }

      // Clear cache for this list
      MikrotikCacheService.clearByPattern(`addresslist:${listName}`);

      return true;
    } catch (error) {
      console.error(`❌ Failed to remove ${ipAddress} from address-list ${listName}:`, error);
      return false;
    } finally {
      api.close();
    }
  }

  /**
   * Move IP from one address list to another
   * @param ipAddress - IP address to move
   * @param fromList - Source list name
   * @param toList - Destination list name
   * @param comment - Optional comment
   */
  async moveToAddressList(
    ipAddress: string,
    fromList: string,
    toList: string,
    comment?: string
  ): Promise<boolean> {
    try {
      // Remove from old list
      await this.removeFromAddressList(fromList, ipAddress);
      
      // Add to new list
      await this.addToAddressList(toList, ipAddress, comment);
      
      console.log(`✅ Moved ${ipAddress} from ${fromList} to ${toList}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to move ${ipAddress} from ${fromList} to ${toList}:`, error);
      return false;
    }
  }

  /**
   * Check if IP exists in address list
   * @param listName - Name of address list
   * @param ipAddress - IP address to check
   */
  async isInAddressList(
    listName: string,
    ipAddress: string
  ): Promise<boolean> {
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      timeout: MikrotikAddressListService.TIMEOUT
    });

    try {
      await api.connect();

      const entries = await api.write('/ip/firewall/address-list/print', [
        `?list=${listName}`,
        `?address=${ipAddress}`
      ]);

      return Array.isArray(entries) && entries.length > 0;
    } catch (error) {
      console.error(`❌ Failed to check ${ipAddress} in address-list ${listName}:`, error);
      return false;
    } finally {
      api.close();
    }
  }

  /**
   * Get all IPs in address list (WITH AGGRESSIVE CACHING!)
   * @param listName - Name of address list
   */
  async getAddressListEntries(listName: string): Promise<any[]> {
    // Check cache first (INSTANT!)
    const cacheKey = `addresslist:${listName}`;
    const cached = MikrotikCacheService.get<any[]>(cacheKey);
    
    if (cached) {
      console.log(`[AddressList] Cache HIT for ${listName}`);
      return cached;
    }
    
    console.log(`[AddressList] Cache MISS for ${listName}, fetching from Mikrotik...`);
    
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      timeout: MikrotikAddressListService.TIMEOUT
    });

    try {
      await api.connect();

      const entries = await api.write('/ip/firewall/address-list/print', [
        `?list=${listName}`
      ]);

      const result = Array.isArray(entries) ? entries : [];
      
      // Cache the result for 3 minutes
      MikrotikCacheService.set(cacheKey, result, 180000); // 3 minutes
      
      console.log(`[AddressList] Cached ${result.length} entries for ${listName}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to get entries from address-list ${listName}:`, error);
      return [];
    } finally {
      api.close();
    }
  }

  /**
   * Clear all entries from address list
   * @param listName - Name of address list
   */
  async clearAddressList(listName: string): Promise<boolean> {
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      timeout: MikrotikAddressListService.TIMEOUT
    });

    try {
      await api.connect();

      const entries = await api.write('/ip/firewall/address-list/print', [
        `?list=${listName}`
      ]);

      if (!Array.isArray(entries) || entries.length === 0) {
        console.log(`✅ Address-list ${listName} already empty`);
        return true;
      }

      for (const entry of entries) {
        const id = entry['.id'];
        if (id) {
          await api.write('/ip/firewall/address-list/remove', [`=.id=${id}`]);
        }
      }

      // Clear cache for this list
      MikrotikCacheService.clearByPattern(`addresslist:${listName}`);

      console.log(`✅ Cleared all entries from address-list: ${listName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to clear address-list ${listName}:`, error);
      return false;
    } finally {
      api.close();
    }
  }
}

export default MikrotikAddressListService;

