/**
 * Maintenance Schedule Routes
 */

import express from 'express';
import MaintenanceController from '../controllers/monitoring/maintenanceController';
import { isAuthenticated, isAdmin } from '../middlewares/authMiddleware';

const router = express.Router();
const controller = new MaintenanceController();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// ==================== WEB ROUTES ====================

/**
 * GET /monitoring/maintenance
 * List all maintenance schedules
 */
router.get('/', controller.list.bind(controller));

/**
 * GET /monitoring/maintenance/create
 * Show create form
 */
router.get('/create', isAdmin, controller.showCreate.bind(controller));

/**
 * GET /monitoring/maintenance/:id
 * View maintenance detail
 */
router.get('/:id', controller.detail.bind(controller));

// ==================== API ROUTES (ADMIN ONLY) ====================

/**
 * POST /api/monitoring/maintenance
 * Create new maintenance schedule
 */
router.post('/api', isAdmin, controller.create.bind(controller));

/**
 * POST /api/monitoring/maintenance/:id/start
 * Start maintenance
 */
router.post('/api/:id/start', isAdmin, controller.start.bind(controller));

/**
 * POST /api/monitoring/maintenance/:id/complete
 * Complete maintenance
 */
router.post('/api/:id/complete', isAdmin, controller.complete.bind(controller));

/**
 * POST /api/monitoring/maintenance/:id/cancel
 * Cancel maintenance
 */
router.post('/api/:id/cancel', isAdmin, controller.cancel.bind(controller));

/**
 * POST /api/monitoring/maintenance/:id/send-notification
 * Send notification manually
 */
router.post('/api/:id/send-notification', isAdmin, controller.sendNotification.bind(controller));

export default router;

