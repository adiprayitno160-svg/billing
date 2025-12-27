"use strict";
/**
 * General API Routes
 * Server time and other general utilities
  */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
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
exports.default = router;
//# sourceMappingURL=api.js.map