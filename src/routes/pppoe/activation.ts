import express from 'express';
import { pppoeActivationController } from '../../controllers/pppoe/pppoeActivationController';
import { isAuthenticated } from '../../middlewares/authMiddleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(isAuthenticated);

// Routes for PPPoE activation management
router.get('/', (req, res) => {
    res.render('pppoe/activation-management');
});
router.get('/inactive-subscriptions', pppoeActivationController.getInactiveSubscriptions);
router.get('/subscriptions/:subscriptionId', pppoeActivationController.getSubscriptionDetails);
router.post('/subscriptions/:subscriptionId/activate', pppoeActivationController.activateSubscription);
router.post('/subscriptions/:subscriptionId/send-invoice', pppoeActivationController.sendActivationInvoice);
router.post('/subscriptions/:subscriptionId/deactivate', pppoeActivationController.deactivateSubscription);
router.get('/customers/:customerId/logs', pppoeActivationController.getActivationLogs);
router.post('/auto-blocking', pppoeActivationController.runAutoBlocking);

// Additional API routes for the UI
router.get('/subscriptions', pppoeActivationController.getAllSubscriptions);
router.get('/stats', pppoeActivationController.getStatistics);

export default router;