import { Request, Response, NextFunction } from 'express';
/**
 * Middleware untuk menyediakan setting auto logout ke semua view
 * Data auto_logout_enabled akan tersedia sebagai autoLogoutEnabled di semua EJS templates
 */
export declare function autoLogoutMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=autoLogoutMiddleware.d.ts.map