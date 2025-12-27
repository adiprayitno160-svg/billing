"use strict";
/**
 * SLA Routes - Service Level Agreement Management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const slaController_1 = __importDefault(require("../controllers/monitoring/slaController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
const controller = new slaController_1.default();
// Apply authentication middleware to all routes
router.use(authMiddleware_1.isAuthenticated);
// ==================== WEB ROUTES ====================
/**
 * GET /monitoring/sla
 * SLA Dashboard - Overview
 */
router.get('/', controller.dashboard.bind(controller));
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
router.post('/incident/:id/exclude', authMiddleware_1.isAdmin, controller.excludeIncident.bind(controller));
/**
 * POST /monitoring/sla/discount/:id/approve
 * Approve SLA discount
 */
router.post('/discount/:id/approve', authMiddleware_1.isAdmin, controller.approveDiscount.bind(controller));
/**
 * POST /api/monitoring/sla/calculate
 * Manually trigger SLA calculation
 */
router.post('/api/calculate', authMiddleware_1.isAdmin, controller.triggerCalculation.bind(controller));
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
exports.default = router;
//# sourceMappingURL=sla.js.map