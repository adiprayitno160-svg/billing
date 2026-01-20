/**
 * Queue type validation helper for MikroTik
 * Checks if queue types exist before attempting to create queues
 */

import { RouterOSAPI } from 'routeros-api';
import { getMikrotikConfig } from '../utils/mikrotikConfigHelper';

// Cache for available queue types to avoid repeated API calls
let availableQueueTypes: string[] | null = null;
let queueTypesLastChecked: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get available queue types from MikroTik
 */
export async function getAvailableQueueTypes(): Promise<string[]> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (availableQueueTypes && (now - queueTypesLastChecked) < CACHE_DURATION) {
        return availableQueueTypes;
    }
    
    try {
        const config = await getMikrotikConfig();
        if (!config) {
            console.warn('[QueueValidation] No MikroTik config found');
            return ['default']; // fallback
        }
        
        const api = new RouterOSAPI({
            host: config.host,
            port: config.port || 8728,
            user: config.username,
            password: config.password,
            timeout: 5000
        });
        
        await api.connect();
        
        // Get queue types
        const queueTypes = await api.write('/queue/type/print');
        const typeNames = queueTypes.map((qt: any) => qt.name);
        
        // Add some common defaults that might not be listed but are available
        const commonTypes = ['default', 'ethernet', 'wireless', 'pcq'];
        const allTypes = [...new Set([...typeNames, ...commonTypes])];
        
        availableQueueTypes = allTypes;
        queueTypesLastChecked = now;
        
        api.close();
        
        console.log('[QueueValidation] Available queue types:', allTypes);
        return allTypes;
        
    } catch (error: any) {
        console.error('[QueueValidation] Failed to get queue types:', error.message);
        // Return safe defaults
        return ['default'];
    }
}

/**
 * Validate and normalize queue type
 * Returns a valid queue type that exists on the MikroTik device
 */
export async function validateQueueType(requestedType: string): Promise<string> {
    const availableTypes = await getAvailableQueueTypes();
    
    // If requested type exists, use it
    if (availableTypes.includes(requestedType)) {
        return requestedType;
    }
    
    // Map common invalid types to valid alternatives
    const typeMappings: Record<string, string> = {
        'pcq-download-default': 'pcq',
        'pcq-upload-default': 'pcq',
        'pcq-default': 'pcq',
        'ethernet-default': 'ethernet',
        'wireless-default': 'wireless'
    };
    
    // Try mapped type
    const mappedType = typeMappings[requestedType];
    if (mappedType && availableTypes.includes(mappedType)) {
        console.log(`[QueueValidation] Mapped ${requestedType} -> ${mappedType}`);
        return mappedType;
    }
    
    // Fallback to 'default' if available
    if (availableTypes.includes('default')) {
        console.log(`[QueueValidation] Falling back ${requestedType} -> default`);
        return 'default';
    }
    
    // Use first available type
    const fallbackType = availableTypes[0] || 'default';
    console.log(`[QueueValidation] Ultimate fallback ${requestedType} -> ${fallbackType}`);
    return fallbackType;
}

/**
 * Validate parent queue exists
 */
export async function validateParentQueue(parentName: string): Promise<boolean> {
    try {
        const config = await getMikrotikConfig();
        if (!config) return false;
        
        const api = new RouterOSAPI({
            host: config.host,
            port: config.port || 8728,
            user: config.username,
            password: config.password,
            timeout: 5000
        });
        
        await api.connect();
        
        // Check if parent queue exists
        const queueTrees = await api.write('/queue/tree/print', [`?name=${parentName}`]);
        
        api.close();
        
        const exists = Array.isArray(queueTrees) && queueTrees.length > 0;
        console.log(`[QueueValidation] Parent queue '${parentName}' exists: ${exists}`);
        return exists;
        
    } catch (error: any) {
        console.error(`[QueueValidation] Failed to check parent queue '${parentName}':`, error.message);
        return false;
    }
}

/**
 * Pre-validate queue creation data
 */
export async function preValidateQueueCreation(data: any): Promise<{ 
    valid: boolean; 
    errors: string[]; 
    sanitizedData: any 
}> {
    const errors: string[] = [];
    const sanitizedData = { ...data };
    
    // Validate queue type
    if (sanitizedData.queue) {
        const validQueueType = await validateQueueType(sanitizedData.queue);
        if (validQueueType !== sanitizedData.queue) {
            console.log(`[QueueValidation] Queue type corrected: ${sanitizedData.queue} -> ${validQueueType}`);
            sanitizedData.queue = validQueueType;
        }
    }
    
    // Validate parent queue
    if (sanitizedData.parent) {
        const parentExists = await validateParentQueue(sanitizedData.parent);
        if (!parentExists) {
            errors.push(`Parent queue '${sanitizedData.parent}' does not exist`);
        }
    }
    
    // Validate required fields
    if (!sanitizedData.name) {
        errors.push('Queue name is required');
    }
    
    if (!sanitizedData.parent) {
        errors.push('Parent queue is required');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        sanitizedData
    };
}