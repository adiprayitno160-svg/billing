/**
 * Prepaid Package Service
 * Handles CRUD operations for prepaid packages
 * Supports both PPPoE and Static IP connection types
 */
export interface PrepaidPackage {
    id?: number;
    name: string;
    description: string;
    connection_type: 'pppoe' | 'static' | 'both';
    mikrotik_profile_name?: string;
    parent_download_queue?: string;
    parent_upload_queue?: string;
    download_mbps: number;
    upload_mbps: number;
    duration_days: number;
    price: number;
    is_active: boolean;
    allow_custom_speed?: boolean;
    download_limit?: string;
    upload_limit?: string;
}
export interface PackageListItem extends PrepaidPackage {
    id: number;
    created_at: Date;
    updated_at: Date;
}
export declare class PrepaidPackageService {
    /**
     * Get all packages (for admin)
     */
    static getAllPackages(): Promise<PackageListItem[]>;
    /**
     * Get all active packages (for WhatsApp bot)
     */
    static getActivePackages(): Promise<PackageListItem[]>;
    /**
     * Get active packages by connection type (for customer portal)
     */
    static getActivePackagesByType(connectionType: 'pppoe' | 'static'): Promise<PackageListItem[]>;
    /**
     * Get package by ID
     */
    static getPackageById(packageId: number): Promise<PackageListItem | null>;
    /**
     * Create new package
     */
    static createPackage(packageData: PrepaidPackage): Promise<number>;
    /**
     * Update existing package
     */
    static updatePackage(packageId: number, packageData: Partial<PrepaidPackage>): Promise<void>;
    /**
     * Delete package (soft delete - set inactive)
     */
    static deletePackage(packageId: number): Promise<void>;
    /**
     * Get parent queues from Mikrotik (for admin dropdown)
     */
    static getParentQueuesFromMikrotik(): Promise<{
        download: string[];
        upload: string[];
    }>;
    /**
     * Validate package data based on connection type
     */
    private static validatePackageData;
    /**
     * Check if customer connection type is detected
     */
    static getCustomerConnectionType(customerId: number): Promise<'pppoe' | 'static' | null>;
}
export default PrepaidPackageService;
//# sourceMappingURL=PrepaidPackageService.d.ts.map