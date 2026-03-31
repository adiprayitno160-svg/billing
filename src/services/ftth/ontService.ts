import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface OntData {
    id?: number;
    serial_number?: string;
    mac_address?: string;
    model?: string;
    customer_id?: number;
    olt_id?: number;
    odc_id?: number;
    odp_id?: number;
    olt_port?: string;
    status?: 'online' | 'offline' | 'warning' | 'unknown';
    location?: string;
    installed_date?: Date;
    notes?: string;
}

export class OntService {
    static async listOnts() {
        // Join with customers, olt, odc, odp for names
        const query = `
            SELECT nd.*, 
                   c.name as customer_name, 
                   olt.name as olt_name, 
                   odc.name as odc_name,
                   odp.name as odp_name
            FROM network_devices nd
            LEFT JOIN customers c ON nd.customer_id = c.id
            LEFT JOIN ftth_olt olt ON nd.olt_id = olt.id
            LEFT JOIN ftth_odc odc ON nd.odc_id = odc.id
            LEFT JOIN ftth_odp odp ON nd.odp_id = odp.id
            WHERE nd.device_type = 'ont'
            ORDER BY nd.created_at DESC
        `;
        const [rows] = await databasePool.query<RowDataPacket[]>(query);
        return rows;
    }

    static async getOntById(id: number) {
        const query = `
            SELECT nd.*, 
                   c.name as customer_name,
                   olt.name as olt_name,
                   odc.name as odc_name,
                   odp.name as odp_name
            FROM network_devices nd
            LEFT JOIN customers c ON nd.customer_id = c.id
            LEFT JOIN ftth_olt olt ON nd.olt_id = olt.id
            LEFT JOIN ftth_odc odc ON nd.odc_id = odc.id
            LEFT JOIN ftth_odp odp ON nd.odp_id = odp.id
            WHERE nd.device_type = 'ont' AND nd.id = ?
        `;
        const [rows] = await databasePool.query<RowDataPacket[]>(query, [id]);
        return rows[0] || null;
    }

    static async createOnt(data: OntData) {
        // Map OntData to network_devices columns
        // device_type = 'ont'
        // serial_number -> genieacs_serial (or create a mapping)
        // model, installed_date, notes -> metadata

        const metadata = JSON.stringify({
            model: data.model,
            installed_date: data.installed_date,
            notes: data.notes,
            olt_port: data.olt_port
        });

        const query = `
            INSERT INTO network_devices (
                device_type, name, mac_address, genieacs_serial, 
                customer_id, olt_id, odc_id, odp_id, 
                address, status, metadata
            ) VALUES (
                'ont', ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, ?
            )
        `;

        const name = `ONT-${data.serial_number || 'UNKNOWN'}`;
        const params = [
            name, data.mac_address || null, data.serial_number || null,
            data.customer_id || null, data.olt_id || null, data.odc_id || null, data.odp_id || null,
            data.location || null, data.status || 'offline', metadata
        ];

        const [result] = await databasePool.query<ResultSetHeader>(query, params);
        return result.insertId;
    }

    static async updateOnt(id: number, data: OntData) {
        // Fetch existing metadata to merge
        const existing = await this.getOntById(id);
        if (!existing) return false;

        let meta = existing.metadata || {};
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { }
        }

        meta = {
            ...meta,
            model: data.model !== undefined ? data.model : meta.model,
            installed_date: data.installed_date !== undefined ? data.installed_date : meta.installed_date,
            notes: data.notes !== undefined ? data.notes : meta.notes,
            olt_port: data.olt_port !== undefined ? data.olt_port : meta.olt_port
        };

        const query = `
            UPDATE network_devices SET
                mac_address = ?,
                genieacs_serial = ?,
                customer_id = ?,
                olt_id = ?,
                odc_id = ?,
                odp_id = ?,
                address = ?,
                status = ?,
                metadata = ?
            WHERE id = ? AND device_type = 'ont'
        `;

        const params = [
            data.mac_address, data.serial_number,
            data.customer_id, data.olt_id, data.odc_id, data.odp_id,
            data.location, data.status, JSON.stringify(meta),
            id
        ];

        const [result] = await databasePool.query<ResultSetHeader>(query, params);
        return result.affectedRows > 0;
    }

    static async deleteOnt(id: number) {
        const query = 'DELETE FROM network_devices WHERE id = ? AND device_type = "ont"';
        const [result] = await databasePool.query<ResultSetHeader>(query, [id]);
        return result.affectedRows > 0;
    }
}
