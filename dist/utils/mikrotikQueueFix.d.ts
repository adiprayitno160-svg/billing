/**
 * Simple MikroTik Queue Configuration Fix
 * Provides safe defaults when MikroTik is unreachable
 */
/**
 * Safely resolve queue type to a known working alternative
 * @param requestedType The queue type that was requested
 * @returns A safe queue type that should work
 */
export declare function resolveSafeQueueType(requestedType: string): string;
/**
 * Validate queue configuration data
 * @param data Queue configuration object
 * @returns Sanitized data with safe queue types
 */
export declare function sanitizeQueueConfig(data: any): any;
/**
 * Get list of recommended queue types for UI dropdowns
 */
export declare function getRecommendedQueueTypes(): Array<{
    value: string;
    label: string;
    description: string;
}>;
export declare const queueFix: {
    resolveSafeQueueType: typeof resolveSafeQueueType;
    sanitizeQueueConfig: typeof sanitizeQueueConfig;
    getRecommendedQueueTypes: typeof getRecommendedQueueTypes;
};
//# sourceMappingURL=mikrotikQueueFix.d.ts.map