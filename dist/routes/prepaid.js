"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PrepaidPortalController_1 = __importDefault(require("../controllers/prepaid/PrepaidPortalController"));
const PrepaidPackageController_1 = __importDefault(require("../controllers/prepaid/PrepaidPackageController"));
const PrepaidPaymentController_1 = __importDefault(require("../controllers/prepaid/PrepaidPaymentController"));
const PrepaidAdminControllerFull_1 = __importDefault(require("../controllers/prepaid/PrepaidAdminControllerFull"));
const PrepaidAddressListController_1 = __importDefault(require("../controllers/prepaid/PrepaidAddressListController"));
const PrepaidMikrotikSetupController_1 = __importDefault(require("../controllers/prepaid/PrepaidMikrotikSetupController"));
const PrepaidSpeedProfileController_1 = __importDefault(require("../controllers/prepaid/PrepaidSpeedProfileController"));
// New controllers for complete payment system
const PrepaidPackageManagementController_1 = __importDefault(require("../controllers/prepaid/PrepaidPackageManagementController"));
const PrepaidPortalPaymentController_1 = __importDefault(require("../controllers/prepaid/PrepaidPortalPaymentController"));
const PrepaidAdminPaymentController_1 = __importDefault(require("../controllers/prepaid/PrepaidAdminPaymentController"));
const portalAuth_1 = require("../middlewares/portalAuth");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// Apply session attachment to all routes
router.use(portalAuth_1.attachPortalSession);
// ============================================
// PORTAL ROUTES (Customer-facing)
// ============================================
// Public routes (no auth required)
router.get('/portal/splash', (req, res) => {
    // Set no-cache headers to prevent browser/proxy caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.render('prepaid/splash', {
        title: 'Internet Access - Portal Prepaid',
        layout: false
    });
});
router.get('/portal/login', portalAuth_1.redirectIfPortalAuthenticated, PrepaidPortalController_1.default.showLogin);
router.post('/portal/login', PrepaidPortalController_1.default.processLogin);
// Protected portal routes (authentication REQUIRED)
router.get('/portal/logout', portalAuth_1.requirePortalAuth, PrepaidPortalController_1.default.logout);
router.get('/portal/dashboard', portalAuth_1.requirePortalAuth, PrepaidPortalController_1.default.showDashboard);
router.get('/portal/usage', portalAuth_1.requirePortalAuth, PrepaidPortalController_1.default.showUsage);
// Package selection (OLD - for backward compatibility)
router.get('/portal/packages-old', portalAuth_1.requirePortalAuth, PrepaidPackageController_1.default.showPackages);
router.get('/portal/packages-old/:id', portalAuth_1.requirePortalAuth, PrepaidPackageController_1.default.showPackageDetail);
router.post('/portal/packages-old/select', portalAuth_1.requirePortalAuth, PrepaidPackageController_1.default.selectPackage);
// Payment routes (OLD - for backward compatibility)
router.get('/portal/payment-old/:packageId', portalAuth_1.requirePortalAuth, PrepaidPaymentController_1.default.showPaymentPage);
router.post('/portal/payment-old/process', portalAuth_1.requirePortalAuth, PrepaidPaymentController_1.default.processPayment);
router.get('/portal/payment-old-waiting', portalAuth_1.requirePortalAuth, PrepaidPaymentController_1.default.showPaymentWaiting);
router.get('/portal/success-old', portalAuth_1.requirePortalAuth, PrepaidPaymentController_1.default.showSuccessPage);
// NEW: Complete Payment Flow (Self-Service with Manual Transfer & Payment Gateway)
router.get('/portal/packages', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.selectPackage);
router.get('/portal/packages/review/:package_id', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.reviewPackage);
router.post('/portal/payment/select-method', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.selectPaymentMethod);
router.post('/portal/payment/manual-transfer', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.processManualTransfer);
router.post('/portal/payment/gateway', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.processPaymentGateway);
router.get('/portal/payment/waiting/:transaction_id', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.showWaitingPage);
router.get('/portal/payment/success/:transaction_id', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.showSuccessPage);
router.get('/portal/api/payment/status/:transaction_id', portalAuth_1.requirePortalAuth, PrepaidPortalPaymentController_1.default.checkPaymentStatus);
// ============================================
// API ROUTES
// ============================================
// Package API
router.get('/api/packages', PrepaidPackageController_1.default.getActivePackagesAPI);
router.get('/api/packages/:id', PrepaidPackageController_1.default.getPackageByIdAPI);
// Payment status check (authentication DISABLED)
router.get('/api/payment/status/:invoiceId', PrepaidPaymentController_1.default.checkPaymentStatus);
// ============================================
// ADMIN ROUTES (Authentication REQUIRED)
// ============================================
// Dashboard & Overview
router.get('/dashboard', authMiddleware.requireAuth.bind(authMiddleware), PrepaidAdminControllerFull_1.default.dashboard);
// Apply auth middleware to all admin routes
const requireAdminAuth = authMiddleware.requireAuth.bind(authMiddleware);
// Customer Management
router.get('/customers', requireAdminAuth, PrepaidAdminControllerFull_1.default.customers);
// Package Management (Old - for backward compatibility)
router.get('/packages-old', requireAdminAuth, PrepaidAdminControllerFull_1.default.packages);
router.post('/packages-old/create', requireAdminAuth, PrepaidAdminControllerFull_1.default.createPackage);
router.post('/packages-old/update/:id', requireAdminAuth, PrepaidAdminControllerFull_1.default.updatePackage);
router.post('/packages-old/delete/:id', requireAdminAuth, PrepaidAdminControllerFull_1.default.deletePackage);
// NEW Package Management (PPPoE & Static IP support)
router.get('/packages', requireAdminAuth, PrepaidPackageManagementController_1.default.index);
router.get('/packages/create', requireAdminAuth, PrepaidPackageManagementController_1.default.showCreateForm);
router.post('/packages/create', requireAdminAuth, PrepaidPackageManagementController_1.default.createPackage);
router.get('/packages/edit/:package_id', requireAdminAuth, PrepaidPackageManagementController_1.default.showEditForm);
router.post('/packages/update/:package_id', requireAdminAuth, PrepaidPackageManagementController_1.default.updatePackage);
router.post('/packages/delete/:package_id', requireAdminAuth, PrepaidPackageManagementController_1.default.deletePackage);
router.get('/packages/api/parent-queues', requireAdminAuth, PrepaidPackageManagementController_1.default.getParentQueues);
router.get('/packages/api/profile-rate-limit', requireAdminAuth, PrepaidPackageManagementController_1.default.getProfileRateLimit);
// Customer Portal Access
router.post('/customers/create-portal-access', requireAdminAuth, PrepaidAdminControllerFull_1.default.createPortalAccess);
// Manual Activation & Deactivation
router.post('/subscriptions/activate', requireAdminAuth, PrepaidAdminControllerFull_1.default.manualActivation);
router.post('/subscriptions/deactivate/:id', requireAdminAuth, PrepaidAdminControllerFull_1.default.deactivateSubscription);
// NEW: Payment Verification (Admin)
router.get('/payment-verification', requireAdminAuth, PrepaidAdminPaymentController_1.default.index);
router.post('/payment-verification/verify/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController_1.default.verifyPayment);
router.post('/payment-verification/reject/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController_1.default.rejectPayment);
router.get('/payment-verification/proof/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController_1.default.viewPaymentProof);
router.get('/payment-verification/statistics', requireAdminAuth, PrepaidAdminPaymentController_1.default.getPaymentStatistics);
// Speed Profiles (PPPoE Profiles Management)
router.get('/speed-profiles', requireAdminAuth, PrepaidSpeedProfileController_1.default.index);
router.post('/speed-profiles/create', requireAdminAuth, PrepaidSpeedProfileController_1.default.createProfile);
router.post('/speed-profiles/update/:profile_id', requireAdminAuth, PrepaidSpeedProfileController_1.default.updateProfile);
router.post('/speed-profiles/delete/:profile_id', requireAdminAuth, PrepaidSpeedProfileController_1.default.deleteProfile);
// Address List Management (Full UI)
router.get('/address-list', requireAdminAuth, PrepaidAddressListController_1.default.index);
router.post('/address-list/add', requireAdminAuth, PrepaidAddressListController_1.default.addToList);
router.post('/address-list/remove', requireAdminAuth, PrepaidAddressListController_1.default.removeFromList);
router.post('/address-list/move', requireAdminAuth, PrepaidAddressListController_1.default.moveToList);
router.post('/address-list/clear', requireAdminAuth, PrepaidAddressListController_1.default.clearList);
// Mikrotik Setup Wizard (One-Click Setup)
router.get('/mikrotik-setup/test-simple', requireAdminAuth, (req, res) => {
    res.send('<h1>Mikrotik Setup Route Working!</h1><p>If you see this, routes are OK.</p><a href="/prepaid/mikrotik-setup">Go to Setup Wizard</a>');
});
router.get('/mikrotik-setup', requireAdminAuth, PrepaidMikrotikSetupController_1.default.showSetupWizard);
router.post('/mikrotik-setup/setup', requireAdminAuth, PrepaidMikrotikSetupController_1.default.setupMikrotik);
router.post('/mikrotik-setup/test', requireAdminAuth, PrepaidMikrotikSetupController_1.default.testConnection);
router.post('/mikrotik-setup/reset', requireAdminAuth, PrepaidMikrotikSetupController_1.default.resetSetup);
// Active Subscriptions
router.get('/subscriptions', requireAdminAuth, PrepaidAdminControllerFull_1.default.subscriptions);
// Reports
router.get('/reports', requireAdminAuth, PrepaidAdminControllerFull_1.default.reports);
// Manual triggers
router.post('/trigger-scheduler', requireAdminAuth, PrepaidAdminControllerFull_1.default.triggerScheduler);
exports.default = router;
//# sourceMappingURL=prepaid.js.map