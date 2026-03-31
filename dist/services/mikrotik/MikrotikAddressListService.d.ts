/**
 * Service untuk manage Mikrotik Address List
 * Digunakan untuk redirect & firewall rules
 * REFACTORED TO USE GLOBAL CONNECTION POOL
 */
interface MikrotikConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}
export declare class MikrotikAddressListService {
    private config;
    constructor(config: MikrotikConfig);
    private getPoolConfig;
    /**
     * Add IP address to address list
     */
    addToAddressList(listName: string, ipAddress: string, comment?: string): Promise<boolean>;
    /**
     * Remove IP address from address list
     */
    removeFromAddressList(listName: string, ipAddress: string): Promise<boolean>;
    /**
     * Move IP from one address list to another
     */
    moveToAddressList(ipAddress: string, fromList: string, toList: string, comment?: string): Promise<boolean>;
    /**
     * Check if IP exists in address list
     */
    isInAddressList(listName: string, ipAddress: string): Promise<boolean>;
    /**
     * Get all IPs in address list
     */
    getAddressListEntries(listName: string): Promise<any[]>;
    /**
     * Clear all entries from address list
     */
    clearAddressList(listName: string): Promise<boolean>;
}
export default MikrotikAddressListService;
//# sourceMappingURL=MikrotikAddressListService.d.ts.map