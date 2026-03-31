"use strict";
/**
 * Wrapper for MikroTik queue operations with automatic validation
 * This prevents "input does not match any value of queue" errors
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
exports.safeCreateQueueTree = safeCreateQueueTree;
exports.safeUpdateQueueTree = safeUpdateQueueTree;
exports.getSafeQueueTypes = getSafeQueueTypes;
const queueValidationHelper_1 = require("../utils/queueValidationHelper");
/**
 * Safe queue tree creation with automatic validation
 */
async function safeCreateQueueTree(cfg, data) {
    try {
        // Validate queue data before creation
        const validation = await (0, queueValidationHelper_1.preValidateQueueCreation)(data);
        if (!validation.valid) {
            throw new Error(`Queue validation failed: ${validation.errors.join(', ')}`);
        }
        const validatedData = validation.sanitizedData;
        // Import the original mikrotikService
        const { createQueueTree } = await Promise.resolve().then(() => __importStar(require('./mikrotikService')));
        console.log('[SafeQueue] Creating queue with validated data:', validatedData);
        await createQueueTree(cfg, validatedData);
    }
    catch (err) {
        console.error('[SafeQueue] Failed to create queue:', err.message);
        throw err;
    }
}
/**
 * Safe queue tree update with automatic validation
 */
async function safeUpdateQueueTree(cfg, id, data) {
    try {
        // Validate queue type if present
        const validatedData = { ...data };
        if (validatedData.queue) {
            validatedData.queue = await (0, queueValidationHelper_1.validateQueueType)(validatedData.queue);
        }
        // Import the original mikrotikService
        const { updateQueueTree } = await Promise.resolve().then(() => __importStar(require('./mikrotikService')));
        console.log('[SafeQueue] Updating queue with validated data:', validatedData);
        await updateQueueTree(cfg, id, validatedData);
    }
    catch (err) {
        console.error('[SafeQueue] Failed to update queue:', err.message);
        throw err;
    }
}
/**
 * Get safe queue types that definitely work
 */
async function getSafeQueueTypes() {
    try {
        const { getAvailableQueueTypes } = await Promise.resolve().then(() => __importStar(require('../utils/queueValidationHelper')));
        return await getAvailableQueueTypes();
    }
    catch (error) {
        // Fallback to known working types
        return ['default', 'ethernet', 'wireless', 'pcq'];
    }
}
//# sourceMappingURL=safeMikrotikQueueService.js.map