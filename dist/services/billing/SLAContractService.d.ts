interface SLAContract {
    id: number;
    customer_id: number;
    contract_number: string;
    contract_title: string;
    sla_target: number;
    penalty_clause: string | null;
    compensation_terms: string | null;
    special_conditions: string | null;
    start_date: Date;
    end_date: Date;
    status: 'draft' | 'active' | 'expired' | 'terminated';
    created_at: Date;
    updated_at: Date;
}
export declare class SLAContractService {
    /**
     * Get all SLA contracts with pagination and filters
     */
    static getAllContracts(options: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
    }): Promise<{
        contracts: SLAContract[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Create a new SLA contract
     */
    static createContract(contract: Omit<SLAContract, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    /**
     * Get SLA contract by ID
     */
    static getContractById(id: number): Promise<SLAContract | null>;
    /**
     * Get all contracts for a customer
     */
    static getContractsByCustomerId(customerId: number): Promise<SLAContract[]>;
    /**
     * Get active contracts
     */
    static getActiveContracts(): Promise<SLAContract[]>;
    /**
     * Update SLA contract
     */
    static updateContract(id: number, contract: Partial<Omit<SLAContract, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean>;
    /**
     * Update contract status
     */
    static updateContractStatus(id: number, status: 'draft' | 'active' | 'expired' | 'terminated'): Promise<boolean>;
    /**
     * Check if customer has active contract
     */
    static hasActiveContract(customerId: number): Promise<boolean>;
    /**
     * Get customer's current SLA target (from contract or default)
     */
    static getCurrentSLATarget(customerId: number): Promise<number>;
    /**
     * Get contracts expiring soon (within specified days)
     */
    static getExpiringContracts(days?: number): Promise<SLAContract[]>;
    /**
     * Get contracts that expired recently
     */
    static getExpiredContracts(daysSince?: number): Promise<SLAContract[]>;
    /**
     * Get contract by number
     */
    static getContractByNumber(contractNumber: string): Promise<SLAContract | null>;
}
export default SLAContractService;
//# sourceMappingURL=SLAContractService.d.ts.map