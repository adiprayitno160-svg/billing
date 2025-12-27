import { Request, Response, NextFunction } from 'express';
/**
 * Middleware untuk menyediakan informasi perusahaan di semua view
 * Data company settings akan tersedia sebagai companyInfo di semua EJS templates
 */
export declare function companyInfoMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=companyInfoMiddleware.d.ts.map