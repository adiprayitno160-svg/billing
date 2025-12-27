"use strict";
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
exports.pppoeStatsMiddleware = pppoeStatsMiddleware;
const MikrotikService_1 = require("../services/mikrotik/MikrotikService");
/**
 * Middleware to add PPPoE statistics to res.locals for sidebar display
 */
async function pppoeStatsMiddleware(req, res, next) {
    try {
        // Initialize default stats
        res.locals.pppoeStats = {
            total: 0,
            active: 0,
            online: 0
        };
        // Get MikroTik service instance
        const mikrotikService = await MikrotikService_1.MikrotikService.getInstance();
        // Check if connected
        const isConnected = await mikrotikService.testConnection();
        if (isConnected) {
            // Get active PPPoE sessions (online users)
            const activeSessions = await mikrotikService.getActivePPPoESessions();
            const onlineCount = activeSessions ? activeSessions.length : 0;
            // Get all PPPoE secrets from database
            const { databasePool } = await Promise.resolve().then(() => __importStar(require('../db/pool')));
            const [secrets] = await databasePool.query('SELECT COUNT(*) as total FROM pppoe_secrets');
            const totalCount = secrets[0]?.total || 0;
            // Get active (non-disabled) secrets
            const [activeSecrets] = await databasePool.query('SELECT COUNT(*) as active FROM pppoe_secrets WHERE disabled = 0');
            const activeCount = activeSecrets[0]?.active || 0;
            res.locals.pppoeStats = {
                total: totalCount,
                active: activeCount,
                online: onlineCount
            };
        }
    }
    catch (error) {
        console.error('Error in pppoeStatsMiddleware:', error);
        // Keep default values on error
    }
    next();
}
//# sourceMappingURL=pppoeStatsMiddleware.js.map