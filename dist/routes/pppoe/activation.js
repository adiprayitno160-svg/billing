"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pppoeActivationController_1 = require("../../controllers/pppoe/pppoeActivationController");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = express_1.default.Router();
// Apply auth middleware to all routes
router.use(authMiddleware_1.isAuthenticated);
// Routes for PPPoE activation management
router.get('/', (req, res) => {
    res.render('pppoe/activation-management');
});
router.get('/inactive-subscriptions', pppoeActivationController_1.pppoeActivationController.getInactiveSubscriptions);
router.get('/subscriptions/:subscriptionId', pppoeActivationController_1.pppoeActivationController.getSubscriptionDetails);
router.post('/subscriptions/:subscriptionId/activate', pppoeActivationController_1.pppoeActivationController.activateSubscription);
router.post('/subscriptions/:subscriptionId/send-invoice', pppoeActivationController_1.pppoeActivationController.sendActivationInvoice);
router.post('/subscriptions/:subscriptionId/deactivate', pppoeActivationController_1.pppoeActivationController.deactivateSubscription);
router.get('/customers/:customerId/logs', pppoeActivationController_1.pppoeActivationController.getActivationLogs);
router.post('/auto-blocking', pppoeActivationController_1.pppoeActivationController.runAutoBlocking);
// Additional API routes for the UI
router.get('/subscriptions', pppoeActivationController_1.pppoeActivationController.getAllSubscriptions);
router.get('/stats', pppoeActivationController_1.pppoeActivationController.getStatistics);
exports.default = router;
//# sourceMappingURL=activation.js.map