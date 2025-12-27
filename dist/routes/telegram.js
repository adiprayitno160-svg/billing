"use strict";
/**
 * Telegram Bot Routes
 * Routes for Telegram Bot management and API endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TelegramAdminController_1 = __importDefault(require("../controllers/telegram/TelegramAdminController"));
const router = express_1.default.Router();
// ==========================================
// DASHBOARD & WEB VIEWS
// ==========================================
/**
 * GET /telegram/dashboard
 * Display Telegram Bot dashboard
 */
router.get('/dashboard', TelegramAdminController_1.default.dashboard);
/**
 * GET /telegram/users
 * Display Telegram users page
 */
router.get('/users', TelegramAdminController_1.default.usersPage);
// ==========================================
// API ENDPOINTS
// ==========================================
/**
 * GET /telegram/api/statistics
 * Get bot statistics
 */
router.get('/api/statistics', TelegramAdminController_1.default.getStatistics);
/**
 * GET /telegram/api/users
 * Get active users list
 * Query params: role, area
 */
router.get('/api/users', TelegramAdminController_1.default.getUsers);
/**
 * POST /telegram/api/invite-code
 * Create invite code for new user
 * Body: { role, areaCoverage, expiryDays }
 */
router.post('/api/invite-code', TelegramAdminController_1.default.createInviteCode);
/**
 * POST /telegram/api/notification
 * Send custom notification
 * Body: { type, priority, title, message, targetRole, targetArea, customerId }
 */
router.post('/api/notification', TelegramAdminController_1.default.sendNotification);
/**
 * GET /telegram/api/chat-logs
 * Get chat logs
 * Query params: limit, userId, messageType
 */
router.get('/api/chat-logs', TelegramAdminController_1.default.getChatLogs);
/**
 * GET /telegram/api/notifications
 * Get notifications history
 * Query params: limit, type, status
 */
router.get('/api/notifications', TelegramAdminController_1.default.getNotifications);
/**
 * GET /telegram/api/incident-assignments
 * Get incident assignments
 * Query params: technicianId, status, limit
 */
router.get('/api/incident-assignments', TelegramAdminController_1.default.getIncidentAssignments);
/**
 * GET /telegram/api/technician-performance
 * Get technician performance statistics
 * Query params: period (days)
 */
router.get('/api/technician-performance', TelegramAdminController_1.default.getTechnicianPerformance);
/**
 * PUT /telegram/api/users/:userId/settings
 * Update user settings
 * Body: { notificationEnabled, areaCoverage }
 */
router.put('/api/users/:userId/settings', TelegramAdminController_1.default.updateUserSettings);
/**
 * DELETE /telegram/api/users/:userId
 * Deactivate user
 */
router.delete('/api/users/:userId', TelegramAdminController_1.default.deactivateUser);
/**
 * POST /telegram/api/test-message
 * Send test message to user
 * Body: { chatId, message }
 */
router.post('/api/test-message', TelegramAdminController_1.default.testSendMessage);
/**
 * GET /telegram/api/bot-info
 * Get bot information
 */
router.get('/api/bot-info', TelegramAdminController_1.default.getBotInfo);
// ==========================================
// EXPORT
// ==========================================
exports.default = router;
//# sourceMappingURL=telegram.js.map