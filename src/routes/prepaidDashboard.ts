import express from 'express';
import { PrepaidDashboardController } from '../controllers/PrepaidDashboardController';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// All routes require authentication
router.use(authMiddleware.requireAuth.bind(authMiddleware));

/**
 * GET /prepaid/customers
 * Show prepaid customers list with expiry status
 */
router.get('/customers', PrepaidDashboardController.listPrepaidCustomers);

/**
 * GET /prepaid/transactions
 * Show prepaid transactions report
 */
router.get('/transactions', PrepaidDashboardController.listTransactions);

/**
 * GET /prepaid/payment-requests
 * Show pending payment requests
 */
router.get('/payment-requests', PrepaidDashboardController.listPaymentRequests);

export default router;
