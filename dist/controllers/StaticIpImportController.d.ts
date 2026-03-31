import { Request, Response } from 'express';
export declare class StaticIpImportController {
    renderPage(req: Request, res: Response): Promise<void>;
    scan(req: Request, res: Response): Promise<void>;
    linkCustomer(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    renderFormImport(req: Request, res: Response): Promise<void>;
    createAndLink(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=StaticIpImportController.d.ts.map