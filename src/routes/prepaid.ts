import express from 'express';
import PrepaidPortalController from '../controllers/prepaid/PrepaidPortalController';
import PrepaidPackageController from '../controllers/prepaid/PrepaidPackageController';
import PrepaidPaymentController from '../controllers/prepaid/PrepaidPaymentController';
import PrepaidAdminController from '../controllers/prepaid/PrepaidAdminControllerFull';
import { requirePortalAuth, redirectIfPortalAuthenticated, attachPortalSession } from '../middlewares/portalAuth';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Apply session attachment to all routes
router.use(attachPortalSession);

// ============================================
// PORTAL ROUTES (Customer-facing)
// ============================================
// 🔓 AUTHENTICATION DISABLED FOR TESTING

// Login routes
router.get('/portal/login', PrepaidPortalController.showLogin);
router.post('/portal/login', PrepaidPortalController.processLogin);
router.get('/portal/logout', PrepaidPortalController.logout);

// Protected portal routes (authentication DISABLED)
router.get('/portal/dashboard', PrepaidPortalController.showDashboard);
router.get('/portal/usage', PrepaidPortalController.showUsage);

// Package selection (authentication DISABLED)
router.get('/portal/packages', PrepaidPackageController.showPackages);
router.get('/portal/packages/:id', PrepaidPackageController.showPackageDetail);
router.post('/portal/packages/select', PrepaidPackageController.selectPackage);

// Payment routes (authentication DISABLED)
router.get('/portal/payment/:packageId', PrepaidPaymentController.showPaymentPage);
router.post('/portal/payment/process', PrepaidPaymentController.processPayment);
router.get('/portal/payment-waiting', PrepaidPaymentController.showPaymentWaiting);
router.get('/portal/success', PrepaidPaymentController.showSuccessPage);

// ============================================
// API ROUTES
// ============================================

// Package API
router.get('/api/packages', PrepaidPackageController.getActivePackagesAPI);
router.get('/api/packages/:id', PrepaidPackageController.getPackageByIdAPI);

// Payment status check (authentication DISABLED)
router.get('/api/payment/status/:invoiceId', PrepaidPaymentController.checkPaymentStatus);

// ============================================
// ADMIN ROUTES (Authentication DISABLED)
// ============================================
// 🔓 AUTHENTICATION DISABLED FOR TESTING

// Dashboard & Overview
router.get('/dashboard', PrepaidAdminController.dashboard);

// Customer Management
router.get('/customers', PrepaidAdminController.customers);

// Package Management
router.get('/packages', PrepaidAdminController.packages);
router.post('/packages/create', PrepaidAdminController.createPackage);
router.post('/packages/update/:id', PrepaidAdminController.updatePackage);
router.post('/packages/delete/:id', PrepaidAdminController.deletePackage);

// Customer Portal Access
router.post('/customers/create-portal-access', PrepaidAdminController.createPortalAccess);

// Manual Activation & Deactivation
router.post('/subscriptions/activate', PrepaidAdminController.manualActivation);
router.post('/subscriptions/deactivate/:id', PrepaidAdminController.deactivateSubscription);

// Speed Profiles
router.get('/speed-profiles', PrepaidAdminController.speedProfiles);

// Address List Management
router.get('/address-list', PrepaidAdminController.addressList);
router.post('/address-list/add', PrepaidAdminController.addToPortalRedirect);
router.post('/address-list/remove', PrepaidAdminController.removeFromPortalRedirect);

// Active Subscriptions
router.get('/subscriptions', PrepaidAdminController.subscriptions);

// Reports
router.get('/reports', PrepaidAdminController.reports);

// Manual triggers
router.post('/trigger-scheduler', PrepaidAdminController.triggerScheduler);

export default router;

