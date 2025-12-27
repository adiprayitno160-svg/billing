"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = loggingMiddleware;
exports.errorLoggingMiddleware = errorLoggingMiddleware;
const BillingLogService_1 = require("../services/billing/BillingLogService");
function loggingMiddleware(req, res, next) {
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Add request ID to request object
    req.requestId = requestId;
    // Log request start
    BillingLogService_1.BillingLogService.info('api', 'HTTP', `${req.method} ${req.path}`, {
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
    }).catch(() => { }); // Non-blocking
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const responseTime = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' :
            res.statusCode >= 400 ? 'warning' : 'info';
        BillingLogService_1.BillingLogService.log({
            level: logLevel,
            type: 'api',
            service: 'HTTP',
            message: `${req.method} ${req.path} - ${res.statusCode}`,
            context: {
                requestId,
                statusCode: res.statusCode,
                responseTime,
                method: req.method,
                path: req.path
            },
            requestId,
            ipAddress: req.ip || req.connection.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
            userId: req.user?.id
        }).catch(() => { }); // Non-blocking
        originalEnd.call(this, chunk, encoding);
    };
    next();
}
/**
 * Error logging middleware
 */
function errorLoggingMiddleware(error, req, res, next) {
    const requestId = req.requestId || `req-${Date.now()}`;
    BillingLogService_1.BillingLogService.error('api', 'HTTP', `Error in ${req.method} ${req.path}: ${error.message}`, error, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode || 500,
        stack: error.stack
    }).catch(() => { }); // Non-blocking
    next(error);
}
//# sourceMappingURL=loggingMiddleware.js.map