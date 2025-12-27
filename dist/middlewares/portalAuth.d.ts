import { Request, Response, NextFunction } from 'express';
/**
 * Middleware untuk autentikasi portal prepaid
 * Check if customer is logged in to portal
 */
export declare function requirePortalAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware untuk redirect jika sudah login
 */
export declare function redirectIfPortalAuthenticated(req: Request, res: Response, next: NextFunction): void;
/**
 * Attach portal session data to locals untuk views
 */
export declare function attachPortalSession(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=portalAuth.d.ts.map