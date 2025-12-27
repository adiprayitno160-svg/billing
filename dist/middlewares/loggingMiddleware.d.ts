/**
 * Logging Middleware - Automatic request and error logging
 */
import { Request, Response, NextFunction } from 'express';
export declare function loggingMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Error logging middleware
 */
export declare function errorLoggingMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=loggingMiddleware.d.ts.map