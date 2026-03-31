import { Request, Response } from 'express';
export declare class UserController {
    private userService;
    constructor();
    index(req: Request, res: Response): Promise<void>;
    createForm(req: Request, res: Response): Promise<void>;
    create(req: Request, res: Response): Promise<void>;
    editForm(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    delete(req: Request, res: Response): Promise<void>;
    toggleStatus(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=userController.d.ts.map