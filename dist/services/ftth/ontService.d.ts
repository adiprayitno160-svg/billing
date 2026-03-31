import { RowDataPacket } from 'mysql2';
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
export declare class OntService {
    static listOnts(): Promise<RowDataPacket[]>;
    static getOntById(id: number): Promise<RowDataPacket>;
    static createOnt(data: OntData): Promise<number>;
    static updateOnt(id: number, data: OntData): Promise<boolean>;
    static deleteOnt(id: number): Promise<boolean>;
}
//# sourceMappingURL=ontService.d.ts.map