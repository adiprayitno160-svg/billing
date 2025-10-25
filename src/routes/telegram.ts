/**
 * Telegram Bot Routes
 * Routes for Telegram Bot management and API endpoints
 */

import express, { Router } from 'express';
import TelegramAdminController from '../controllers/telegram/TelegramAdminController';

const router: Router = express.Router();

// ==========================================
// DASHBOARD & WEB VIEWS
// ==========================================

/**
 * GET /telegram/dashboard
 * Display Telegram Bot dashboard
 */
router.get('/dashboard', TelegramAdminController.dashboard);

/**
 * GET /telegram/users
 * Display Telegram users page
 */
router.get('/users', TelegramAdminController.usersPage);

// ==========================================
// API ENDPOINTS
// ==========================================

/**
 * GET /telegram/api/statistics
 * Get bot statistics
 */
router.get('/api/statistics', TelegramAdminController.getStatistics);

/**
 * GET /telegram/api/users
 * Get active users list
 * Query params: role, area
 */
router.get('/api/users', TelegramAdminController.getUsers);

/**
 * POST /telegram/api/invite-code
 * Create invite code for new user
 * Body: { role, areaCoverage, expiryDays }
 */
router.post('/api/invite-code', TelegramAdminController.createInviteCode);

/**
 * POST /telegram/api/notification
 * Send custom notification
 * Body: { type, priority, title, message, targetRole, targetArea, customerId }
 */
router.post('/api/notification', TelegramAdminController.sendNotification);

/**
 * GET /telegram/api/chat-logs
 * Get chat logs
 * Query params: limit, userId, messageType
 */
router.get('/api/chat-logs', TelegramAdminController.getChatLogs);

/**
 * GET /telegram/api/notifications
 * Get notifications history
 * Query params: limit, type, status
 */
router.get('/api/notifications', TelegramAdminController.getNotifications);

/**
 * GET /telegram/api/incident-assignments
 * Get incident assignments
 * Query params: technicianId, status, limit
 */
router.get('/api/incident-assignments', TelegramAdminController.getIncidentAssignments);

/**
 * GET /telegram/api/technician-performance
 * Get technician performance statistics
 * Query params: period (days)
 */
router.get('/api/technician-performance', TelegramAdminController.getTechnicianPerformance);

/**
 * PUT /telegram/api/users/:userId/settings
 * Update user settings
 * Body: { notificationEnabled, areaCoverage }
 */
router.put('/api/users/:userId/settings', TelegramAdminController.updateUserSettings);

/**
 * DELETE /telegram/api/users/:userId
 * Deactivate user
 */
router.delete('/api/users/:userId', TelegramAdminController.deactivateUser);

/**
 * POST /telegram/api/test-message
 * Send test message to user
 * Body: { chatId, message }
 */
router.post('/api/test-message', TelegramAdminController.testSendMessage);

/**
 * GET /telegram/api/bot-info
 * Get bot information
 */
router.get('/api/bot-info', TelegramAdminController.getBotInfo);

// ==========================================
// EXPORT
// ==========================================

export default router;
