interface SpeedProfile {
    id: number;
    name: string;
    download_mbps: number;
    upload_mbps: number;
    burst_limit_mbps: number;
    burst_time_seconds: number;
    burst_threshold_mbps: number;
    priority: number;
    mikrotik_profile_name: string;
    is_active: boolean;
}
/**
 * Service untuk mengelola Speed Profiles
 * Includes MikroTik integration
 */
declare class SpeedProfileService {
    /**
     * Get all active speed profiles
     */
    getAllActiveProfiles(): Promise<SpeedProfile[]>;
    /**
     * Get speed profile by ID
     */
    getProfileById(profileId: number): Promise<SpeedProfile | null>;
    /**
     * Get speed profile by MikroTik profile name
     */
    getProfileByMikrotikName(mikrotikName: string): Promise<SpeedProfile | null>;
    /**
     * Create new speed profile
     */
    createProfile(data: {
        name: string;
        download_mbps: number;
        upload_mbps: number;
        burst_limit_mbps?: number;
        burst_time_seconds?: number;
        priority?: number;
    }): Promise<number>;
    /**
     * Get speed profile for a package
     */
    getProfileForPackage(packageId: number): Promise<SpeedProfile | null>;
    /**
     * Get current speed for customer
     */
    getCustomerCurrentSpeed(customerId: number): Promise<SpeedProfile | null>;
    /**
     * Log speed change
     */
    logSpeedChange(data: {
        customer_id: number;
        subscription_id?: number;
        old_speed_profile_id?: number;
        new_speed_profile_id: number;
        change_reason: 'purchase' | 'upgrade' | 'downgrade' | 'admin' | 'expired';
        changed_by?: number;
    }): Promise<void>;
    /**
     * Format speed for display
     */
    formatSpeed(profile: SpeedProfile): string;
    /**
     * Get speed change history for customer
     */
    getCustomerSpeedHistory(customerId: number, limit?: number): Promise<any[]>;
}
declare const _default: SpeedProfileService;
export default _default;
//# sourceMappingURL=SpeedProfileService.d.ts.map