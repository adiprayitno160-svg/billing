export interface OdpRecord {
    id?: number;
    odc_id: number;
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
export declare function listOdps(odcId?: number): Promise<OdpRecord[]>;
export declare function getOdpById(id: number): Promise<OdpRecord | null>;
export declare function createOdp(data: OdpRecord): Promise<number>;
export declare function updateOdp(id: number, data: OdpRecord): Promise<void>;
export declare function deleteOdp(id: number): Promise<void>;
//# sourceMappingURL=odpService.d.ts.map