/**
 * Logging Middleware - Automatic request and error logging
 */
import { Request, Response, NextFunction } from 'express';
import { BillingLogService } from '../services/billing/BillingLogService';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to request object
    (req as any).requestId = requestId;

    // Skip detailed logging for high-frequency monitoring endpoints to reduce DB load
    const isHighFrequency = req.path.includes('/monitoring/api/network-topology') ||
        req.path.includes('/monitoring/api/devices') ||
        req.path.includes('/api/check-notification');

    // Log request start
    if (!isHighFrequency) {
        BillingLogService.info(
            'api',
            'HTTP',
            `${req.method} ${req.path}`,
            {
                requestId,
                method: req.method,
                path: req.path,
                query: req.query,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            }
        ).catch(() => { }); // Non-blocking

        // Override res.end to log response
        const originalEnd = res.end;
        res.end = function (chunk?: any, encoding?: any): any {
            const responseTime = Date.now() - startTime;
            const logLevel: 'info' | 'warning' | 'error' =
                res.statusCode >= 500 ? 'error' :
                    res.statusCode >= 400 ? 'warning' : 'info';

            if (!isHighFrequency || res.statusCode >= 400) {
                BillingLogService.log({
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
                    userId: (req as any).user?.id
                }).catch(() => { }); // Non-blocking
            }

            return originalEnd.call(this, chunk, encoding);
        };
    }

    next();
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const requestId = (req as any).requestId || `req-${Date.now()}`;

    BillingLogService.error(
        'api',
        'HTTP',
        `Error in ${req.method} ${req.path}: ${error.message}`,
        error,
        {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode || 500,
            stack: error.stack
        }
    ).catch(() => { }); // Non-blocking

    next(error);
}



