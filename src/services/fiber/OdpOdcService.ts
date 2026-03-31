/**
 * ODP/ODC Service
 * Manages Optical Distribution Cabinet (ODC) and Optical Distribution Point (ODP)
 * Version: 2.4.2
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ODC {
    id?: number;
    code: string;
    name: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number;
    used_capacity?: number;
    status?: 'active' | 'inactive' | 'maintenance';
    notes?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface ODP {
    id?: number;
    odc_id: number;
    code: string;
    name: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    capacity_ports?: number;
    used_ports?: number;
    status?: 'active' | 'inactive' | 'maintenance' | 'full';
    notes?: string;
    created_at?: Date;
    updated_at?: Date;
    odc_name?: string; // Join result
}

export interface CustomerFiberInfo {
    customer_id: number;
    odp_id: number;
    odp_port_number: number;
    jarak_dari_odp: number;
}

export class OdpOdcService {

    // ==================== ODC Methods ====================

    /**
     * Get all ODCs with optional filtering
     */
    static async getAllODCs(filters?: { status?: string }): Promise<ODC[]> {
        try {
            let query = 'SELECT * FROM ftth_odc WHERE 1=1';
            const params: any[] = [];

            if (filters?.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }

            query += ' ORDER BY code ASC';

            const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
            return rows as ODC[];
        } catch (error) {
            console.error('[OdpOdcService] Error getting ODCs:', error);
            throw error;
        }
    }

    /**
     * Get ODC by ID
     */
    static async getODCById(id: number): Promise<ODC | null> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM ftth_odc WHERE id = ?',
                [id]
            );
            return rows.length > 0 ? (rows[0] as ODC) : null;
        } catch (error) {
            console.error('[OdpOdcService] Error getting ODC by ID:', error);
            throw error;
        }
    }

    /**
     * Create new ODC
     */
    static async createODC(odc: ODC): Promise<number> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `INSERT INTO ftth_odc (code, name, location, latitude, longitude, capacity, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    odc.code,
                    odc.name,
                    odc.location || null,
                    odc.latitude || null,
                    odc.longitude || null,
                    odc.capacity || 0,
                    odc.status || 'active',
                    odc.notes || null
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('[OdpOdcService] Error creating ODC:', error);
            throw error;
        }
    }

    /**
     * Update ODC
     */
    static async updateODC(id: number, odc: Partial<ODC>): Promise<boolean> {
        try {
            const fields: string[] = [];
            const values: any[] = [];

            if (odc.code !== undefined) { fields.push('code = ?'); values.push(odc.code); }
            if (odc.name !== undefined) { fields.push('name = ?'); values.push(odc.name); }
            if (odc.location !== undefined) { fields.push('location = ?'); values.push(odc.location); }
            if (odc.latitude !== undefined) { fields.push('latitude = ?'); values.push(odc.latitude); }
            if (odc.longitude !== undefined) { fields.push('longitude = ?'); values.push(odc.longitude); }
            if (odc.capacity !== undefined) { fields.push('capacity = ?'); values.push(odc.capacity); }
            if (odc.used_capacity !== undefined) { fields.push('used_capacity = ?'); values.push(odc.used_capacity); }
            if (odc.status !== undefined) { fields.push('status = ?'); values.push(odc.status); }
            if (odc.notes !== undefined) { fields.push('notes = ?'); values.push(odc.notes); }

            if (fields.length === 0) return false;

            values.push(id);

            const [result] = await databasePool.query<ResultSetHeader>(
                `UPDATE ftth_odc SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OdpOdcService] Error updating ODC:', error);
            throw error;
        }
    }

    /**
     * Delete ODC (will cascade delete ODPs)
     */
    static async deleteODC(id: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                'DELETE FROM ftth_odc WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OdpOdcService] Error deleting ODC:', error);
            throw error;
        }
    }

    // ==================== ODP Methods ====================

    /**
     * Get all ODPs with optional filtering
     */
    static async getAllODPs(filters?: { odc_id?: number; status?: string }): Promise<ODP[]> {
        try {
            let query = `
                SELECT odp.*, odc.name as odc_name 
                FROM ftth_odp odp 
                LEFT JOIN ftth_odc odc ON odp.odc_id = odc.id 
                WHERE 1=1
            `;
            const params: any[] = [];

            if (filters?.odc_id) {
                query += ' AND odp.odc_id = ?';
                params.push(filters.odc_id);
            }

            if (filters?.status) {
                query += ' AND odp.status = ?';
                params.push(filters.status);
            }

            query += ' ORDER BY odp.code ASC';

            const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
            return rows as ODP[];
        } catch (error) {
            console.error('[OdpOdcService] Error getting ODPs:', error);
            throw error;
        }
    }

    /**
     * Get ODP by ID
     */
    static async getODPById(id: number): Promise<ODP | null> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                `SELECT odp.*, odc.name as odc_name 
                 FROM ftth_odp odp 
                 LEFT JOIN ftth_odc odc ON odp.odc_id = odc.id 
                 WHERE odp.id = ?`,
                [id]
            );
            return rows.length > 0 ? (rows[0] as ODP) : null;
        } catch (error) {
            console.error('[OdpOdcService] Error getting ODP by ID:', error);
            throw error;
        }
    }

    /**
     * Create new ODP
     */
    static async createODP(odp: ODP): Promise<number> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `INSERT INTO ftth_odp (odc_id, code, name, location, latitude, longitude, capacity_ports, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    odp.odc_id,
                    odp.code,
                    odp.name,
                    odp.location || null,
                    odp.latitude || null,
                    odp.longitude || null,
                    odp.capacity_ports || 8,
                    odp.status || 'active',
                    odp.notes || null
                ]
            );

            // Update ODC used capacity
            await this.updateODCUsedCapacity(odp.odc_id);

            return result.insertId;
        } catch (error) {
            console.error('[OdpOdcService] Error creating ODP:', error);
            throw error;
        }
    }

    /**
     * Update ODP
     */
    static async updateODP(id: number, odp: Partial<ODP>): Promise<boolean> {
        try {
            const fields: string[] = [];
            const values: any[] = [];

            if (odp.odc_id !== undefined) { fields.push('odc_id = ?'); values.push(odp.odc_id); }
            if (odp.code !== undefined) { fields.push('code = ?'); values.push(odp.code); }
            if (odp.name !== undefined) { fields.push('name = ?'); values.push(odp.name); }
            if (odp.location !== undefined) { fields.push('location = ?'); values.push(odp.location); }
            if (odp.latitude !== undefined) { fields.push('latitude = ?'); values.push(odp.latitude); }
            if (odp.longitude !== undefined) { fields.push('longitude = ?'); values.push(odp.longitude); }
            if (odp.capacity_ports !== undefined) { fields.push('capacity_ports = ?'); values.push(odp.capacity_ports); }
            if (odp.used_ports !== undefined) { fields.push('used_ports = ?'); values.push(odp.used_ports); }
            if (odp.status !== undefined) { fields.push('status = ?'); values.push(odp.status); }
            if (odp.notes !== undefined) { fields.push('notes = ?'); values.push(odp.notes); }

            if (fields.length === 0) return false;

            values.push(id);

            const [result] = await databasePool.query<ResultSetHeader>(
                `UPDATE ftth_odp SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            // If ODP moved to different ODC, update both ODCs
            if (odp.odc_id) {
                const currentOdp = await this.getODPById(id);
                if (currentOdp && currentOdp.odc_id !== odp.odc_id) {
                    await this.updateODCUsedCapacity(currentOdp.odc_id); // Old ODC
                    await this.updateODCUsedCapacity(odp.odc_id); // New ODC
                }
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OdpOdcService] Error updating ODP:', error);
            throw error;
        }
    }

    /**
     * Delete ODP
     */
    static async deleteODP(id: number): Promise<boolean> {
        try {
            const odp = await this.getODPById(id);

            const [result] = await databasePool.query<ResultSetHeader>(
                'DELETE FROM ftth_odp WHERE id = ?',
                [id]
            );

            // Update ODC used capacity
            if (odp) {
                await this.updateODCUsedCapacity(odp.odc_id);
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OdpOdcService] Error deleting ODP:', error);
            throw error;
        }
    }

    // ==================== Customer-ODP Mapping ====================

    /**
     * Link customer to ODP
     */
    static async linkCustomerToODP(info: CustomerFiberInfo): Promise<boolean> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `UPDATE customers 
                 SET odp_id = ?, odp_port_number = ?, jarak_dari_odp = ?
                 WHERE id = ?`,
                [info.odp_id, info.odp_port_number, info.jarak_dari_odp, info.customer_id]
            );

            // Update ODP used ports
            await this.updateODPUsedPorts(info.odp_id);

            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OdpOdcService] Error linking customer to ODP:', error);
            throw error;
        }
    }

    /**
     * Get customers by ODP
     */
    static async getCustomersByODP(odp_id: number): Promise<any[]> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                `SELECT id, name, phone, odp_port_number, jarak_dari_odp, 
                        redaman_rx, redaman_tx, last_signal_check, status
                 FROM customers 
                 WHERE odp_id = ?
                 ORDER BY odp_port_number ASC`,
                [odp_id]
            );
            return rows;
        } catch (error) {
            console.error('[OdpOdcService] Error getting customers by ODP:', error);
            throw error;
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Update ODC used capacity based on number of ODPs
     */
    private static async updateODCUsedCapacity(odc_id: number): Promise<void> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM ftth_odp WHERE odc_id = ?',
                [odc_id]
            );
            const count = rows[0]?.count || 0;

            await databasePool.query(
                'UPDATE ftth_odc SET used_capacity = ? WHERE id = ?',
                [count, odc_id]
            );
        } catch (error) {
            console.error('[OdpOdcService] Error updating ODC used capacity:', error);
        }
    }

    /**
     * Update ODP used ports based on number of customers
     */
    private static async updateODPUsedPorts(odp_id: number): Promise<void> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM customers WHERE odp_id = ?',
                [odp_id]
            );
            const count = rows[0]?.count || 0;

            await databasePool.query(
                'UPDATE odp SET used_ports = ? WHERE id = ?',
                [count, odp_id]
            );

            // Update status based on capacity
            const odp = await this.getODPById(odp_id);
            if (odp && count >= (odp.capacity_ports || 8)) {
                await databasePool.query(
                    "UPDATE ftth_odp SET status = 'full' WHERE id = ?",
                    [odp_id]
                );
            } else if (odp && odp.status === 'full' && count < (odp.capacity_ports || 8)) {
                await databasePool.query(
                    "UPDATE ftth_odp SET status = 'active' WHERE id = ?",
                    [odp_id]
                );
            }
        } catch (error) {
            console.error('[OdpOdcService] Error updating ODP used ports:', error);
        }
    }

    /**
     * Get network topology summary
     */
    static async getNetworkTopology(): Promise<{
        total_odc: number;
        total_odp: number;
        total_customers_linked: number;
        odcs: any[];
    }> {
        try {
            const [odcCount] = await databasePool.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM ftth_odc'
            );
            const [odpCount] = await databasePool.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM ftth_odp'
            );
            const [customerCount] = await databasePool.query<RowDataPacket[]>(
                'SELECT COUNT(*) as count FROM customers WHERE odp_id IS NOT NULL'
            );

            const odcs = await this.getAllODCs();

            return {
                total_odc: odcCount[0]?.count || 0,
                total_odp: odpCount[0]?.count || 0,
                total_customers_linked: customerCount[0]?.count || 0,
                odcs
            };
        } catch (error) {
            console.error('[OdpOdcService] Error getting network topology:', error);
            throw error;
        }
    }
}
