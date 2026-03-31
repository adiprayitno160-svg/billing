"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PackageApiController_1 = require("../../controllers/api/PackageApiController");
const router = (0, express_1.Router)();
// PPPoE specific package detail
router.get('/packages/pppoe/:id', PackageApiController_1.PackageApiController.getPppoePackageDetail);
// List packages by type (pppoe, static_ip)
router.get('/packages/:connectionType', PackageApiController_1.PackageApiController.getPackagesByType);
exports.default = router;
//# sourceMappingURL=packageApiRoutes.js.map