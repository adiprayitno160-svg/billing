export interface OdcRecord {
    id?: number;
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
export declare function listOdcs(oltId?: number): Promise<OdcRecord[]>;
export declare function getOdcById(id: number): Promise<OdcRecord | null>;
export declare function createOdc(data: OdcRecord): Promise<number>;
export declare function updateOdc(id: number, data: OdcRecord): Promise<void>;
export declare function deleteOdc(id: number): Promise<void>;
//# sourceMappingURL=odcService.d.ts.map