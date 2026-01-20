/**
 * MikroTik Queue Error Handler
 * Intercepts queue creation calls and applies safe defaults
 */

import { sanitizeQueueConfig } from '../utils/mikrotikQueueFix';

/**
 * Wrapper function that sanitizes queue configuration before passing to MikroTik
 */
export async function createQueueWithErrorHandling(originalCreateFunction: Function, cfg: any, data: any) {
    try {
        // Sanitize the queue configuration
        const safeData = sanitizeQueueConfig(data);
        
        console.log('[QueueHandler] Original data:', data);
        console.log('[QueueHandler] Sanitized data:', safeData);
        
        // Call the original function with safe data
        return await originalCreateFunction(cfg, safeData);
        
    } catch (error: any) {
        console.error('[QueueHandler] Queue creation failed:', error.message);
        
        // If it's a queue type error, try with 'default' queue type
        if (error.message && error.message.includes('input does not match any value of queue')) {
            console.log('[QueueHandler] Retrying with default queue type...');
            
            const fallbackData = {
                ...sanitizeQueueConfig(data),
                queue: 'default'
            };
            
            try {
                return await originalCreateFunction(cfg, fallbackData);
            } catch (retryError: any) {
                console.error('[QueueHandler] Retry also failed:', retryError.message);
                throw new Error(`Queue creation failed after retry: ${retryError.message}`);
            }
        }
        
        throw error;
    }
}

/**
 * Wrapper for queue tree creation specifically
 */
export async function safeCreateQueueTree(cfg: any, data: any, originalCreateQueueTree: Function) {
    return createQueueWithErrorHandling(originalCreateQueueTree, cfg, data);
}

/**
 * Wrapper for queue tree updates
 */
export async function safeUpdateQueueTree(cfg: any, id: string, data: any, originalUpdateQueueTree: Function) {
    try {
        // Just sanitize the queue type for updates
        const safeData = { ...data };
        if (safeData.queue) {
            const { resolveSafeQueueType } = await import('../utils/mikrotikQueueFix');
            safeData.queue = resolveSafeQueueType(safeData.queue);
        }
        
        return await originalUpdateQueueTree(cfg, id, safeData);
        
    } catch (error: any) {
        console.error('[QueueHandler] Queue update failed:', error.message);
        throw error;
    }
}