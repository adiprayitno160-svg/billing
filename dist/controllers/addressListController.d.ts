import { Request, Response } from 'express';
export declare class AddressListController {
    static getAllAddressLists(req: Request, res: Response): Promise<void>;
    static getAddressListById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteAddressList(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getAddressListItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteAddressListItem(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createBulkAddressListItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static syncAddressListToMikrotik(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static syncAllAddressListsToMikrotik(req: Request, res: Response): Promise<void>;
    static getAddressListFromMikrotik(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=addressListController.d.ts.map