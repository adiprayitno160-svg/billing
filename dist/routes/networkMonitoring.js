"use strict";
/**
 * Network Monitoring Routes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const networkMonitoringController = __importStar(require("../controllers/monitoring/networkMonitoringController"));
const router = express_1.default.Router();
// Public route (no authentication required) - for office display
router.get('/public/network-map', networkMonitoringController.renderPublicNetworkMap);
router.get('/public/modern-network-map', networkMonitoringController.renderModernNetworkMap);
// API routes for network monitoring data (public for now, can add auth later)
router.get('/api/network-topology', networkMonitoringController.getNetworkTopology);
router.get('/api/network-topology-fast', networkMonitoringController.getNetworkTopologyFast);
router.get('/api/devices', networkMonitoringController.getAllDevices);
router.get('/api/devices/:id/status', networkMonitoringController.checkDeviceStatus);
// Sync routes
router.post('/api/sync/genieacs', networkMonitoringController.syncFromGenieACS);
router.post('/api/sync/customers', networkMonitoringController.syncFromCustomers);
router.post('/api/sync/ftth', networkMonitoringController.syncFTTHInfrastructure);
router.post('/api/sync/links', networkMonitoringController.autoCreateLinks);
// Enhanced network map
router.get('/public/enhanced-network-map', networkMonitoringController.renderEnhancedNetworkMap);
// API for enhanced monitoring
router.get('/api/map-customers', networkMonitoringController.getMapCustomers);
router.get('/api/offline-alerts', networkMonitoringController.getOfflineAlerts);
router.get('/api/nearby-customers', networkMonitoringController.getNearbyCustomers);
router.post('/api/refresh-monitoring', networkMonitoringController.refreshMonitoring);
exports.default = router;
//# sourceMappingURL=networkMonitoring.js.map