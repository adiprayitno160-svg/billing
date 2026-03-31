import { Request, Response, NextFunction } from 'express';
export declare function getStaticIpPackageList(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStaticIpPackageAdd(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStaticIpPackageEdit(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageCreate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageUpdate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageCreateQueues(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageDelete(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageDeleteQueues(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function apiDeletePackage(req: Request, res: Response): Promise<void>;
export declare function postStaticIpPackageSyncAll(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpPackageCopy(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=staticIpPackageController.d.ts.map