import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        phone: string;
        role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
        is_active: boolean;
        session_id?: string;
        created_at: Date;
        updated_at: Date;
    };
}
export declare const isAuthenticated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
export declare const isAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
export declare class AuthMiddleware {
    private userService;
    constructor();
    requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
    requireKasir: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
    redirectIfAuthenticated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
    requireNonKasir: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
}
//# sourceMappingURL=authMiddleware.d.ts.map