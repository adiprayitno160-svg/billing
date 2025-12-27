"use strict";
/**
 * Maintenance Schedule Routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const maintenanceController_1 = __importDefault(require("../controllers/monitoring/maintenanceController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
const controller = new maintenanceController_1.default();
// Apply authentication middleware to all routes
router.use(authMiddleware_1.isAuthenticated);
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
router.get('/create', authMiddleware_1.isAdmin, controller.showCreate.bind(controller));
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
router.post('/api', authMiddleware_1.isAdmin, controller.create.bind(controller));
/**
 * POST /api/monitoring/maintenance/:id/start
 * Start maintenance
 */
router.post('/api/:id/start', authMiddleware_1.isAdmin, controller.start.bind(controller));
/**
 * POST /api/monitoring/maintenance/:id/complete
 * Complete maintenance
 */
router.post('/api/:id/complete', authMiddleware_1.isAdmin, controller.complete.bind(controller));
/**
 * POST /api/monitoring/maintenance/:id/cancel
 * Cancel maintenance
 */
router.post('/api/:id/cancel', authMiddleware_1.isAdmin, controller.cancel.bind(controller));
/**
 * POST /api/monitoring/maintenance/:id/send-notification
 * Send notification manually
 */
router.post('/api/:id/send-notification', authMiddleware_1.isAdmin, controller.sendNotification.bind(controller));
exports.default = router;
//# sourceMappingURL=maintenance.js.map