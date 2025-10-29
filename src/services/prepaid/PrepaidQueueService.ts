/**
 * Prepaid Queue Service
 * Manages Mikrotik Queue Tree for Static IP prepaid customers
 * Reuses existing postpaid infrastructure (parent queues & mangle rules)
 */

import { RouterOSAPI } from 'node-routeros';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface MikrotikConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface QueueTreeParams {
  customerId: number;
  customerName: string;
  ipAddress: string;
  parentDownloadQueue: string;
  parentUploadQueue: string;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
}

interface QueueEntry {
  '.id': string;
  name: string;
  parent?: string;
  'max-limit'?: string;
  'packet-mark'?: string;
  disabled?: string;
}

export class PrepaidQueueService {
  private config: MikrotikConfig;

  constructor(config: MikrotikConfig) {
    this.config = config;
  }

  /**
   * Get active Mikrotik configuration from database
   */
  static async getMikrotikConfig(): Promise<MikrotikConfig | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT host, port, username, password FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (rows.length === 0) {
        return null;
      }

      return {
        host: rows[0].host,
        port: rows[0].port || 8728,
        username: rows[0].username,
        password: rows[0].password,
      };
    } catch (error) {
      console.error('[PrepaidQueueService] Error fetching Mikrotik config:', error);
      return null;
    }
  }

  /**
   * Get all parent queues from Mikrotik (for admin dropdown)
   */
  async getParentQueues(): Promise<{ download: string[]; upload: string[] }> {
    const connection = new RouterOSAPI({
      host: this.config.host,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port,
    });

    try {
      await connection.connect();

      // Get all queue tree entries
      const queues = (await connection.write('/queue/tree/print')) as QueueEntry[];

      // Filter parent queues (usually uppercase, no packet-mark)
      const downloadParents: string[] = [];
      const uploadParents: string[] = [];

      for (const queue of queues) {
        const name = queue.name || '';
        const hasPacketMark = queue['packet-mark'] !== undefined;

        // Parent queues usually don't have packet-mark and are uppercase
        if (!hasPacketMark && name === name.toUpperCase()) {
          if (name.includes('DOWNLOAD') || name.includes('DOWN')) {
            downloadParents.push(name);
          } else if (name.includes('UPLOAD') || name.includes('UP')) {
            uploadParents.push(name);
          }
        }
      }

      await connection.close();

      return {
        download: downloadParents.length > 0 ? downloadParents : ['DOWNLOAD ALL'],
        upload: uploadParents.length > 0 ? uploadParents : ['UPLOAD ALL'],
      };
    } catch (error) {
      console.error('[PrepaidQueueService] Error getting parent queues:', error);
      throw new Error('Failed to get parent queues from Mikrotik');
    }
  }

  /**
   * Create or update queue tree for prepaid customer
   * Reuses existing mangle rules from postpaid setup
   */
  async createOrUpdateQueue(params: QueueTreeParams): Promise<void> {
    const connection = new RouterOSAPI({
      host: this.config.host,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port,
    });

    try {
      await connection.connect();

      // Generate queue names (same as postpaid convention)
      const downloadQueueName = `${params.customerName}_DOWNLOAD`.replace(/\s+/g, '_');
      const uploadQueueName = `${params.customerName}_UPLOAD`.replace(/\s+/g, '_');

      // Packet marks (should match mangle rules)
      const downloadPacketMark = `pkt_${params.ipAddress.replace(/\./g, '_')}_download`;
      const uploadPacketMark = `pkt_${params.ipAddress.replace(/\./g, '_')}_upload`;

      // Speed limits (convert Mbps to bps with k suffix)
      const downloadLimit = `${params.downloadSpeedMbps}M`;
      const uploadLimit = `${params.uploadSpeedMbps}M`;

      // Check if download queue exists
      const downloadQueue = await this.findQueueByName(connection, downloadQueueName);
      
      if (downloadQueue) {
        // Update existing download queue
        console.log(`[PrepaidQueueService] Updating download queue: ${downloadQueueName}`);
        await connection.write('/queue/tree/set', [
          `=.id=${downloadQueue['.id']}`,
          `=max-limit=${downloadLimit}`,
          `=parent=${params.parentDownloadQueue}`,
        ]);
      } else {
        // Create new download queue
        console.log(`[PrepaidQueueService] Creating download queue: ${downloadQueueName}`);
        await connection.write('/queue/tree/add', [
          `=name=${downloadQueueName}`,
          `=parent=${params.parentDownloadQueue}`,
          `=packet-mark=${downloadPacketMark}`,
          `=max-limit=${downloadLimit}`,
          '=priority=8',
          '=queue=default',
        ]);
      }

      // Check if upload queue exists
      const uploadQueue = await this.findQueueByName(connection, uploadQueueName);

      if (uploadQueue) {
        // Update existing upload queue
        console.log(`[PrepaidQueueService] Updating upload queue: ${uploadQueueName}`);
        await connection.write('/queue/tree/set', [
          `=.id=${uploadQueue['.id']}`,
          `=max-limit=${uploadLimit}`,
          `=parent=${params.parentUploadQueue}`,
        ]);
      } else {
        // Create new upload queue
        console.log(`[PrepaidQueueService] Creating upload queue: ${uploadQueueName}`);
        await connection.write('/queue/tree/add', [
          `=name=${uploadQueueName}`,
          `=parent=${params.parentUploadQueue}`,
          `=packet-mark=${uploadPacketMark}`,
          `=max-limit=${uploadLimit}`,
          '=priority=8',
          '=queue=default',
        ]);
      }

      await connection.close();

      console.log(`[PrepaidQueueService] Queue setup complete for ${params.customerName}`);
    } catch (error) {
      console.error('[PrepaidQueueService] Error creating/updating queue:', error);
      throw new Error(`Failed to setup queue tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find queue by name
   */
  private async findQueueByName(connection: RouterOSAPI, queueName: string): Promise<QueueEntry | null> {
    try {
      const queues = (await connection.write('/queue/tree/print', [
        `?name=${queueName}`,
      ])) as QueueEntry[];

      return queues.length > 0 ? queues[0] : null;
    } catch (error) {
      console.error(`[PrepaidQueueService] Error finding queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Remove queue tree for customer (saat package expired)
   */
  async removeQueue(customerName: string): Promise<void> {
    const connection = new RouterOSAPI({
      host: this.config.host,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port,
    });

    try {
      await connection.connect();

      const downloadQueueName = `${customerName}_DOWNLOAD`.replace(/\s+/g, '_');
      const uploadQueueName = `${customerName}_UPLOAD`.replace(/\s+/g, '_');

      // Remove download queue
      const downloadQueue = await this.findQueueByName(connection, downloadQueueName);
      if (downloadQueue) {
        await connection.write('/queue/tree/remove', [`=.id=${downloadQueue['.id']}`]);
        console.log(`[PrepaidQueueService] Removed download queue: ${downloadQueueName}`);
      }

      // Remove upload queue
      const uploadQueue = await this.findQueueByName(connection, uploadQueueName);
      if (uploadQueue) {
        await connection.write('/queue/tree/remove', [`=.id=${uploadQueue['.id']}`]);
        console.log(`[PrepaidQueueService] Removed upload queue: ${uploadQueueName}`);
      }

      await connection.close();
    } catch (error) {
      console.error('[PrepaidQueueService] Error removing queue:', error);
      throw new Error('Failed to remove queue tree');
    }
  }

  /**
   * Check if mangle rules exist for customer IP
   * (Should exist from postpaid setup)
   */
  async checkMangleRules(ipAddress: string): Promise<boolean> {
    const connection = new RouterOSAPI({
      host: this.config.host,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port,
    });

    try {
      await connection.connect();

      // Check for download mangle
      const downloadMangle = await connection.write('/ip/firewall/mangle/print', [
        `?src-address=${ipAddress}`,
      ]);

      // Check for upload mangle
      const uploadMangle = await connection.write('/ip/firewall/mangle/print', [
        `?dst-address=${ipAddress}`,
      ]);

      await connection.close();

      const hasDownloadMangle = Array.isArray(downloadMangle) && downloadMangle.length > 0;
      const hasUploadMangle = Array.isArray(uploadMangle) && uploadMangle.length > 0;

      return hasDownloadMangle && hasUploadMangle;
    } catch (error) {
      console.error('[PrepaidQueueService] Error checking mangle rules:', error);
      return false;
    }
  }
}

export default PrepaidQueueService;

