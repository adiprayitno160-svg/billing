"use strict";
/**
 * WhatsApp Troubleshooting Controller
 * Handle WhatsApp troubleshooting and diagnostics
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppTroubleshootingController = void 0;
var WhatsAppService_1 = require("../../services/whatsapp/WhatsAppService");
var pool_1 = require("../../db/pool");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var WhatsAppTroubleshootingController = /** @class */ (function () {
    function WhatsAppTroubleshootingController() {
    }
    /**
     * Show troubleshooting page - SIMPLIFIED VERSION
     */
    WhatsAppTroubleshootingController.showTroubleshooting = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var status_1, stats, statsError_1, failedNotifications, pendingNotifications, sessionPath_1, sessionExists, sessionSize, sessionFilesCount, files, systemInfo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        console.log('🔍 [TROUBLESHOOTING] Loading page...');
                        status_1 = WhatsAppService_1.WhatsAppService.getStatus();
                        console.log('✅ [TROUBLESHOOTING] Got WhatsApp status:', status_1);
                        stats = {
                            total: 0,
                            sent: 0,
                            failed: 0,
                            pending: 0,
                            successRate: 0
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, WhatsAppService_1.WhatsAppService.getNotificationStats()];
                    case 2:
                        stats = _a.sent();
                        console.log('✅ [TROUBLESHOOTING] Got notification stats');
                        return [3 /*break*/, 4];
                    case 3:
                        statsError_1 = _a.sent();
                        console.warn('⚠️ [TROUBLESHOOTING] Failed to get stats, using defaults:', statsError_1);
                        return [3 /*break*/, 4];
                    case 4:
                        failedNotifications = [];
                        pendingNotifications = [];
                        sessionPath_1 = path.join(process.cwd(), 'whatsapp-session');
                        sessionExists = false;
                        sessionSize = 0;
                        sessionFilesCount = 0;
                        try {
                            sessionExists = fs.existsSync(sessionPath_1);
                            if (sessionExists) {
                                files = fs.readdirSync(sessionPath_1);
                                sessionFilesCount = files.length;
                                sessionSize = files.reduce(function (total, file) {
                                    try {
                                        var filePath = path.join(sessionPath_1, file);
                                        if (fs.existsSync(filePath)) {
                                            var fileStats = fs.statSync(filePath);
                                            return total + (fileStats.isFile() ? fileStats.size : 0);
                                        }
                                    }
                                    catch (_a) { }
                                    return total;
                                }, 0);
                            }
                            console.log('✅ [TROUBLESHOOTING] Session folder checked');
                        }
                        catch (sessionError) {
                            console.warn('⚠️ [TROUBLESHOOTING] Failed to check session folder:', sessionError);
                        }
                        systemInfo = {
                            nodeVersion: process.version,
                            platform: process.platform,
                            uptime: Math.floor(process.uptime() / 60),
                            memoryUsage: process.memoryUsage(),
                            sessionExists: sessionExists,
                            sessionSize: (sessionSize / 1024 / 1024).toFixed(2) + ' MB',
                            sessionFilesCount: sessionFilesCount
                        };
                        console.log('✅ [TROUBLESHOOTING] Rendering page with data');
                        res.render('whatsapp/troubleshooting', {
                            title: 'Troubleshooting WhatsApp',
                            currentPath: '/whatsapp/troubleshooting',
                            status: status_1,
                            stats: stats,
                            failedNotifications: failedNotifications,
                            pendingNotifications: pendingNotifications,
                            systemInfo: systemInfo,
                            user: req.session.user
                        });
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error('❌❌❌ CRITICAL ERROR in troubleshooting controller:', error_1);
                        console.error('Error stack:', error_1.stack);
                        // Try to render error page
                        try {
                            res.status(500).render('error', {
                                title: 'Error - Troubleshooting WhatsApp',
                                message: 'BARU: ' + (error_1.message || 'Gagal memuat halaman troubleshooting'),
                                error: error_1.stack || error_1,
                                user: req.session.user
                            });
                        }
                        catch (renderError) {
                            // If even error rendering fails, send plain text
                            res.status(500).send("Error: ".concat(error_1.message || 'Unknown error', "\n\nStack: ").concat(error_1.stack || 'No stack'));
                        }
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get diagnostic information
     */
    WhatsAppTroubleshootingController.getDiagnostics = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var status_2, stats, sessionPath, sessionExists, recentErrors, columns, columnNames, query, rows, err_1, queueStats, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        status_2 = WhatsAppService_1.WhatsAppService.getStatus();
                        return [4 /*yield*/, WhatsAppService_1.WhatsAppService.getNotificationStats()];
                    case 1:
                        stats = _a.sent();
                        sessionPath = path.join(process.cwd(), 'whatsapp-session');
                        sessionExists = fs.existsSync(sessionPath);
                        recentErrors = [];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs')];
                    case 3:
                        columns = (_a.sent())[0];
                        columnNames = columns.map(function (col) { return col.Field; });
                        query = void 0;
                        if (columnNames.includes('channel')) {
                            query = "SELECT * FROM notification_logs \n                             WHERE channel = 'whatsapp' AND status = 'failed'\n                             ORDER BY created_at DESC LIMIT 10";
                        }
                        else if (columnNames.includes('notification_type')) {
                            query = "SELECT * FROM notification_logs \n                             WHERE notification_type = 'whatsapp' AND status = 'failed'\n                             ORDER BY created_at DESC LIMIT 10";
                        }
                        else {
                            query = "SELECT * FROM notification_logs \n                             WHERE status = 'failed'\n                             ORDER BY created_at DESC LIMIT 10";
                        }
                        return [4 /*yield*/, pool_1.databasePool.query(query)];
                    case 4:
                        rows = (_a.sent())[0];
                        recentErrors = rows;
                        return [3 /*break*/, 6];
                    case 5:
                        err_1 = _a.sent();
                        console.error('Error getting recent errors for diagnostics:', err_1);
                        return [3 /*break*/, 6];
                    case 6: return [4 /*yield*/, pool_1.databasePool.query("SELECT \n                    status,\n                    COUNT(*) as count\n                 FROM unified_notifications_queue\n                 WHERE channel = 'whatsapp'\n                 GROUP BY status")];
                    case 7:
                        queueStats = (_a.sent())[0];
                        res.json({
                            success: true,
                            data: {
                                status: status_2,
                                stats: stats,
                                sessionExists: sessionExists,
                                recentErrors: recentErrors || [],
                                queueStats: queueStats || [],
                                timestamp: new Date().toISOString()
                            }
                        });
                        return [3 /*break*/, 9];
                    case 8:
                        error_2 = _a.sent();
                        res.json({
                            success: false,
                            error: error_2.message || 'Failed to get diagnostics'
                        });
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear failed notifications
     */
    WhatsAppTroubleshootingController.clearFailedNotifications = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var columns, columnNames, query, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs')];
                    case 1:
                        columns = (_a.sent())[0];
                        columnNames = columns.map(function (col) { return col.Field; });
                        query = void 0;
                        if (columnNames.includes('channel')) {
                            query = "UPDATE notification_logs SET status = 'cancelled' WHERE channel = 'whatsapp' AND status = 'failed'";
                        }
                        else if (columnNames.includes('notification_type')) {
                            query = "UPDATE notification_logs SET status = 'cancelled' WHERE notification_type = 'whatsapp' AND status = 'failed'";
                        }
                        else {
                            query = "UPDATE notification_logs SET status = 'cancelled' WHERE status = 'failed'";
                        }
                        return [4 /*yield*/, pool_1.databasePool.query(query)];
                    case 2:
                        _a.sent();
                        res.json({
                            success: true,
                            message: 'Failed notifications cleared'
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        res.json({
                            success: false,
                            error: error_3.message || 'Failed to clear notifications'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Retry failed notifications
     */
    WhatsAppTroubleshootingController.retryFailedNotifications = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, limit, failed, retried, errors, _i, failed_1, notif, err_2, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 8, , 9]);
                        _a = req.body.limit, limit = _a === void 0 ? 10 : _a;
                        return [4 /*yield*/, pool_1.databasePool.query("SELECT * FROM unified_notifications_queue \n                 WHERE channel = 'whatsapp' AND status = 'failed'\n                 ORDER BY created_at DESC \n                 LIMIT ?", [limit])];
                    case 1:
                        failed = (_b.sent())[0];
                        retried = 0;
                        errors = 0;
                        _i = 0, failed_1 = failed;
                        _b.label = 2;
                    case 2:
                        if (!(_i < failed_1.length)) return [3 /*break*/, 7];
                        notif = failed_1[_i];
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        // Reset to pending
                        return [4 /*yield*/, pool_1.databasePool.query("UPDATE unified_notifications_queue \n                         SET status = 'pending', retry_count = 0, error_message = NULL\n                         WHERE id = ?", [notif.id])];
                    case 4:
                        // Reset to pending
                        _b.sent();
                        retried++;
                        return [3 /*break*/, 6];
                    case 5:
                        err_2 = _b.sent();
                        errors++;
                        console.error("Error retrying notification ".concat(notif.id, ":"), err_2);
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        res.json({
                            success: true,
                            message: "Retried ".concat(retried, " notifications"),
                            data: {
                                retried: retried,
                                errors: errors
                            }
                        });
                        return [3 /*break*/, 9];
                    case 8:
                        error_4 = _b.sent();
                        res.json({
                            success: false,
                            error: error_4.message || 'Failed to retry notifications'
                        });
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Test WhatsApp connection
     */
    WhatsAppTroubleshootingController.testConnection = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var status_3, diagnostics;
            return __generator(this, function (_a) {
                try {
                    status_3 = WhatsAppService_1.WhatsAppService.getStatus();
                    if (!status_3.ready) {
                        res.json({
                            success: false,
                            error: 'WhatsApp tidak terhubung. Silakan scan QR code terlebih dahulu.'
                        });
                        return [2 /*return*/];
                    }
                    diagnostics = {
                        ready: status_3.ready,
                        initialized: status_3.initialized,
                        authenticated: status_3.authenticated,
                        hasQRCode: status_3.hasQRCode,
                        timestamp: new Date().toISOString()
                    };
                    res.json({
                        success: true,
                        message: 'Koneksi WhatsApp aktif',
                        data: diagnostics
                    });
                }
                catch (error) {
                    res.json({
                        success: false,
                        error: error.message || 'Failed to test connection'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get notification logs with filters
     */
    WhatsAppTroubleshootingController.getNotificationLogs = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, limit, status_4, customerId, startDate, endDate, query, params, columns, columnNames, logs, error_5;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 3, , 4]);
                        _a = req.query, _b = _a.limit, limit = _b === void 0 ? 50 : _b, status_4 = _a.status, customerId = _a.customerId, startDate = _a.startDate, endDate = _a.endDate;
                        query = 'SELECT nl.*, c.name as customer_name, c.phone as customer_phone FROM notification_logs nl LEFT JOIN customers c ON nl.customer_id = c.id WHERE 1=1';
                        params = [];
                        return [4 /*yield*/, pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs')];
                    case 1:
                        columns = (_c.sent())[0];
                        columnNames = columns.map(function (col) { return col.Field; });
                        if (columnNames.includes('channel')) {
                            query += ' AND nl.channel = "whatsapp"';
                        }
                        else if (columnNames.includes('notification_type')) {
                            query += ' AND nl.notification_type = "whatsapp"';
                        }
                        if (status_4) {
                            query += ' AND nl.status = ?';
                            params.push(status_4);
                        }
                        if (customerId) {
                            query += ' AND nl.customer_id = ?';
                            params.push(parseInt(customerId));
                        }
                        if (startDate) {
                            query += ' AND nl.created_at >= ?';
                            params.push(startDate);
                        }
                        if (endDate) {
                            query += ' AND nl.created_at <= ?';
                            params.push(endDate);
                        }
                        query += ' ORDER BY nl.created_at DESC LIMIT ?';
                        params.push(parseInt(limit));
                        return [4 /*yield*/, pool_1.databasePool.query(query, params)];
                    case 2:
                        logs = (_c.sent())[0];
                        res.json({
                            success: true,
                            data: logs
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _c.sent();
                        res.json({
                            success: false,
                            error: error_5.message || 'Failed to get notification logs'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete old notification logs
     */
    WhatsAppTroubleshootingController.cleanupLogs = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, days, columns, columnNames, query, result, deleted, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        _a = req.body.days, days = _a === void 0 ? 30 : _a;
                        return [4 /*yield*/, pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs')];
                    case 1:
                        columns = (_b.sent())[0];
                        columnNames = columns.map(function (col) { return col.Field; });
                        query = void 0;
                        if (columnNames.includes('channel')) {
                            query = "DELETE FROM notification_logs \n                         WHERE channel = 'whatsapp' \n                           AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)\n                           AND status IN ('sent', 'failed', 'cancelled')";
                        }
                        else if (columnNames.includes('notification_type')) {
                            query = "DELETE FROM notification_logs \n                         WHERE notification_type = 'whatsapp' \n                           AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)\n                           AND status IN ('sent', 'failed', 'cancelled')";
                        }
                        else {
                            query = "DELETE FROM notification_logs \n                         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)\n                           AND status IN ('sent', 'failed', 'cancelled')";
                        }
                        return [4 /*yield*/, pool_1.databasePool.query(query, [days])];
                    case 2:
                        result = (_b.sent())[0];
                        deleted = result.affectedRows || 0;
                        res.json({
                            success: true,
                            message: "Deleted ".concat(deleted, " old notification logs"),
                            data: { deleted: deleted }
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _b.sent();
                        res.json({
                            success: false,
                            error: error_6.message || 'Failed to cleanup logs'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return WhatsAppTroubleshootingController;
}());
exports.WhatsAppTroubleshootingController = WhatsAppTroubleshootingController;
