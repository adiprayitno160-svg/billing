import { Request, Response, NextFunction } from 'express';
export declare function getAboutPage(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function checkUpdates(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateAppVersion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getUpdateHistoryPage(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function checkHotfix(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
export declare function applyHotfixUpdate(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=aboutController.d.ts.map