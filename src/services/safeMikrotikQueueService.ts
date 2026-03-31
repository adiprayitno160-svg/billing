/**
 * Wrapper for MikroTik queue operations with automatic validation
 * This prevents "input does not match any value of queue" errors
 */

import { MikroTikConfig } from './mikrotikService';
import { preValidateQueueCreation, validateQueueType } from '../utils/queueValidationHelper';

/**
 * Safe queue tree creation with automatic validation
 */
export async function safeCreateQueueTree(cfg: MikroTikConfig, data: any): Promise<void> {
    try {
        // Validate queue data before creation
        const validation = await preValidateQueueCreation(data);
        if (!validation.valid) {
            throw new Error(`Queue validation failed: ${validation.errors.join(', ')}`);
        }
        
        const validatedData = validation.sanitizedData;
        
        // Import the original mikrotikService
        const { createQueueTree } = await import('./mikrotikService');
        
        console.log('[SafeQueue] Creating queue with validated data:', validatedData);
        await createQueueTree(cfg, validatedData);
        
    } catch (err: any) {
        console.error('[SafeQueue] Failed to create queue:', err.message);
        throw err;
    }
}

/**
 * Safe queue tree update with automatic validation
 */
export async function safeUpdateQueueTree(cfg: MikroTikConfig, id: string, data: any): Promise<void> {
    try {
        // Validate queue type if present
        const validatedData = { ...data };
        if (validatedData.queue) {
            validatedData.queue = await validateQueueType(validatedData.queue);
        }
        
        // Import the original mikrotikService
        const { updateQueueTree } = await import('./mikrotikService');
        
        console.log('[SafeQueue] Updating queue with validated data:', validatedData);
        await updateQueueTree(cfg, id, validatedData);
        
    } catch (err: any) {
        console.error('[SafeQueue] Failed to update queue:', err.message);
        throw err;
    }
}

/**
 * Get safe queue types that definitely work
 */
export async function getSafeQueueTypes(): Promise<string[]> {
    try {
        const { getAvailableQueueTypes } = await import('../utils/queueValidationHelper');
        return await getAvailableQueueTypes();
    } catch (error) {
        // Fallback to known working types
        return ['default', 'ethernet', 'wireless', 'pcq'];
    }
}