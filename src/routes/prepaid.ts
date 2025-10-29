import express from 'express';
import PrepaidPortalController from '../controllers/prepaid/PrepaidPortalController';
import PrepaidPackageController from '../controllers/prepaid/PrepaidPackageController';
import PrepaidPaymentController from '../controllers/prepaid/PrepaidPaymentController';
import PrepaidAdminController from '../controllers/prepaid/PrepaidAdminControllerFull';
import PrepaidAddressListController from '../controllers/prepaid/PrepaidAddressListController';
import PrepaidMikrotikSetupController from '../controllers/prepaid/PrepaidMikrotikSetupController';
import PrepaidSpeedProfileController from '../controllers/prepaid/PrepaidSpeedProfileController';

// New controllers for complete payment system
import PrepaidPackageManagementController from '../controllers/prepaid/PrepaidPackageManagementController';
import PrepaidPortalPaymentController from '../controllers/prepaid/PrepaidPortalPaymentController';
import PrepaidAdminPaymentController from '../controllers/prepaid/PrepaidAdminPaymentController';

import { requirePortalAuth, redirectIfPortalAuthenticated, attachPortalSession } from '../middlewares/portalAuth';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Apply session attachment to all routes
router.use(attachPortalSession);

// ============================================
// PORTAL ROUTES (Customer-facing)
// ============================================

// Public routes (no auth required)
router.get('/portal/splash', (req, res) => {
  res.render('prepaid/splash', {
    title: 'Internet Access - Portal Prepaid',
    layout: false
  });
});
router.get('/portal/login', redirectIfPortalAuthenticated, PrepaidPortalController.showLogin);
router.post('/portal/login', PrepaidPortalController.processLogin);

// Protected portal routes (authentication REQUIRED)
router.get('/portal/logout', requirePortalAuth, PrepaidPortalController.logout);
router.get('/portal/dashboard', requirePortalAuth, PrepaidPortalController.showDashboard);
router.get('/portal/usage', requirePortalAuth, PrepaidPortalController.showUsage);

// Package selection (OLD - for backward compatibility)
router.get('/portal/packages-old', requirePortalAuth, PrepaidPackageController.showPackages);
router.get('/portal/packages-old/:id', requirePortalAuth, PrepaidPackageController.showPackageDetail);
router.post('/portal/packages-old/select', requirePortalAuth, PrepaidPackageController.selectPackage);

// Payment routes (OLD - for backward compatibility)
router.get('/portal/payment-old/:packageId', requirePortalAuth, PrepaidPaymentController.showPaymentPage);
router.post('/portal/payment-old/process', requirePortalAuth, PrepaidPaymentController.processPayment);
router.get('/portal/payment-old-waiting', requirePortalAuth, PrepaidPaymentController.showPaymentWaiting);
router.get('/portal/success-old', requirePortalAuth, PrepaidPaymentController.showSuccessPage);

// NEW: Complete Payment Flow (Self-Service with Manual Transfer & Payment Gateway)
router.get('/portal/packages', requirePortalAuth, PrepaidPortalPaymentController.selectPackage);
router.get('/portal/packages/review/:package_id', requirePortalAuth, PrepaidPortalPaymentController.reviewPackage);
router.post('/portal/payment/select-method', requirePortalAuth, PrepaidPortalPaymentController.selectPaymentMethod);
router.post('/portal/payment/manual-transfer', requirePortalAuth, PrepaidPortalPaymentController.processManualTransfer);
router.post('/portal/payment/gateway', requirePortalAuth, PrepaidPortalPaymentController.processPaymentGateway);
router.get('/portal/payment/waiting/:transaction_id', requirePortalAuth, PrepaidPortalPaymentController.showWaitingPage);
router.get('/portal/payment/success/:transaction_id', requirePortalAuth, PrepaidPortalPaymentController.showSuccessPage);
router.get('/portal/api/payment/status/:transaction_id', requirePortalAuth, PrepaidPortalPaymentController.checkPaymentStatus);

// ============================================
// API ROUTES
// ============================================

// Package API
router.get('/api/packages', PrepaidPackageController.getActivePackagesAPI);
router.get('/api/packages/:id', PrepaidPackageController.getPackageByIdAPI);

// Payment status check (authentication DISABLED)
router.get('/api/payment/status/:invoiceId', PrepaidPaymentController.checkPaymentStatus);

// ============================================
// ADMIN ROUTES (Authentication REQUIRED)
// ============================================

// Dashboard & Overview
router.get('/dashboard', authMiddleware.requireAuth.bind(authMiddleware), PrepaidAdminController.dashboard);

