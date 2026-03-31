"use strict";
/**
 * MikroTik Queue Error Handler
 * Intercepts queue creation calls and applies safe defaults
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueueWithErrorHandling = createQueueWithErrorHandling;
exports.safeCreateQueueTree = safeCreateQueueTree;
exports.safeUpdateQueueTree = safeUpdateQueueTree;
const mikrotikQueueFix_1 = require("../utils/mikrotikQueueFix");
/**
 * Wrapper function that sanitizes queue configuration before passing to MikroTik
 */
async function createQueueWithErrorHandling(originalCreateFunction, cfg, data) {
    try {
        // Sanitize the queue configuration
        const safeData = (0, mikrotikQueueFix_1.sanitizeQueueConfig)(data);
        console.log('[QueueHandler] Original data:', data);
        console.log('[QueueHandler] Sanitized data:', safeData);
        // Call the original function with safe data
        return await originalCreateFunction(cfg, safeData);
    }
    catch (error) {
        console.error('[QueueHandler] Queue creation failed:', error.message);
        // If it's a queue type error, try with 'default' queue type
        if (error.message && error.message.includes('input does not match any value of queue')) {
            console.log('[QueueHandler] Retrying with default queue type...');
            const fallbackData = {
                ...(0, mikrotikQueueFix_1.sanitizeQueueConfig)(data),
                queue: 'default'
            };
            try {
                return await originalCreateFunction(cfg, fallbackData);
            }
            catch (retryError) {
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
async function safeCreateQueueTree(cfg, data, originalCreateQueueTree) {
    return createQueueWithErrorHandling(originalCreateQueueTree, cfg, data);
}
/**
 * Wrapper for queue tree updates
 */
async function safeUpdateQueueTree(cfg, id, data, originalUpdateQueueTree) {
    try {
        // Just sanitize the queue type for updates
        const safeData = { ...data };
        if (safeData.queue) {
            const { resolveSafeQueueType } = await Promise.resolve().then(() => __importStar(require('../utils/mikrotikQueueFix')));
            safeData.queue = resolveSafeQueueType(safeData.queue);
        }
        return await originalUpdateQueueTree(cfg, id, safeData);
    }
    catch (error) {
        console.error('[QueueHandler] Queue update failed:', error.message);
        throw error;
    }
}
//# sourceMappingURL=mikrotikQueueHandler.js.map