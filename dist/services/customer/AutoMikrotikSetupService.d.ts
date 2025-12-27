/**
 * Service untuk auto-setup MikroTik configuration
 * Untuk portal redirect, address list, NAT rule, firewall
 */
declare class AutoMikrotikSetupService {
    /**
     * Ensure portal-redirect address list exists
     */
    ensurePortalRedirectList(): Promise<boolean>;
    /**
     * Ensure NAT rule for portal redirect exists
     * This is informational only - actual NAT rule must be created manually on MikroTik
     */
    ensurePortalRedirectNAT(): Promise<{
        exists: boolean;
        instructions?: string;
    }>;
    /**
     * Ensure firewall rule to allow portal access
     * This is informational only - actual rule must be created manually
     */
    ensurePortalFirewall(): Promise<{
        exists: boolean;
        instructions?: string;
    }>;
    /**
     * Get complete setup instructions
     */
    getCompleteSetupInstructions(): Promise<string>;
    /**
     * Validate MikroTik configuration for portal redirect
     */
    validateConfiguration(): Promise<{
        valid: boolean;
        checks: {
            addressList: boolean;
            natRule: boolean;
            firewallRule: boolean;
        };
        messages: string[];
    }>;
}
declare const _default: AutoMikrotikSetupService;
export default _default;
//# sourceMappingURL=AutoMikrotikSetupService.d.ts.map