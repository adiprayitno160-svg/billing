export interface MikrotikAddressList {
    '.id': string;
    list: string;
    address: string;
    comment?: string;
    disabled: string;
}
export declare class AddressListMikrotikService {
    private static getMikrotikConnection;
    static syncAddressListToMikrotik(addressListId: number): Promise<boolean>;
    static getAddressListFromMikrotik(listName: string): Promise<MikrotikAddressList[]>;
    static syncAllAddressListsToMikrotik(): Promise<{
        success: number;
        failed: number;
    }>;
    static removeAddressListFromMikrotik(listName: string): Promise<boolean>;
    static addAddressToMikrotik(listName: string, address: string, comment?: string): Promise<boolean>;
    static removeAddressFromMikrotik(listName: string, address: string): Promise<boolean>;
    static updateAddressInMikrotik(listName: string, oldAddress: string, newAddress: string, comment?: string, disabled?: boolean): Promise<boolean>;
    static getAllAddressListsFromMikrotik(): Promise<string[]>;
}
//# sourceMappingURL=AddressListMikrotikService.d.ts.map