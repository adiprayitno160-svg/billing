/**
 * ODP/ODC Service
 * Manages Optical Distribution Cabinet (ODC) and Optical Distribution Point (ODP)
 * Version: 2.4.2
 */
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
    odc_name?: string;
}
export interface CustomerFiberInfo {
    customer_id: number;
    odp_id: number;
    odp_port_number: number;
    jarak_dari_odp: number;
}
export declare class OdpOdcService {
    /**
     * Get all ODCs with optional filtering
     */
    static getAllODCs(filters?: {
        status?: string;
    }): Promise<ODC[]>;
    /**
     * Get ODC by ID
     */
    static getODCById(id: number): Promise<ODC | null>;
    /**
     * Create new ODC
     */
    static createODC(odc: ODC): Promise<number>;
    /**
     * Update ODC
     */
    static updateODC(id: number, odc: Partial<ODC>): Promise<boolean>;
    /**
     * Delete ODC (will cascade delete ODPs)
     */
    static deleteODC(id: number): Promise<boolean>;
    /**
     * Get all ODPs with optional filtering
     */
    static getAllODPs(filters?: {
        odc_id?: number;
        status?: string;
    }): Promise<ODP[]>;
    /**
     * Get ODP by ID
     */
    static getODPById(id: number): Promise<ODP | null>;
    /**
     * Create new ODP
     */
    static createODP(odp: ODP): Promise<number>;
    /**
     * Update ODP
     */
    static updateODP(id: number, odp: Partial<ODP>): Promise<boolean>;
    /**
     * Delete ODP
     */
    static deleteODP(id: number): Promise<boolean>;
    /**
     * Link customer to ODP
     */
    static linkCustomerToODP(info: CustomerFiberInfo): Promise<boolean>;
    /**
     * Get customers by ODP
     */
    static getCustomersByODP(odp_id: number): Promise<any[]>;
    /**
     * Update ODC used capacity based on number of ODPs
     */
    private static updateODCUsedCapacity;
    /**
     * Update ODP used ports based on number of customers
     */
    private static updateODPUsedPorts;
    /**
     * Get network topology summary
     */
    static getNetworkTopology(): Promise<{
        total_odc: number;
        total_odp: number;
        total_customers_linked: number;
        odcs: any[];
    }>;
}
//# sourceMappingURL=OdpOdcService.d.ts.map