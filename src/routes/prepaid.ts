import express from 'express';
import { PrepaidController } from '../controllers/PrepaidController';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// All routes require authentication
router.use(authMiddleware.requireAuth.bind(authMiddleware));

/**
 * POST /api/prepaid/switch-to-prepaid/:id
 * Switch customer to prepaid billing mode
 */
router.post('/switch-to-prepaid/:id', PrepaidController.switchToPrepaid);

/**
 * POST /api/prepaid/switch-to-postpaid/:id
 * Switch customer back to postpaid billing mode
 */
router.post('/switch-to-postpaid/:id', PrepaidController.switchToPostpaid);

/**
 * POST /api/prepaid/generate-payment-request
 * Generate payment request with unique code (for manual testing)
 */
router.post('/generate-payment-request', PrepaidController.generatePaymentRequest);

/**
 * POST /api/prepaid/confirm-payment
 * Confirm payment and extend expiry date
 */
router.post('/confirm-payment', PrepaidController.confirmPayment);

export default router;
