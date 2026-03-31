/**
 * Wrapper for MikroTik queue operations with automatic validation
 * This prevents "input does not match any value of queue" errors
 */
import { MikroTikConfig } from './mikrotikService';
/**
 * Safe queue tree creation with automatic validation
 */
export declare function safeCreateQueueTree(cfg: MikroTikConfig, data: any): Promise<void>;
/**
 * Safe queue tree update with automatic validation
 */
export declare function safeUpdateQueueTree(cfg: MikroTikConfig, id: string, data: any): Promise<void>;
/**
 * Get safe queue types that definitely work
 */
export declare function getSafeQueueTypes(): Promise<string[]>;
//# sourceMappingURL=safeMikrotikQueueService.d.ts.map