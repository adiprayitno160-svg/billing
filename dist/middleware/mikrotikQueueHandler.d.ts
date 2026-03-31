/**
 * MikroTik Queue Error Handler
 * Intercepts queue creation calls and applies safe defaults
 */
/**
 * Wrapper function that sanitizes queue configuration before passing to MikroTik
 */
export declare function createQueueWithErrorHandling(originalCreateFunction: Function, cfg: any, data: any): Promise<any>;
/**
 * Wrapper for queue tree creation specifically
 */
export declare function safeCreateQueueTree(cfg: any, data: any, originalCreateQueueTree: Function): Promise<any>;
/**
 * Wrapper for queue tree updates
 */
export declare function safeUpdateQueueTree(cfg: any, id: string, data: any, originalUpdateQueueTree: Function): Promise<any>;
//# sourceMappingURL=mikrotikQueueHandler.d.ts.map