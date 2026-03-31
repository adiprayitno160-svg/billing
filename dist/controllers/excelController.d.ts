import { Request, Response } from 'express';
import multer from 'multer';
declare const upload: multer.Multer;
export declare const exportCustomersToExcel: (req: Request, res: Response) => Promise<void>;
export declare const getImportTemplate: (req: Request, res: Response) => Promise<void>;
export declare const importCustomersFromExcel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const processImportedCustomers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncPppoeFromMikrotik: (req: Request, res: Response) => Promise<void>;
export declare const getCustomerForEdit: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export { upload };
//# sourceMappingURL=excelController.d.ts.map