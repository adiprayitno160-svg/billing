"use strict";
/**
 * Advanced Prepaid Routes
 *
 * Routes for the new advanced prepaid system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AdvancedPrepaidAdminController_1 = __importDefault(require("../controllers/prepaid/advanced/AdvancedPrepaidAdminController"));
const AdvancedPrepaidPortalController_1 = __importDefault(require("../controllers/prepaid/advanced/AdvancedPrepaidPortalController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const portalAuth_1 = require("../middlewares/portalAuth");
const router = express_1.default.Router();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// Apply session attachment to portal routes
router.use('/portal', portalAuth_1.attachPortalSession);
// ============================================
// ADMIN ROUTES (Authentication REQUIRED)
// ============================================
const requireAdminAuth = authMiddleware.requireAuth.bind(authMiddleware);
// Dashboard
router.get('/admin/dashboard', requireAdminAuth, AdvancedPrepaidAdminController_1.default.dashboard);
// Package Management
router.get('/admin/packages', requireAdminAuth, AdvancedPrepaidAdminController_1.default.packages);
router.get('/admin/packages/create', requireAdminAuth, AdvancedPrepaidAdminController_1.default.showCreatePackage);
router.get('/admin/packages/edit/:id', requireAdminAuth, AdvancedPrepaidAdminController_1.default.showEditPackage);
router.post('/admin/packages/create', requireAdminAuth, AdvancedPrepaidAdminController_1.default.createPackage);
router.post('/admin/packages/update/:id', requireAdminAuth, AdvancedPrepaidAdminController_1.default.updatePackage);
// Subscriptions
router.get('/admin/subscriptions', requireAdminAuth, AdvancedPrepaidAdminController_1.default.subscriptions);
// Vouchers
router.get('/admin/vouchers', requireAdminAuth, AdvancedPrepaidAdminController_1.default.vouchers);
// Referrals
router.get('/admin/referrals', requireAdminAuth, AdvancedPrepaidAdminController_1.default.referrals);
// Analytics
router.get('/admin/analytics', requireAdminAuth, AdvancedPrepaidAdminController_1.default.analytics);
// ============================================
// PORTAL ROUTES (Customer-facing)
// ============================================
// Dashboard
router.get('/portal/dashboard', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.dashboard);
// Packages
router.get('/portal/packages', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.packages);
router.get('/portal/packages/:id', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.packageDetail);
router.get('/portal/packages/:id/purchase', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.purchasePackage);
router.post('/portal/purchase', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.processPurchase);
// Usage
router.get('/portal/usage', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.usageHistory);
// Referrals
router.get('/portal/referrals', portalAuth_1.requirePortalAuth, AdvancedPrepaidPortalController_1.default.referrals);
exports.default = router;
//# sourceMappingURL=prepaid-advanced.js.map