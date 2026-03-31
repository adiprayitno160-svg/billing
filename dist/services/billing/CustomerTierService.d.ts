interface CustomerTier {
    id: number;
    name: string;
    description: string;
    sla_target: number;
    discount_rate: number;
    max_discount_percent: number;
    priority_level: 'low' | 'medium' | 'high' | 'critical';
    created_at: Date;
    updated_at: Date;
}
interface CustomerSLASetting {
    id: number;
    customer_id: number;
    tier_id: number | null;
    custom_sla_target: number | null;
    custom_discount_rate: number | null;
    custom_max_discount_percent: number | null;
    priority_override: 'low' | 'medium' | 'high' | 'critical' | null;
    created_at: Date;
    updated_at: Date;
}
interface CustomerCreditScore {
    id: number;
    customer_id: number;
    score: number;
    category: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
    last_calculated: Date;
    payment_history_score: number;
    tenure_score: number;
    dispute_score: number;
    notes: string | null;
}
export declare class CustomerTierService {
    /**
     * Get all customer tiers
     */
    static getAllTiers(): Promise<CustomerTier[]>;
    /**
     * Get tier by ID
     */
    static getTierById(id: number): Promise<CustomerTier | null>;
    /**
     * Create a new customer tier
     */
    static createTier(tier: Omit<CustomerTier, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    /**
     * Update customer tier
     */
    static updateTier(id: number, tier: Partial<Omit<CustomerTier, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean>;
    /**
     * Delete customer tier
     */
    static deleteTier(id: number): Promise<boolean>;
    /**
     * Get customer SLA settings
     */
    static getCustomerSLASettings(customerId: number): Promise<CustomerSLASetting | null>;
    /**
     * Update customer SLA settings
     */
    static updateCustomerSLASettings(customerId: number, settings: Partial<Omit<CustomerSLASetting, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>): Promise<boolean>;
    /**
     * Get customer credit score
     */
    static getCustomerCreditScore(customerId: number): Promise<CustomerCreditScore | null>;
    /**
     * Calculate and update customer credit score
     */
    static calculateAndUpdateCreditScore(customerId: number): Promise<CustomerCreditScore>;
}
export default CustomerTierService;
//# sourceMappingURL=CustomerTierService.d.ts.map