"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PrepaidController_1 = require("../controllers/PrepaidController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// All routes require authentication
router.use(authMiddleware.requireAuth.bind(authMiddleware));
/**
 * POST /api/prepaid/switch-to-prepaid/:id
 * Switch customer to prepaid billing mode
 */
router.post('/switch-to-prepaid/:id', PrepaidController_1.PrepaidController.switchToPrepaid);
/**
 * POST /api/prepaid/switch-to-postpaid/:id
 * Switch customer back to postpaid billing mode
 */
router.post('/switch-to-postpaid/:id', PrepaidController_1.PrepaidController.switchToPostpaid);
/**
 * POST /api/prepaid/generate-payment-request
 * Generate payment request with unique code (for manual testing)
 */
router.post('/generate-payment-request', PrepaidController_1.PrepaidController.generatePaymentRequest);
/**
 * POST /api/prepaid/confirm-payment
 * Confirm payment and extend expiry date
 */
router.post('/confirm-payment', PrepaidController_1.PrepaidController.confirmPayment);
exports.default = router;
//# sourceMappingURL=prepaid.js.map