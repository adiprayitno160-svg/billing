/**
 * Prepaid Queue Service
 * Manages Mikrotik Queue Tree for Static IP prepaid customers
 * Reuses existing postpaid infrastructure (parent queues & mangle rules)
 */
interface MikrotikConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}
interface QueueTreeParams {
    customerId: number;
    customerName: string;
    ipAddress: string;
    parentDownloadQueue: string;
    parentUploadQueue: string;
    downloadSpeedMbps: number;
    uploadSpeedMbps: number;
}
export declare class PrepaidQueueService {
    private config;
    constructor(config: MikrotikConfig);
    /**
     * Get active Mikrotik configuration from database
     */
    static getMikrotikConfig(): Promise<MikrotikConfig | null>;
    /**
     * Get all parent queues from Mikrotik (for admin dropdown)
     */
    getParentQueues(): Promise<{
        download: string[];
        upload: string[];
    }>;
    /**
     * Create or update queue tree for prepaid customer
     * Reuses existing mangle rules from postpaid setup
     */
    createOrUpdateQueue(params: QueueTreeParams): Promise<void>;
    /**
     * Find queue by name
     */
    private findQueueByName;
    /**
     * Remove queue tree for customer (saat package expired)
     */
    removeQueue(customerName: string): Promise<void>;
    /**
     * Check if mangle rules exist for customer IP
     * (Should exist from postpaid setup)
     */
    checkMangleRules(ipAddress: string): Promise<boolean>;
}
export default PrepaidQueueService;
//# sourceMappingURL=PrepaidQueueService.d.ts.map