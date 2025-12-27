"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PortalController_1 = require("../controllers/portal/PortalController");
const router = (0, express_1.Router)();
const portalController = new PortalController_1.PortalController();
// Portal routes
router.get('/login', portalController.getPortalLogin.bind(portalController));
router.post('/login', portalController.postPortalLogin.bind(portalController));
router.get('/packages', portalController.getPortalPackages.bind(portalController));
router.post('/packages', portalController.postPurchasePackage.bind(portalController));
router.get('/profile', portalController.getPortalProfile.bind(portalController));
router.post('/logout', portalController.postPortalLogout.bind(portalController));
exports.default = router;
//# sourceMappingURL=portal.js.map