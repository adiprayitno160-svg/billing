import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

export class SettingsService {
    /**
     * Get setting value by key
     */
    static async get(key: string, defaultValue: string = ''): Promise<string> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key]
            );
            return rows.length > 0 ? rows[0].setting_value : defaultValue;
        } catch (error) {
            console.warn(`Failed to get setting ${key}, using default:`, error);
            return defaultValue;
        }
    }

    /**
     * Set setting value
     */
    static async set(key: string, value: string, description?: string): Promise<void> {
        try {
            if (description) {
                await databasePool.query(
                    'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, description = ?',
                    [key, value, description, value, description]
                );
            } else {
                await databasePool.query(
                    'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [key, value, value]
                );
            }
        } catch (error) {
            console.error(`Failed to set setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get boolean setting
     */
    static async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
        const val = await this.get(key, defaultValue ? '1' : '0');
        return val === '1' || val === 'true';
    }

    /**
     * Get number setting
     */
    static async getNumber(key: string, defaultValue: number = 0): Promise<number> {
        const val = await this.get(key, defaultValue.toString());
        return parseFloat(val);
    }

    /**
     * Get all settings
     */
    static async getAll(): Promise<any> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>('SELECT * FROM system_settings');
            const settings: any = {};
            rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            return settings;
        } catch (error) {
            return {};
        }
    }
}
