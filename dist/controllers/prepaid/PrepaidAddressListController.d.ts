import { Request, Response } from 'express';
/**
 * Controller untuk Address List Management
 * Versi baru - sederhana dan bersih
 */
declare class PrepaidAddressListController {
    /**
     * Show address list management page
     */
    index(req: Request, res: Response): Promise<void>;
    /**
     * Add IP to address list
     */
    addToList(req: Request, res: Response): Promise<void>;
    /**
     * Remove IP from address list
     */
    removeFromList(req: Request, res: Response): Promise<void>;
    /**
     * Move IP between lists
     */
    moveToList(req: Request, res: Response): Promise<void>;
    /**
     * Clear all entries from a list
     */
    clearList(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidAddressListController;
export default _default;
//# sourceMappingURL=PrepaidAddressListController.d.ts.map