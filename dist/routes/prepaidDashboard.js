"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PrepaidDashboardController_1 = require("../controllers/PrepaidDashboardController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// All routes require authentication
router.use(authMiddleware.requireAuth.bind(authMiddleware));
/**
 * GET /prepaid
 * Redirect to customers list (default dashboard)
 */
router.get('/', (req, res) => res.redirect('/prepaid/customers'));
/**
 * GET /prepaid/customers
 * Show prepaid customers list with expiry status
 */
router.get('/customers', PrepaidDashboardController_1.PrepaidDashboardController.listPrepaidCustomers);
/**
 * GET /prepaid/transactions
 * Show prepaid transactions report
 */
router.get('/transactions', PrepaidDashboardController_1.PrepaidDashboardController.listTransactions);
/**
 * GET /prepaid/payment-requests
 * Show pending payment requests
 */
router.get('/payment-requests', PrepaidDashboardController_1.PrepaidDashboardController.listPaymentRequests);
/**
 * GET /prepaid/reports
 * Show prepaid transactions report
 */
router.get('/reports', PrepaidDashboardController_1.PrepaidDashboardController.getReports);
exports.default = router;
//# sourceMappingURL=prepaidDashboard.js.map