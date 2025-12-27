"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GenieacsController_1 = require("../controllers/GenieacsController");
const router = (0, express_1.Router)();
// Dashboard
router.get('/', GenieacsController_1.GenieacsController.dashboard);
// Device list
router.get('/devices', GenieacsController_1.GenieacsController.devices);
// Device detail
router.get('/devices/:id', GenieacsController_1.GenieacsController.deviceDetail);
// Device actions
router.post('/devices/:id/reboot', GenieacsController_1.GenieacsController.rebootDevice);
router.post('/devices/:id/refresh', GenieacsController_1.GenieacsController.refreshDevice);
router.post('/devices/:id/change-wifi', GenieacsController_1.GenieacsController.changeWiFiCredentials);
// API endpoints
router.get('/api/devices', GenieacsController_1.GenieacsController.apiGetDevices);
router.get('/api/test-connection', GenieacsController_1.GenieacsController.apiTestConnection);
exports.default = router;
//# sourceMappingURL=genieacs.js.map