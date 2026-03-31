import { Request, Response } from 'express';
export declare class BackupController {
    static index(req: Request, res: Response): Promise<void>;
    static saveConfig(req: Request, res: Response): Promise<void>;
    static uploadKey(req: Request, res: Response): Promise<void>;
    static runBackup(req: Request, res: Response): Promise<void>;
    static runLocalBackup(req: Request, res: Response): Promise<void>;
    static runFullBackup(req: Request, res: Response): Promise<void>;
    static listBackups(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static downloadBackup(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static restoreBackup(req: Request, res: Response): Promise<void>;
    static restoreFromUpload(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteBackup(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=backupController.d.ts.map