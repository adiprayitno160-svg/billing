import { Request, Response } from 'express';
export declare class AddressListController {
    static getAllAddressLists(req: Request, res: Response): Promise<void>;
    static getAddressListById(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static createAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static getAddressListItems(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static createAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static updateAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static deleteAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static createBulkAddressListItems(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static syncAddressListToMikrotik(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static syncAllAddressListsToMikrotik(req: Request, res: Response): Promise<void>;
    static getAddressListFromMikrotik(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=addressListController.d.ts.map