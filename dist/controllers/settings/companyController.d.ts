import { Request, Response } from 'express';
export declare class CompanyController {
    static showSettings(req: Request, res: Response): Promise<void>;
    static saveSettings(req: Request, res: Response): Promise<void>;
    static uploadLogo(req: Request, res: Response): Promise<void>;
    static previewTemplate(req: Request, res: Response): Promise<void>;
    static exportSettings(req: Request, res: Response): Promise<void>;
    static importSettings(req: Request, res: Response): Promise<void>;
    static resetToDefault(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=companyController.d.ts.map