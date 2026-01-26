import { databasePool } from '../../db/pool';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface StaticIPStatus {
  ipAddress: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  area?: string;
  isReachable: boolean;
  lastChecked: Date;
  responseTime?: number; // in milliseconds
}

export class StaticIPMonitoringService {
  /**
   * Check reachability of static IP addresses
   * This method pings the IP addresses assigned to static IP customers
   */
  async checkStaticIPConnectivity(): Promise<StaticIPStatus[]> {
    try {
      // Get all customers with static IP
      const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          c.static_ip as ipAddress,
          a.name as area
        FROM customers c
        LEFT JOIN ftth_areas a ON c.area_id = a.id
        WHERE c.connection_type = 'static_ip' AND c.status = 'active'
      `;

      const [results] = await databasePool.query(query);
      const customers = results as any[];

      const statuses: StaticIPStatus[] = [];

      // Check connectivity for each static IP
      for (const customer of customers) {
        const status = await this.pingIPAddress(customer.ipAddress);
        statuses.push({
          ipAddress: customer.ipAddress,
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          area: customer.area,
          isReachable: status.isReachable,
          lastChecked: new Date(),
          responseTime: status.responseTime
        });
      }

      return statuses;
    } catch (error) {
      console.error('Error checking Static IP connectivity:', error);
      throw error;
    }
  }

  /**
   * Ping an IP address to check if it's reachable
   */
  private async pingIPAddress(ipAddress: string): Promise<{ isReachable: boolean; responseTime?: number }> {
    if (!ipAddress) {
      return { isReachable: false };
    }

    try {
      // Using ping command - works on both Windows and Linux
      const command = process.platform === 'win32'
        ? `ping -n 1 -w 3000 ${ipAddress}`  // Windows ping command
        : `ping -c 1 -W 3 ${ipAddress}`;    // Linux/Unix ping command

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command);
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // Check if ping was successful
      if (stderr && stderr.trim() !== '') {
        return { isReachable: false };
      }

      // On Windows, "TTL=" indicates a successful ping
      // On Linux, successful ping will have output
      const isSuccessful =
        (process.platform === 'win32' && stdout.includes('TTL=')) ||
        (process.platform !== 'win32' && stdout.includes('bytes from'));

      return {
        isReachable: isSuccessful,
        responseTime: isSuccessful ? responseTime : undefined
      };
    } catch (error) {
      // Ping failed
      return { isReachable: false };
    }
  }

  /**
   * Alternative method to check connectivity using TCP connection
   * This might be more reliable than ping in some networks
   */
  async checkTCPConnectivity(ipAddress: string, port: number = 80): Promise<{ isReachable: boolean; responseTime?: number }> {
    if (!ipAddress) {
      return { isReachable: false };
    }

    try {
      const net = await import('net');
      return new Promise((resolve) => {
        const client = new net.Socket();
        const startTime = Date.now();

        client.setTimeout(3000); // 3 second timeout

        client.connect(port, ipAddress, () => {
          const endTime = Date.now();
          client.destroy();
          resolve({
            isReachable: true,
            responseTime: endTime - startTime
          });
        });

        client.on('error', () => {
          client.destroy();
          resolve({ isReachable: false });
        });

        client.on('timeout', () => {
          client.destroy();
          resolve({ isReachable: false });
        });
      });
    } catch (error) {
      console.error(`Error checking TCP connectivity to ${ipAddress}:${port}`, error);
      return { isReachable: false };
    }
  }

  /**
   * Get static IP status for a specific customer
   */
  async getCustomerStaticIPStatus(customerId: number): Promise<StaticIPStatus | null> {
    try {
      const query = `
        SELECT 
          c.id as customerId,
          c.name as customerName,
          c.phone as customerPhone,
          c.static_ip as ipAddress,
          a.name as area
        FROM customers c
        LEFT JOIN ftth_areas a ON c.area_id = a.id
        WHERE c.id = ? AND c.connection_type = 'static_ip'
      `;

      const [results] = await databasePool.query(query, [customerId]);
      const customer = (results as any[])[0];

      if (!customer) {
        return null;
      }

      const status = await this.pingIPAddress(customer.ipAddress);

      return {
        ipAddress: customer.ipAddress,
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        area: customer.area,
        isReachable: status.isReachable,
        lastChecked: new Date(),
        responseTime: status.responseTime
      };
    } catch (error) {
      console.error('Error getting customer Static IP status:', error);
      return null;
    }
  }

  /**
   * Bulk update customer connection status in database
   */
  async updateCustomerConnectionStatus(statuses: StaticIPStatus[]): Promise<void> {
    try {
      const conn = await databasePool.getConnection();
      try {
        await conn.beginTransaction();

        for (const status of statuses) {
          // Update the last connection status in the customer record
          await conn.execute(`
            UPDATE customers 
            SET 
              is_connected = ?,
              last_connection = ?,
              response_time = ?,
              updated_at = NOW()
            WHERE id = ?
          `, [
            status.isReachable ? 1 : 0,
            status.lastChecked,
            status.responseTime,
            status.customerId
          ]);
        }

        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Error updating customer connection status:', error);
      throw error;
    }
  }
}