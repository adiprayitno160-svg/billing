import { databasePool } from '../../db/pool';

export interface OltData {
    id: number;
    name: string;
    ip_address: string;
    location: string;
    status: string;
    total_ports: number;
    used_ports: number;
    description?: string;
    line_cards?: number;
}

export class OltService {
    static async listOlts(): Promise<OltData[]> {
        try {
            const [rows] = await databasePool.query(`
                SELECT * FROM ftth_olt 
                ORDER BY id DESC
            `);
            return rows as OltData[];
        } catch (error) {
            console.error('Error listing OLTs:', error);
            throw error;
        }
    }

    static async getOltById(id: number): Promise<OltData | null> {
        try {
            const [rows] = await databasePool.query(`
                SELECT * FROM ftth_olt WHERE id = ?
            `, [id]);
            
            if (Array.isArray(rows) && rows.length > 0) {
                return rows[0] as OltData;
            }
            return null;
        } catch (error) {
            console.error('Error getting OLT by ID:', error);
            throw error;
        }
    }
}
