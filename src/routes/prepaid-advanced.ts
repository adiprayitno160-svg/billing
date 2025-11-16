/**
 * Advanced Prepaid Routes
 * 
 * Routes for the new advanced prepaid system
 */

import express from 'express';
import AdvancedPrepaidAdminController from '../controllers/prepaid/advanced/AdvancedPrepaidAdminController';
import AdvancedPrepaidPortalController from '../controllers/prepaid/advanced/AdvancedPrepaidPortalController';
import { AuthMiddleware } from '../middlewares/authMiddleware';
import { requirePortalAuth, attachPortalSession } from '../middlewares/portalAuth';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Apply session attachment to portal routes
router.use('/portal', attachPortalSession);

// ============================================
// ADMIN ROUTES (Authentication REQUIRED)
// ============================================

const requireAdminAuth = authMiddleware.requireAuth.bind(authMiddleware);

// Dashboard
router.get('/admin/dashboard', requireAdminAuth, AdvancedPrepaidAdminController.dashboard);

// Package Management
router.get('/admin/packages', requireAdminAuth, AdvancedPrepaidAdminController.packages);
router.get('/admin/packages/create', requireAdminAuth, AdvancedPrepaidAdminController.showCreatePackage);
router.get('/admin/packages/edit/:id', requireAdminAuth, AdvancedPrepaidAdminController.showEditPackage);
router.post('/admin/packages/create', requireAdminAuth, AdvancedPrepaidAdminController.createPackage);
router.post('/admin/packages/update/:id', requireAdminAuth, AdvancedPrepaidAdminController.updatePackage);

// Subscriptions
router.get('/admin/subscriptions', requireAdminAuth, AdvancedPrepaidAdminController.subscriptions);

// Vouchers
router.get('/admin/vouchers', requireAdminAuth, AdvancedPrepaidAdminController.vouchers);

// Referrals
router.get('/admin/referrals', requireAdminAuth, AdvancedPrepaidAdminController.referrals);

// Analytics
router.get('/admin/analytics', requireAdminAuth, AdvancedPrepaidAdminController.analytics);

// ============================================
// PORTAL ROUTES (Customer-facing)
// ============================================

// Dashboard
router.get('/portal/dashboard', requirePortalAuth, AdvancedPrepaidPortalController.dashboard);

// Packages
router.get('/portal/packages', requirePortalAuth, AdvancedPrepaidPortalController.packages);
router.get('/portal/packages/:id', requirePortalAuth, AdvancedPrepaidPortalController.packageDetail);
router.get('/portal/packages/:id/purchase', requirePortalAuth, AdvancedPrepaidPortalController.purchasePackage);
router.post('/portal/purchase', requirePortalAuth, AdvancedPrepaidPortalController.processPurchase);

// Usage
router.get('/portal/usage', requirePortalAuth, AdvancedPrepaidPortalController.usageHistory);

// Referrals
router.get('/portal/referrals', requirePortalAuth, AdvancedPrepaidPortalController.referrals);

export default router;




