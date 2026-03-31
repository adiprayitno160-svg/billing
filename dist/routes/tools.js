"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MigrationController_1 = require("../controllers/tools/MigrationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// All routes require authentication
router.use(authMiddleware.requireAuth);
// Migration routes
router.post('/migrate/postpaid-ppn', MigrationController_1.MigrationController.runPostpaidPpnMigration);
exports.default = router;
//# sourceMappingURL=tools.js.map