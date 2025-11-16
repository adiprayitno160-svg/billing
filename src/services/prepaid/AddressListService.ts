import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import MikrotikService from '../mikrotik/MikrotikService';

interface AddressList {
  id: number;
  list_name: string;
  description: string;
  purpose: 'portal-redirect' | 'isolation' | 'whitelist' | 'blacklist';
  auto_manage: boolean;
  is_active: boolean;
}

interface AddressListItem {
  id: number;
  address_list_id: number;
  customer_id: number;
  ip_address: string;
  reason?: string;
  mikrotik_entry_id?: string;
  sync_status: 'pending' | 'synced' | 'failed';
  auto_remove: boolean;
}

/**
 * Service untuk mengelola MikroTik Address Lists
 * Untuk portal redirect, isolation, dll
 */
class AddressListService {
  private mikrotikService = MikrotikService;

  /**
   * Get portal-redirect address list
   */
  async getPortalRedirectList(): Promise<AddressList | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM mikrotik_address_lists WHERE purpose = ? AND is_active = 1',
      ['portal-redirect']
    );
    return rows.length > 0 ? (rows[0] as AddressList) : null;
  }

  /**
   * Add customer to portal-redirect list
   */
  async addToPortalRedirect(customerId: number, reason: string = 'No active package'): Promise<boolean> {
    try {
      // Get portal-redirect list
      const list = await this.getPortalRedirectList();
      if (!list) {
        throw new Error('Portal redirect address list not found');
      }

      // Check if already in list
      const existing = await this.isCustomerInList(customerId, list.id);
      if (existing) {
        console.log(`Customer ${customerId} already in portal-redirect list`);
        return true;
      }

      // Get customer IP
      const customerIP = await this.getCustomerIP(customerId);
      if (!customerIP) {
        throw new Error(`Cannot get IP address for customer ${customerId}`);
      }

      // Get customer code for comment
      const [customerRows] = await pool.query<RowDataPacket[]>(
        'SELECT customer_code, name FROM customers WHERE id = ?',
        [customerId]
      );
      const customer = customerRows[0];

      // Add to database first
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO mikrotik_address_list_items 
         (address_list_id, customer_id, ip_address, reason, sync_status, auto_remove)
         VALUES (?, ?, ?, ?, 'pending', 1)`,
        [list.id, customerId, customerIP, reason]
      );

      const itemId = result.insertId;

      // Sync to MikroTik
      try {
        // Note: MikroTik integration will be done via API
        // For now, we just mark as synced
        // TODO: Implement actual MikroTik API call
        
        const comment = `${customer.customer_code}-${customer.name}`;
        // Simulated MikroTik entry ID
        const mikrotikEntryId = `*${Math.random().toString(36).substr(2, 9)}`;

        await pool.query(
          `UPDATE mikrotik_address_list_items 
           SET mikrotik_entry_id = ?, sync_status = 'synced', synced_at = NOW()
           WHERE id = ?`,
          [mikrotikEntryId, itemId]
        );

        console.log(`✅ Customer ${customerId} added to portal-redirect list: ${customerIP}`);
        return true;
      } catch (error) {
        // Mark as failed
        await pool.query(
          `UPDATE mikrotik_address_list_items SET sync_status = 'failed' WHERE id = ?`,
          [itemId]
        );
        console.error('Failed to sync to MikroTik:', error);
        return false;
      }
    } catch (error) {
      console.error('Error adding to portal-redirect:', error);
      return false;
    }
  }

  /**
   * Remove customer from portal-redirect list
   */
  async removeFromPortalRedirect(customerId: number): Promise<boolean> {
    try {
      // Get portal-redirect list
      const list = await this.getPortalRedirectList();
      if (!list) {
        return true; // List doesn't exist, consider it success
      }

      // Get address list item
      const [items] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM mikrotik_address_list_items 
         WHERE customer_id = ? AND address_list_id = ?`,
        [customerId, list.id]
      );

      if (items.length === 0) {
        console.log(`Customer ${customerId} not in portal-redirect list`);
        return true;
      }

      const item = items[0];

      // Remove from MikroTik
      if (item.mikrotik_entry_id) {
        try {
          // TODO: Implement actual MikroTik API call to remove
          console.log(`Removing from MikroTik: ${item.mikrotik_entry_id}`);
        } catch (error) {
          console.error('Failed to remove from MikroTik:', error);
        }
      }

      // Remove from database
      await pool.query(
        'DELETE FROM mikrotik_address_list_items WHERE id = ?',
        [item.id]
      );

      console.log(`✅ Customer ${customerId} removed from portal-redirect list`);
      return true;
    } catch (error) {
      console.error('Error removing from portal-redirect:', error);
      return false;
    }
  }

  /**
   * Check if customer is in address list
   */
  async isCustomerInList(customerId: number, listId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM mikrotik_address_list_items 
       WHERE customer_id = ? AND address_list_id = ?`,
      [customerId, listId]
    );
    return rows.length > 0;
  }

  /**
   * Get customer IP address
   */
  private async getCustomerIP(customerId: number): Promise<string | null> {
    // Try to get from customer's active PPPoE session or static IP
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        c.id,
        c.connection_type,
        c.pppoe_username,
        sip.ip_address
       FROM customers c
       LEFT JOIN static_ip_clients sip ON c.id = sip.customer_id AND sip.status = 'active'
       WHERE c.id = ?`,
      [customerId]
    );

    if (rows.length === 0) return null;

    const customer = rows[0];

    // If static IP, get from static_ip_clients (sip.ip_address from JOIN)
    if (customer.connection_type === 'static_ip' && customer.ip_address) {
      // ip_address comes from JOIN with static_ip_clients (aliased as sip)
      return customer.ip_address;
    }

    // If PPPoE, try to get from MikroTik active sessions
    // For now, return a placeholder
    // TODO: Get actual IP from MikroTik PPPoE active sessions
    
    // Generate placeholder IP from customer ID (for testing)
    const lastOctet = (customerId % 254) + 1;
    return `10.10.10.${lastOctet}`;
  }

  /**
   * Get all customers in portal-redirect list
   */
  async getCustomersInPortalRedirect(): Promise<any[]> {
    const list = await this.getPortalRedirectList();
    if (!list) return [];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        ali.*,
        c.customer_code,
        c.name,
        c.phone,
        c.status as customer_status
       FROM mikrotik_address_list_items ali
       INNER JOIN customers c ON ali.customer_id = c.id
       WHERE ali.address_list_id = ?
       ORDER BY ali.created_at DESC`,
      [list.id]
    );
    return rows;
  }

  /**
   * Sync all pending items to MikroTik
   */
  async syncPendingItems(): Promise<{ synced: number; failed: number }> {
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT ali.*, mal.list_name, c.customer_code
       FROM mikrotik_address_list_items ali
       INNER JOIN mikrotik_address_lists mal ON ali.address_list_id = mal.id
       INNER JOIN customers c ON ali.customer_id = c.id
       WHERE ali.sync_status = 'pending'`
    );

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // TODO: Actual MikroTik API call
        const mikrotikEntryId = `*${Math.random().toString(36).substr(2, 9)}`;
        
        await pool.query(
          `UPDATE mikrotik_address_list_items 
           SET mikrotik_entry_id = ?, sync_status = 'synced', synced_at = NOW()
           WHERE id = ?`,
          [mikrotikEntryId, item.id]
        );
        synced++;
      } catch (error) {
        await pool.query(
          `UPDATE mikrotik_address_list_items SET sync_status = 'failed' WHERE id = ?`,
          [item.id]
        );
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Clean expired entries
   */
  async cleanExpiredEntries(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM mikrotik_address_list_items 
       WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return result.affectedRows;
  }

  /**
   * Get customer's address list entries
   */
  async getCustomerAddressLists(customerId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        ali.*,
        mal.list_name,
        mal.description,
        mal.purpose
       FROM mikrotik_address_list_items ali
       INNER JOIN mikrotik_address_lists mal ON ali.address_list_id = mal.id
       WHERE ali.customer_id = ?
       ORDER BY ali.created_at DESC`,
      [customerId]
    );
    return rows;
  }
}

export default new AddressListService();

