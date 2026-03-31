import { Request, Response, NextFunction } from 'express';
export declare function getDatabaseManagement(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function fixDatabaseIssues(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function runDatabaseMigration(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function runLatePaymentTrackingMigration(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDatabaseLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=databaseController.d.ts.map