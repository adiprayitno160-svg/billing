import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
        is_active: boolean;
    };
}
export declare const isAuthenticated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const isAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare class AuthMiddleware {
    private userService;
    constructor();
    requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    requireKasir: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    redirectIfAuthenticated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    requireNonKasir: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=authMiddleware.d.ts.map