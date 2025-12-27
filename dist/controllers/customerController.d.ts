import { Request, Response } from 'express';
/**
 * Get customer list page
 */
export declare const getCustomerList: (req: Request, res: Response) => Promise<void>;
/**
 * Test Mikrotik connection and list all address lists
 */
export declare const testMikrotikAddressLists: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get customer detail page
 */
export declare const getCustomerDetail: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Get customer edit page
 */
export declare const getCustomerEdit: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Update customer
 */
export declare const updateCustomer: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Delete customer
 */
export declare const deleteCustomer: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Bulk delete customers
 */
export declare const bulkDeleteCustomers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=customerController.d.ts.map