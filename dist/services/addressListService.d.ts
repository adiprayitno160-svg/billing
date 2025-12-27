export interface AddressList {
    id: number;
    name: string;
    description?: string;
    status: 'active' | 'inactive';
    created_at: Date;
    updated_at: Date;
}
export interface AddressListItem {
    id: number;
    address_list_id: number;
    address: string;
    comment?: string;
    disabled: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface CreateAddressListData {
    name: string;
    description?: string;
    status?: 'active' | 'inactive';
}
export interface UpdateAddressListData {
    name?: string;
    description?: string;
    status?: 'active' | 'inactive';
}
export interface CreateAddressListItemData {
    address_list_id: number;
    address: string;
    comment?: string;
    disabled?: boolean;
}
export interface UpdateAddressListItemData {
    address?: string;
    comment?: string;
    disabled?: boolean;
}
export declare class AddressListService {
    static getAllAddressLists(): Promise<AddressList[]>;
    static getAddressListById(id: number): Promise<AddressList | null>;
    static getAddressListByName(name: string): Promise<AddressList | null>;
    static createAddressList(data: CreateAddressListData): Promise<AddressList>;
    static updateAddressList(id: number, data: UpdateAddressListData): Promise<AddressList | null>;
    static deleteAddressList(id: number): Promise<boolean>;
    static getAddressListItems(addressListId: number): Promise<AddressListItem[]>;
    static getAddressListItemById(id: number): Promise<AddressListItem | null>;
    static createAddressListItem(data: CreateAddressListItemData): Promise<AddressListItem>;
    static updateAddressListItem(id: number, data: UpdateAddressListItemData): Promise<AddressListItem | null>;
    static deleteAddressListItem(id: number): Promise<boolean>;
    static createAddressListItems(addressListId: number, addresses: string[]): Promise<AddressListItem[]>;
    static deleteAllAddressListItems(addressListId: number): Promise<boolean>;
    static getAddressListWithItems(id: number): Promise<(AddressList & {
        items: AddressListItem[];
    }) | null>;
    static getAllAddressListsWithCounts(): Promise<(AddressList & {
        item_count: number;
    })[]>;
}
//# sourceMappingURL=addressListService.d.ts.map