/**
 * SLA Routes - Service Level Agreement Management
 */

import express from 'express';
import SLAController from '../controllers/monitoring/slaController';
import { isAuthenticated, isAdmin } from '../middlewares/authMiddleware';

const router = express.Router();
const controller = new SLAController();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// ==================== WEB ROUTES ====================

/**
 * GET /monitoring/sla
 * SLA Dashboard - Overview
 */
router.get('/', controller.dashboard.bind(controller));

/**
 * GET /monitoring/sla/analysis/:customerId
 * Customer SLA Analysis Data
 */
router.get('/analysis/:customerId', controller.getAnalysis.bind(controller));

/**
 * GET /monitoring/sla/customer/:customerId
 * Customer SLA Detail
 */
router.get('/customer/:customerId', controller.customerDetail.bind(controller));

/**
 * GET /monitoring/sla/incidents
 * List all incidents
 */
router.get('/incidents', controller.incidents.bind(controller));

// ==================== API ROUTES (ADMIN ONLY) ====================

/**
 * POST /monitoring/sla/incident/:id/exclude
 * Exclude incident from SLA calculation
 */
router.post('/incident/:id/exclude', isAdmin, controller.excludeIncident.bind(controller));

/**
 * POST /monitoring/sla/discount/:id/approve
 * Approve SLA discount
 */
router.post('/discount/:id/approve', isAdmin, controller.approveDiscount.bind(controller));

/**
 * POST /api/monitoring/sla/calculate
 * Manually trigger SLA calculation
 */
router.post('/api/calculate', isAdmin, controller.triggerCalculation.bind(controller));

// ==================== API ROUTES (PUBLIC - AUTHENTICATED) ====================

/**
 * GET /api/monitoring/bandwidth/:customerId
 * Get bandwidth trend data
 */
router.get('/api/bandwidth/:customerId', controller.getBandwidthTrend.bind(controller));

/**
 * GET /api/monitoring/sla/stats
 * Get SLA statistics
 */
router.get('/api/stats', controller.getStats.bind(controller));

export default router;
