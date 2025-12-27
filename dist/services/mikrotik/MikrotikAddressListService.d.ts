/**
 * Service untuk manage Mikrotik Address List
 * Digunakan untuk redirect & firewall rules
 * OPTIMIZED WITH CONNECTION POOL & CACHING
 */
interface MikrotikConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}
export declare class MikrotikAddressListService {
    private config;
    private static TIMEOUT;
    constructor(config: MikrotikConfig);
    /**
     * Add IP address to address list
     * @param listName - Name of address list (e.g., 'isolated', 'active-customers')
     * @param ipAddress - IP address to add
     * @param comment - Optional comment
     */
    addToAddressList(listName: string, ipAddress: string, comment?: string): Promise<boolean>;
    /**
     * Remove IP address from address list
     * @param listName - Name of address list
     * @param ipAddress - IP address to remove
     */
    removeFromAddressList(listName: string, ipAddress: string): Promise<boolean>;
    /**
     * Move IP from one address list to another
     * @param ipAddress - IP address to move
     * @param fromList - Source list name
     * @param toList - Destination list name
     * @param comment - Optional comment
     */
    moveToAddressList(ipAddress: string, fromList: string, toList: string, comment?: string): Promise<boolean>;
    /**
     * Check if IP exists in address list
     * @param listName - Name of address list
     * @param ipAddress - IP address to check
     */
    isInAddressList(listName: string, ipAddress: string): Promise<boolean>;
    /**
     * Get all IPs in address list (WITH AGGRESSIVE CACHING!)
     * @param listName - Name of address list
     */
    getAddressListEntries(listName: string): Promise<any[]>;
    /**
     * Clear all entries from address list
     * @param listName - Name of address list
     */
    clearAddressList(listName: string): Promise<boolean>;
}
export default MikrotikAddressListService;
//# sourceMappingURL=MikrotikAddressListService.d.ts.map