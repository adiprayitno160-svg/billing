"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const StaticIpImportController_1 = require("../controllers/StaticIpImportController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const controller = new StaticIpImportController_1.StaticIpImportController();
// Menggunakan middleware auth untuk semua route di sini
router.use(authMiddleware_1.isAuthenticated);
router.get('/settings/static-ip/import', (req, res) => controller.renderPage(req, res));
router.get('/api/static-ip/import/scan', (req, res) => controller.scan(req, res));
router.post('/api/static-ip/import/link', (req, res) => controller.linkCustomer(req, res));
// Rute Baru untuk Import Form (Adopsi)
router.get('/customers/import', (req, res) => controller.renderFormImport(req, res));
router.post('/api/static-ip/import/create-link', (req, res) => controller.createAndLink(req, res));
exports.default = router;
//# sourceMappingURL=staticIpImportRoutes.js.map