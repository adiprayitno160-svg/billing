/**
 * Advanced Prepaid Package Service
 *
 * Handles all operations for prepaid packages with advanced features:
 * - Multi-tier packages
 * - Bundle packages
 * - Dynamic pricing
 * - Package features
 */
export interface AdvancedPackage {
    id?: number;
    name: string;
    description?: string;
    package_code: string;
    package_type: 'basic' | 'premium' | 'vip' | 'unlimited';
    tier_level?: number;
    connection_type: 'pppoe' | 'static_ip' | 'both';
    download_mbps: number;
    upload_mbps: number;
    mikrotik_profile_name?: string;
    speed_profile_id?: number;
    parent_download_queue?: string;
    parent_upload_queue?: string;
    duration_days: number;
    duration_hours?: number;
    base_price: number;
    discount_price?: number;
    promo_price?: number;
    data_quota_gb?: number;
    data_quota_type?: 'download' | 'upload' | 'total' | 'none';
    is_bundle?: boolean;
    bundle_items?: any[];
    features?: string[];
    max_devices?: number;
    allow_sharing?: boolean;
    allow_rollover?: boolean;
    rollover_days?: number;
    auto_renew_enabled?: boolean;
    auto_renew_discount?: number;
    is_active?: boolean;
    is_featured?: boolean;
    is_popular?: boolean;
    sort_order?: number;
    tags?: string[];
    image_url?: string;
}
export interface PackageListItem extends AdvancedPackage {
    id: number;
    current_price: number;
    is_on_sale: boolean;
    discount_percentage: number;
}
export declare class AdvancedPackageService {
    /**
     * Get all packages with filters
     */
    getAllPackages(filters?: {
        connection_type?: 'pppoe' | 'static_ip' | 'both';
        package_type?: 'basic' | 'premium' | 'vip' | 'unlimited';
        is_active?: boolean;
        is_featured?: boolean;
        min_price?: number;
        max_price?: number;
        tags?: string[];
    }): Promise<PackageListItem[]>;
    /**
     * Get package by ID
     */
    getPackageById(id: number): Promise<AdvancedPackage | null>;
    /**
     * Get package by code
     */
    getPackageByCode(code: string): Promise<AdvancedPackage | null>;
    /**
     * Create new package
     */
    createPackage(pkg: AdvancedPackage): Promise<number>;
    /**
     * Update package
     */
    updatePackage(id: number, pkg: Partial<AdvancedPackage>): Promise<boolean>;
    /**
     * Delete package (soft delete by setting is_active = 0)
     */
    deletePackage(id: number): Promise<boolean>;
    /**
     * Calculate final price with discounts
     */
    calculateFinalPrice(pkg: AdvancedPackage, voucherDiscount?: number): {
        basePrice: number;
        discount: number;
        finalPrice: number;
        savings: number;
    };
    /**
     * Get featured packages
     */
    getFeaturedPackages(limit?: number): Promise<PackageListItem[]>;
    /**
     * Get popular packages
     */
    getPopularPackages(limit?: number): Promise<PackageListItem[]>;
    /**
     * Generate unique package code
     */
    private generatePackageCode;
    /**
     * Map database row to package object
     */
    private mapRowToPackage;
}
declare const _default: AdvancedPackageService;
export default _default;
//# sourceMappingURL=AdvancedPackageService.d.ts.map