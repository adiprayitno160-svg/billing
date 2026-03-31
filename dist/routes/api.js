"use strict";
/**
 * General API Routes
 * Server time and other general utilities
  */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
/**
 * GET /api/server-time
 * Get current server time in ISO format
 */
router.get('/server-time', (req, res) => {
    const serverTime = new Date();
    res.json({
        success: true,
        serverTime: serverTime.toISOString(),
        timestamp: serverTime.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
});
// Proxy for IP Location (to avoid Mixed Content/CORS on client)
router.get('/proxy/ip-location', async (req, res) => {
    try {
        // Try to get client IP
        let clientIp = req.query.ip;
        if (!clientIp) {
            const forwarded = req.headers['x-forwarded-for'];
            clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress || '';
        }
        // Clean up IP (remove IPv6 prefix if present)
        if (clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.substring(7);
        }
        // If localhost, use external service to get public IP
        // BUT for local development, we want the *server's* public IP if client is local?
        // Actually, ip-api.com returns the requester's IP if no query param is passed.
        // So we can just call ip-api.com from the server.
        // However, if the server is also local (same network as client), it will return the same public IP.
        // Use axios or fetch
        const response = await axios_1.default.get('http://ip-api.com/json');
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching IP location:', error);
        res.status(500).json({ status: 'fail', message: error.message });
    }
});
const customerApiRoutes_1 = __importDefault(require("./api/customerApiRoutes"));
router.use(customerApiRoutes_1.default);
const packageApiRoutes_1 = __importDefault(require("./api/packageApiRoutes"));
router.use(packageApiRoutes_1.default);
const SystemUpdateController_1 = require("../controllers/api/SystemUpdateController");
router.get('/system/check-update', SystemUpdateController_1.checkSystemUpdate);
router.post('/system/update', SystemUpdateController_1.performSystemUpdate);
exports.default = router;
//# sourceMappingURL=api.js.map