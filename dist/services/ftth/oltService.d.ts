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
export declare class OltService {
    static listOlts(): Promise<OltData[]>;
    static getOltById(id: number): Promise<OltData | null>;
}
//# sourceMappingURL=oltService.d.ts.map