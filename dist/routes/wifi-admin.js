"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WiFiAdminController_1 = require("../controllers/WiFiAdminController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// All WiFi admin routes require authentication
router.use(authMiddleware_1.isAuthenticated);
// Dashboard
router.get('/', WiFiAdminController_1.WiFiAdminController.dashboard);
// Device Management
router.get('/devices', WiFiAdminController_1.WiFiAdminController.manageDevices);
router.post('/devices/assign', WiFiAdminController_1.WiFiAdminController.assignDevice);
router.post('/devices/remove', WiFiAdminController_1.WiFiAdminController.removeDevice);
// History
router.get('/history', WiFiAdminController_1.WiFiAdminController.history);
// Manual WiFi Change
router.post('/change', WiFiAdminController_1.WiFiAdminController.manualChange);
// API Routes
router.get('/api/customer/:id', WiFiAdminController_1.WiFiAdminController.apiGetCustomer);
router.get('/api/wifi-config/:device_id', WiFiAdminController_1.WiFiAdminController.apiGetWiFiConfig);
exports.default = router;
//# sourceMappingURL=wifi-admin.js.map