interface AddressList {
    id: number;
    list_name: string;
    description: string;
    purpose: 'portal-redirect' | 'isolation' | 'whitelist' | 'blacklist';
    auto_manage: boolean;
    is_active: boolean;
}
/**
 * Service untuk mengelola MikroTik Address Lists
 * Untuk portal redirect, isolation, dll
 */
declare class AddressListService {
    private mikrotikService;
    /**
     * Get portal-redirect address list
     */
    getPortalRedirectList(): Promise<AddressList | null>;
    /**
     * Add customer to portal-redirect list
     */
    addToPortalRedirect(customerId: number, reason?: string): Promise<boolean>;
    /**
     * Remove customer from portal-redirect list
     */
    removeFromPortalRedirect(customerId: number): Promise<boolean>;
    /**
     * Check if customer is in address list
     */
    isCustomerInList(customerId: number, listId: number): Promise<boolean>;
    /**
     * Get customer IP address
     */
    private getCustomerIP;
    /**
     * Get all customers in portal-redirect list
     */
    getCustomersInPortalRedirect(): Promise<any[]>;
    /**
     * Sync all pending items to MikroTik
     */
    syncPendingItems(): Promise<{
        synced: number;
        failed: number;
    }>;
    /**
     * Clean expired entries
     */
    cleanExpiredEntries(): Promise<number>;
    /**
     * Get customer's address list entries
     */
    getCustomerAddressLists(customerId: number): Promise<any[]>;
}
declare const _default: AddressListService;
export default _default;
//# sourceMappingURL=AddressListService.d.ts.map