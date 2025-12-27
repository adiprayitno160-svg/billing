import { Request, Response, NextFunction } from 'express';
export declare function getStaticIpClientList(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStaticIpClientAdd(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpClientCreate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpClientDelete(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStaticIpClientEdit(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function postStaticIpClientUpdate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function testMikrotikIpAdd(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function autoDebugIpStatic(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=staticIpClientController.d.ts.map