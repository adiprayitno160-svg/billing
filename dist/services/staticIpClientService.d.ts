import { StaticIpClient } from './staticIpPackageService';
export type StaticIpClientWithPackage = StaticIpClient & {
    package_name: string;
};
export declare function isPackageFull(packageId: number): Promise<boolean>;
export declare function addClientToPackage(packageId: number, clientData: {
    client_name: string;
    ip_address: string;
    customer_id?: number | null;
    network?: string | null;
    interface?: string | null;
    address?: string | null;
    phone_number?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    olt_id?: number | null;
    odc_id?: number | null;
    odp_id?: number | null;
    customer_code?: string | null;
    is_taxable?: number | null;
    use_device_rental?: number | null;
    serial_number?: string | null;
    billing_mode?: string | null;
    activation_date?: string | null;
    custom_payment_deadline?: number | null;
}): Promise<{
    customerId: number;
    clientId: number;
}>;
export declare function removeClientFromPackage(clientId: number): Promise<void>;
export declare function changeCustomerStaticIpPackage(customerId: number, newPackageId: number): Promise<void>;
export declare function getPackageClients(packageId: number): Promise<StaticIpClient[]>;
export declare function getClientById(clientId: number): Promise<StaticIpClient | null>;
export declare function getStaticIpClientByCustomerId(customerId: number | string): Promise<StaticIpClient | null>;
export declare function updateClient(clientId: number, data: {
    client_name?: string;
    package_id?: number;
    ip_address?: string;
    network?: string | null;
    interface?: string | null;
    customer_id?: number | null;
    status?: 'active' | 'inactive';
    address?: string | null;
    phone_number?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    olt_id?: number | null;
    odc_id?: number | null;
    odp_id?: number | null;
}): Promise<void>;
export declare function calculateSharedLimit(maxLimit: string, maxClients: number): string;
export declare function getAllStaticIpClients(): Promise<StaticIpClientWithPackage[]>;
//# sourceMappingURL=staticIpClientService.d.ts.map