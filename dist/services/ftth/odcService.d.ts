export interface OdcRecord {
    id?: number;
    area_id?: number | null;
    olt_id: number;
    name: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    total_ports: number;
    used_ports: number;
    olt_card?: number | null;
    olt_port?: number | null;
    notes?: string | null;
}
export declare function listOdcs(oltId?: number): Promise<any[]>;
export declare function getOdcById(id: number): Promise<OdcRecord | null>;
export declare function createOdc(data: OdcRecord): Promise<number>;
export declare function updateOdc(id: number, data: OdcRecord): Promise<void>;
export declare function deleteOdc(id: number): Promise<void>;
export declare function recalculateOdcUsage(id: number): Promise<void>;
//# sourceMappingURL=odcService.d.ts.map