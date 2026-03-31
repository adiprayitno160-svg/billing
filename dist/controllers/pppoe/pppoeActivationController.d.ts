import { Request, Response } from 'express';
export declare class PPPoEActivationController {
    /**
     * Get list of inactive PPPoE subscriptions that can be activated
     */
    getInactiveSubscriptions(req: Request, res: Response): Promise<void>;
    /**
     * Activate PPPoE subscription
     */
    activateSubscription(req: Request, res: Response): Promise<void>;
    /**
     * Deactivate PPPoE subscription
     */
    deactivateSubscription(req: Request, res: Response): Promise<void>;
    /**
     * Send activation invoice to customer
     */
    sendActivationInvoice(req: Request, res: Response): Promise<void>;
    /**
     * Get activation logs for a customer
     */
    getActivationLogs(req: Request, res: Response): Promise<void>;
    /**
     * Get subscription details
     */
    getSubscriptionDetails(req: Request, res: Response): Promise<void>;
    /**
     * Get all subscriptions with filtering and pagination
     */
    getAllSubscriptions(req: Request, res: Response): Promise<void>;
    /**
     * Run the auto-blocking process manually
     */
    runAutoBlocking(req: Request, res: Response): Promise<void>;
    /**
     * Get statistics for the activation dashboard
     */
    getStatistics(req: Request, res: Response): Promise<void>;
}
export declare const pppoeActivationController: PPPoEActivationController;
//# sourceMappingURL=pppoeActivationController.d.ts.map