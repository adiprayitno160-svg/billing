/**
 * Simple MikroTik Queue Configuration Fix
 * Provides safe defaults when MikroTik is unreachable
 */

// Safe queue type mappings - these are known to work in most MikroTik setups
const SAFE_QUEUE_MAPPINGS = {
    // Original problematic types -> safe alternatives
    'pcq-download-default': 'pcq',
    'pcq-upload-default': 'pcq',
    'pcq-default': 'pcq',
    'ethernet-default': 'ethernet',
    'wireless-default': 'wireless',
    
    // If exact match isn't found, try these common alternatives
    'default-pcq': 'pcq',
    'pcq-tree': 'pcq',
    'simple-pcq': 'pcq'
};

// Known working queue types in order of preference
const KNOWN_WORKING_TYPES = ['default', 'ethernet', 'wireless', 'pcq'];

/**
 * Safely resolve queue type to a known working alternative
 * @param requestedType The queue type that was requested
 * @returns A safe queue type that should work
 */
export function resolveSafeQueueType(requestedType: string): string {
    // If it's already a known working type, use it
    if (KNOWN_WORKING_TYPES.includes(requestedType)) {
        return requestedType;
    }
    
    // Try mapping first
    if (SAFE_QUEUE_MAPPINGS[requestedType as keyof typeof SAFE_QUEUE_MAPPINGS]) {
        const mappedType = SAFE_QUEUE_MAPPINGS[requestedType as keyof typeof SAFE_QUEUE_MAPPINGS];
        console.log(`[QueueFix] Mapped ${requestedType} -> ${mappedType}`);
        return mappedType;
    }
    
    // Try partial matching
    const lowerRequested = requestedType.toLowerCase();
    for (const [pattern, replacement] of Object.entries(SAFE_QUEUE_MAPPINGS)) {
        if (lowerRequested.includes(pattern.toLowerCase().replace('-default', ''))) {
            console.log(`[QueueFix] Partial match ${requestedType} -> ${replacement}`);
            return replacement;
        }
    }
    
    // Fallback to 'default' - safest option
    console.log(`[QueueFix] Falling back ${requestedType} -> default`);
    return 'default';
}

/**
 * Validate queue configuration data
 * @param data Queue configuration object
 * @returns Sanitized data with safe queue types
 */
export function sanitizeQueueConfig(data: any): any {
    const sanitized = { ...data };
    
    if (sanitized.queue) {
        sanitized.queue = resolveSafeQueueType(sanitized.queue);
    }
    
    // Ensure required fields have sensible defaults
    if (!sanitized.parent) {
        sanitized.parent = 'global'; // Most common parent
    }
    
    if (!sanitized.priority) {
        sanitized.priority = '8'; // Default priority
    }
    
    return sanitized;
}

/**
 * Get list of recommended queue types for UI dropdowns
 */
export function getRecommendedQueueTypes(): Array<{ value: string; label: string; description: string }> {
    return [
        { value: 'default', label: 'Default', description: 'Standard queue type (most compatible)' },
        { value: 'ethernet', label: 'Ethernet', description: 'Optimized for ethernet connections' },
        { value: 'wireless', label: 'Wireless', description: 'Optimized for wireless connections' },
        { value: 'pcq', label: 'PCQ', description: 'Per Connection Queuing (advanced)' }
    ];
}

// For backwards compatibility
export const queueFix = {
    resolveSafeQueueType,
    sanitizeQueueConfig,
    getRecommendedQueueTypes
};