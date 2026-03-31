import { Request, Response } from 'express';
/**
 * Get customer list page
 */
export declare const getCustomerList: (req: Request, res: Response) => Promise<void>;
/**
 * Test Mikrotik connection and list all address lists
 */
export declare const testMikrotikAddressLists: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
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
export declare const updateCustomer: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Delete customer
 */
export declare const deleteCustomer: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Bulk delete customers
 */
export declare const bulkDeleteCustomers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Toggle customer status (Active/Inactive)
 */
export declare const toggleCustomerStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Switch customer to prepaid billing mode
 */
export declare const switchToPrepaid: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Sync all customers to GenieACS (One-way: Billing -> GenieACS)
 * Updates Tags on GenieACS based on Serial Number in Billing
 */
export declare const syncAllCustomersToGenieacs: (req: Request, res: Response) => Promise<void>;
/**
 * Sync customer PPPoE to Mikrotik
 */
export declare const syncCustomerPppoe: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Switch customer back to postpaid billing mode
 */
export declare const switchToPostpaid: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get active PPPoE connections from Mikrotik that are not yet in billing
 */
export declare const getActivePppoeConnections: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * View Registration Requests
 */
export declare const viewRegistrationRequests: (req: Request, res: Response) => Promise<void>;
/**
 * Add compensation (restitution) for customer
 */
export declare const addCompensation: (req: Request, res: Response) => Promise<void>;
/**
 * Manually trigger welcome notification with optional data override
 */
export declare const sendWelcomeNotificationManual: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=customerController.d.ts.map