import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring/monitoringController';
import { isAuthenticated } from '../middlewares/authMiddleware';

const router = Router();
const controller = new MonitoringController();

// Apply authentication middleware to all monitoring routes
router.use(isAuthenticated);

// Dashboard monitoring
router.get('/dashboard', (req, res) => controller.getMonitoringDashboard(req, res));

// Troubled customers monitoring
router.get('/trouble', (req, res) => controller.monitorTrouble(req, res));

// PPPoE monitoring
router.get('/pppoe', (req, res) => controller.monitorPPPoE(req, res));

// Static IP monitoring
router.get('/static-ip', (req, res) => controller.monitorStaticIP(req, res));

// Static IP status API (AJAX)
router.get('/static-ip/:customerId/status', (req, res) => controller.getStaticIPStatus(req, res));

// Static IP downtime history API (AJAX)
router.get('/static-ip/:customerId/downtime', (req, res) => controller.getDowntimeHistory(req, res));

// Customer detail (AJAX)
router.get('/customer/:customerId', (req, res) => controller.getCustomerDetail(req, res));

// Disconnect session (AJAX)
router.post('/disconnect-session', (req, res) => controller.disconnectPPPoESession(req, res));

// Traffic stats (AJAX)
router.get('/traffic/:username', (req, res) => controller.getTrafficStats(req, res));

// Analytics endpoints
router.get('/analytics/bandwidth', (req, res) => controller.getBandwidthAnalytics(req, res));
router.get('/analytics/health', (req, res) => controller.getNetworkHealth(req, res));
router.get('/analytics/anomalies', (req, res) => controller.getAnomalies(req, res));
router.get('/analytics/incident/:id', (req, res) => controller.getIncidentAnalysis(req, res));

// Monitoring AI page
router.get('/ai', (req, res) => controller.getAIAnalyticsPage(req, res));

export default router;
