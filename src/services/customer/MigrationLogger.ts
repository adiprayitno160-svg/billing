/**
 * Migration Logger Service
 * Sistem logging yang proper untuk migration dengan log ke file dan database
 */

import fs from 'fs';
import path from 'path';
import pool from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogContext {
  customerId?: number;
  customerName?: string;
  adminId?: number;
  migrationId?: number;
  step?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
  };
}

class MigrationLogger {
  private logDir: string;
  private logFile: string;
  private maxLogFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxBackupFiles: number = 5;

  constructor() {
    // Setup log directory
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'migration.log');
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Ensure migration_logs table exists
   */
  private async ensureMigrationLogsTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migration_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_level VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          customer_id INT NULL,
          customer_name VARCHAR(255) NULL,
          admin_id INT NULL,
          migration_id INT NULL,
          step VARCHAR(100) NULL,
          context JSON NULL,
          error_message TEXT NULL,
          error_stack TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_migration_id (migration_id),
          INDEX idx_log_level (log_level),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      console.error('[MigrationLogger] Error creating migration_logs table:', error);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogFile(): void {
    try {
      if (!fs.existsSync(this.logFile)) {
        return;
      }

      const stats = fs.statSync(this.logFile);
      if (stats.size >= this.maxLogFileSize) {
        // Find next backup number
        let backupNum = 1;
        while (fs.existsSync(`${this.logFile}.${backupNum}`)) {
          backupNum++;
        }

        // Rotate existing backups
        for (let i = this.maxBackupFiles - 1; i >= 1; i--) {
          const oldBackup = `${this.logFile}.${i}`;
          const newBackup = `${this.logFile}.${i + 1}`;
          if (fs.existsSync(oldBackup)) {
            if (i + 1 > this.maxBackupFiles) {
              fs.unlinkSync(oldBackup); // Delete if exceeds max
            } else {
              fs.renameSync(oldBackup, newBackup);
            }
          }
        }

        // Rotate current log
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('[MigrationLogger] Error rotating log file:', error);
    }
  }

  /**
   * Format log entry for file
   */
  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;
    
    let logLine = `[${timestamp}] [${level}] ${message}`;
    
    if (context) {
      const contextStr = Object.entries(context)
        .filter(([key]) => !['error'].includes(key))
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      if (contextStr) {
        logLine += ` | ${contextStr}`;
      }
    }
    
    if (error) {
      logLine += ` | ERROR: ${error.message}`;
      if (error.stack) {
        logLine += `\n${error.stack}`;
      }
    }
    
    return logLine;
  }

