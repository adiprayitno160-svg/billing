import { Request, Response } from 'express';
export declare class PackageApiController {
    /**
     * Get PPPoE Package Detail by ID
     * GET /api/packages/pppoe/:id
     */
    static getPppoePackageDetail(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get Packages by Connection Type
     * GET /api/packages/:connectionType
     */
    static getPackagesByType(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=PackageApiController.d.ts.map