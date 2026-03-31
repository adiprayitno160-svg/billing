/**
 * Network Monitoring Controller
 * Handles HTTP requests for network monitoring
 */
import { Request, Response } from 'express';
/**
 * Get AI-Enhanced SLA Report
 */
export declare const getSlaReport: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Get network topology data (for map view)
 */
export declare const getNetworkTopology: (req: Request, res: Response) => Promise<void>;
/**
 * Get network topology without heavy sync operations (faster response)
 */
export declare const getNetworkTopologyFast: (req: Request, res: Response) => Promise<void>;
/**
 * Get all devices
 */
export declare const getAllDevices: (req: Request, res: Response) => Promise<void>;
/**
 * Sync devices from GenieACS
 */
export declare const syncFromGenieACS: (req: Request, res: Response) => Promise<void>;
/**
 * Sync devices from customers
 */
export declare const syncFromCustomers: (req: Request, res: Response) => Promise<void>;
/**
 * Sync FTTH infrastructure
 */
export declare const syncFTTHInfrastructure: (req: Request, res: Response) => Promise<void>;
/**
 * Auto-create network links
 */
export declare const autoCreateLinks: (req: Request, res: Response) => Promise<void>;
/**
 * Check device status
 */
export declare const checkDeviceStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Render public network map page (no login required)
 */
export declare const renderPublicNetworkMap: (req: Request, res: Response) => Promise<void>;
export declare const renderModernNetworkMap: (req: Request, res: Response) => Promise<void>;
export declare const renderEnhancedNetworkMap: (req: Request, res: Response) => Promise<void>;
/**
 * Get customers for map display with status
 */
export declare const getMapCustomers: (req: Request, res: Response) => Promise<void>;
/**
 * Get offline alerts (excluding isolated customers)
 */
export declare const getOfflineAlerts: (req: Request, res: Response) => Promise<void>;
/**
 * Get nearby customers to a location
 */
export declare const getNearbyCustomers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * Force refresh monitoring data
 */
export declare const refreshMonitoring: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=networkMonitoringController.d.ts.map