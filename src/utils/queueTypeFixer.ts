/**
 * Simple Queue Type Fixer
 * Replaces problematic queue types with safe alternatives
 */

// Mapping of problematic queue types to safe alternatives
const QUEUE_TYPE_FIXES: Record<string, string> = {
    'pcq-download-default': 'pcq',
    'pcq-upload-default': 'pcq',
    'pcq-default': 'pcq',
    'ethernet-default': 'ethernet',
    'wireless-default': 'wireless'
};

/**
 * Fix queue type to a safe alternative
 * @param queueType The original queue type
 * @returns A safe queue type that should work
 */
export function fixQueueType(queueType: string): string {
    // If it's already a safe type, return as-is
    const safeTypes = ['default', 'ethernet', 'wireless', 'pcq', 'fq-coDel', 'sfq'];
    if (safeTypes.includes(queueType)) {
        return queueType;
    }
    
    // Check if we have a specific fix
    if (QUEUE_TYPE_FIXES[queueType]) {
        console.log(`[QueueFixer] Fixed ${queueType} -> ${QUEUE_TYPE_FIXES[queueType]}`);
        return QUEUE_TYPE_FIXES[queueType];
    }
    
    // Try partial matching for common patterns
    const lowerType = queueType.toLowerCase();
    
    if (lowerType.includes('pcq')) {
        console.log(`[QueueFixer] Partial match ${queueType} -> pcq`);
        return 'pcq';
    }
    
    if (lowerType.includes('ethernet')) {
        console.log(`[QueueFixer] Partial match ${queueType} -> ethernet`);
        return 'ethernet';
    }
    
    if (lowerType.includes('wireless')) {
        console.log(`[QueueFixer] Partial match ${queueType} -> wireless`);
        return 'wireless';
    }
    
    // Fallback to 'default' - the safest option
    console.log(`[QueueFixer] Falling back ${queueType} -> default`);
    return 'default';
}

/**
 * Fix queue configuration object
 * @param config The queue configuration object
 * @returns Fixed configuration object
 */
export function fixQueueConfig(config: any): any {
    if (!config || typeof config !== 'object') {
        return config;
    }
    
    const fixedConfig = { ...config };
    
    // Fix queue type if present
    if (fixedConfig.queue) {
        fixedConfig.queue = fixQueueType(fixedConfig.queue);
    }
    
    // Ensure parent exists (use 'global' as fallback)
    if (!fixedConfig.parent) {
        fixedConfig.parent = 'global';
    }
    
    // Ensure priority is reasonable
    if (!fixedConfig.priority) {
        fixedConfig.priority = '8';
    }
    
    return fixedConfig;
}