// Apply auth middleware to all admin routes
const requireAdminAuth = authMiddleware.requireAuth.bind(authMiddleware);

// Customer Management
router.get('/customers', requireAdminAuth, PrepaidAdminController.customers);

// Package Management (Old - for backward compatibility)
router.get('/packages-old', requireAdminAuth, PrepaidAdminController.packages);
router.post('/packages-old/create', requireAdminAuth, PrepaidAdminController.createPackage);
router.post('/packages-old/update/:id', requireAdminAuth, PrepaidAdminController.updatePackage);
router.post('/packages-old/delete/:id', requireAdminAuth, PrepaidAdminController.deletePackage);

// NEW Package Management (PPPoE & Static IP support)
router.get('/packages', requireAdminAuth, PrepaidPackageManagementController.index);
router.get('/packages/create', requireAdminAuth, PrepaidPackageManagementController.showCreateForm);
router.post('/packages/create', requireAdminAuth, PrepaidPackageManagementController.createPackage);
router.get('/packages/edit/:package_id', requireAdminAuth, PrepaidPackageManagementController.showEditForm);
router.post('/packages/update/:package_id', requireAdminAuth, PrepaidPackageManagementController.updatePackage);
router.post('/packages/delete/:package_id', requireAdminAuth, PrepaidPackageManagementController.deletePackage);
router.get('/packages/api/parent-queues', requireAdminAuth, PrepaidPackageManagementController.getParentQueues);

// Customer Portal Access
router.post('/customers/create-portal-access', requireAdminAuth, PrepaidAdminController.createPortalAccess);

// Manual Activation & Deactivation
router.post('/subscriptions/activate', requireAdminAuth, PrepaidAdminController.manualActivation);
router.post('/subscriptions/deactivate/:id', requireAdminAuth, PrepaidAdminController.deactivateSubscription);

// NEW: Payment Verification (Admin)
router.get('/payment-verification', requireAdminAuth, PrepaidAdminPaymentController.index);
router.post('/payment-verification/verify/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController.verifyPayment);
router.post('/payment-verification/reject/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController.rejectPayment);
router.get('/payment-verification/proof/:transaction_id', requireAdminAuth, PrepaidAdminPaymentController.viewPaymentProof);
router.get('/payment-verification/statistics', requireAdminAuth, PrepaidAdminPaymentController.getPaymentStatistics);

// Speed Profiles (PPPoE Profiles Management)
router.get('/speed-profiles', requireAdminAuth, PrepaidSpeedProfileController.index);
router.post('/speed-profiles/create', requireAdminAuth, PrepaidSpeedProfileController.createProfile);
router.post('/speed-profiles/update/:profile_id', requireAdminAuth, PrepaidSpeedProfileController.updateProfile);
router.post('/speed-profiles/delete/:profile_id', requireAdminAuth, PrepaidSpeedProfileController.deleteProfile);

// Address List Management (Full UI)
router.get('/address-list', requireAdminAuth, PrepaidAddressListController.index);
router.post('/address-list/add', requireAdminAuth, PrepaidAddressListController.addToList);
router.post('/address-list/remove', requireAdminAuth, PrepaidAddressListController.removeFromList);
router.post('/address-list/move', requireAdminAuth, PrepaidAddressListController.moveToList);
router.post('/address-list/clear', requireAdminAuth, PrepaidAddressListController.clearList);

// Mikrotik Setup Wizard (One-Click Setup)
router.get('/mikrotik-setup/test-simple', requireAdminAuth, (req, res) => {
  res.send('<h1>Mikrotik Setup Route Working!</h1><p>If you see this, routes are OK.</p><a href="/prepaid/mikrotik-setup">Go to Setup Wizard</a>');
});
router.get('/mikrotik-setup', requireAdminAuth, PrepaidMikrotikSetupController.showSetupWizard);
router.post('/mikrotik-setup/setup', requireAdminAuth, PrepaidMikrotikSetupController.setupMikrotik);
router.post('/mikrotik-setup/test', requireAdminAuth, PrepaidMikrotikSetupController.testConnection);
router.post('/mikrotik-setup/reset', requireAdminAuth, PrepaidMikrotikSetupController.resetSetup);

// Active Subscriptions
router.get('/subscriptions', requireAdminAuth, PrepaidAdminController.subscriptions);

// Reports
router.get('/reports', requireAdminAuth, PrepaidAdminController.reports);

// Manual triggers
router.post('/trigger-scheduler', requireAdminAuth, PrepaidAdminController.triggerScheduler);

export default router;

