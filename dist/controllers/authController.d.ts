import { Request, Response } from 'express';
export declare class AuthController {
    private userService;
    constructor();
    loginForm(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    initializeDefaultUsers(): Promise<void>;
    resetKasirUser(): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map