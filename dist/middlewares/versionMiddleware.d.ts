import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to inject app version from VERSION files to all views
 *
 * Versioning Strategy:
 * - appVersion (VERSION_MAJOR): Untuk About page (2.0.8) - stable release only
 * - fullVersion (VERSION): Untuk footer/internal (2.0.8.5) - includes hotfixes
 *
 * Falls back to package.json if VERSION files are not available
 */
export declare function injectAppVersion(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=versionMiddleware.d.ts.map