  /**
   * Write log to file
   */
  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogFile();
      
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('[MigrationLogger] Error writing to log file:', error);
    }
  }

  /**
   * Write log to database
   */
  private async writeToDatabase(entry: LogEntry): Promise<void> {
    try {
      await this.ensureMigrationLogsTable();
      
      const { level, message, context, error } = entry;
      
      await pool.query(
        `INSERT INTO migration_logs (
          log_level, message, customer_id, customer_name, admin_id, 
          migration_id, step, context, error_message, error_stack, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          level,
          message,
          context?.customerId || null,
          context?.customerName || null,
          context?.adminId || null,
          context?.migrationId || null,
          context?.step || null,
          context ? JSON.stringify(context) : null,
          error?.message || null,
          error?.stack || null
        ]
      );
    } catch (error) {
      // Don't throw - logging should not break the application
      console.error('[MigrationLogger] Error writing to database:', error);
    }
  }

  /**
   * Write log to console
   */
  private writeToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context, error } = entry;
    
    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: '✅',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌'
    }[level] || '📝';
    
    let consoleMessage = `${emoji} [${level}] ${message}`;
    
    if (context?.customerId) {
      consoleMessage += ` | Customer: ${context.customerName || 'ID:' + context.customerId} (${context.customerId})`;
    }
    
    if (context?.step) {
      consoleMessage += ` | Step: ${context.step}`;
    }
    
    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage);
        break;
      case LogLevel.INFO:
        console.log(consoleMessage);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage);
        break;
      case LogLevel.ERROR:
        console.error(consoleMessage);
        if (error) {
          console.error('Error details:', error.message);
          if (error.stack) {
            console.error(error.stack);
          }
        }
        break;
    }
  }

  /**
   * Core log method
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    };

    // Write to all destinations
    this.writeToConsole(entry);
    this.writeToFile(entry);
    await this.writeToDatabase(entry);
  }

  /**
   * Log DEBUG message
   */
  async debug(message: string, context?: LogContext): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log INFO message
   */
  async info(message: string, context?: LogContext): Promise<void> {
    await this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log WARN message
   */
  async warn(message: string, context?: LogContext): Promise<void> {
    await this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log ERROR message
   */
  async error(message: string, error?: Error, context?: LogContext): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Start migration log
   */
  async startMigration(
    direction: 'toPrepaid' | 'toPostpaid',
    customerId: number,
    customerName: string,
    adminId?: number
  ): Promise<number> {
    const message = `🚀 START MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'}`;
    await this.info(message, {
      customerId,
      customerName,
      adminId,
      step: 'START',
      direction
    });

    // Return a migration ID (timestamp-based for uniqueness)
    return Date.now();
  }

  /**
   * End migration log
   */
  async endMigration(
    migrationId: number,
    direction: 'toPrepaid' | 'toPostpaid',
    customerId: number,
    customerName: string,
    success: boolean,
    result?: {
      message?: string;
      portal_id?: string;
      error?: string;
    }
  ): Promise<void> {
    const message = success 
      ? `✅ MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'} COMPLETED SUCCESSFULLY`
      : `❌ MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'} FAILED`;

    const context: LogContext = {
      customerId,
      customerName,
      migrationId,
      step: 'END',
      direction,
      success
    };

    if (result) {
      if (result.portal_id) context.portal_id = result.portal_id;
      if (result.error) context.error_message = result.error;
    }

    if (success) {
      await this.info(message + (result?.message ? ` | ${result.message}` : ''), context);
    } else {
      await this.error(message + (result?.error ? ` | ${result.error}` : ''), undefined, context);
    }
  }

  /**
   * Log migration step
   */
  async step(
    step: string,
    message: string,
    customerId: number,
    customerName?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.info(message, {
      customerId,
      customerName,
      step,
      ...metadata
    });
  }

  /**
   * Log database operation
   */
  async dbOperation(
    operation: string,
    customerId: number,
    customerName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.info(`Database: ${operation}`, {
      customerId,
      customerName,
      step: 'DATABASE',
      operation,
      ...details
    });
  }

  /**
   * Log Mikrotik operation
   */
  async mikrotikOperation(
    operation: string,
    customerId: number,
    customerName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.info(`Mikrotik: ${operation}`, {
      customerId,
      customerName,
      step: 'MIKROTIK',
      operation,
      ...details
    });
  }

  /**
   * Get migration logs for a customer
   */
  async getCustomerLogs(customerId: number, limit: number = 50): Promise<any[]> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM migration_logs 
         WHERE customer_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [customerId, limit]
      );
      return rows;
    } catch (error) {
      console.error('[MigrationLogger] Error getting customer logs:', error);
      return [];
    }
  }

  /**
   * Get migration logs for a migration ID
   */
  async getMigrationLogs(migrationId: number): Promise<any[]> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM migration_logs 
         WHERE migration_id = ? 
         ORDER BY created_at ASC`,
        [migrationId]
      );
      return rows;
    } catch (error) {
      console.error('[MigrationLogger] Error getting migration logs:', error);
      return [];
    }
  }

  /**
   * Get recent migration logs
   */
  async getRecentLogs(limit: number = 100, level?: LogLevel): Promise<any[]> {
    try {
      let query = `SELECT * FROM migration_logs `;
      const params: any[] = [];
      
      if (level) {
        query += `WHERE log_level = ? `;
        params.push(level);
      }
      
      query += `ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
      
      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows;
    } catch (error) {
      console.error('[MigrationLogger] Error getting recent logs:', error);
      return [];
    }
  }
}

export default new MigrationLogger();

