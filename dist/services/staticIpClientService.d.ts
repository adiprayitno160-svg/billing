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
}): Promise<{
    customerId: number;
    clientId: number;
}>;
export declare function removeClientFromPackage(clientId: number): Promise<void>;
export declare function getPackageClients(packageId: number): Promise<StaticIpClient[]>;
export declare function getClientById(clientId: number): Promise<StaticIpClient | null>;
export declare function updateClient(clientId: number, data: {
    client_name?: string;
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