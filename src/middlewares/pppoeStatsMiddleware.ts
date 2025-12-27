import { Request, Response, NextFunction } from 'express';
import { MikrotikService } from '../services/mikrotik/MikrotikService';

/**
 * Middleware to add PPPoE statistics to res.locals for sidebar display
 */
export async function pppoeStatsMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Initialize default stats
        res.locals.pppoeStats = {
            total: 0,
            active: 0,
            online: 0
        };

        // Get MikroTik service instance
        const mikrotikService = await MikrotikService.getInstance();

        // Check if connected
        const isConnected = await mikrotikService.testConnection();

        if (isConnected) {
            // Get active PPPoE sessions (online users)
            const activeSessions = await mikrotikService.getActivePPPoESessions();
            const onlineCount = activeSessions ? activeSessions.length : 0;

            // Get all PPPoE secrets from database
            const { databasePool } = await import('../db/pool');
            const [secrets] = await databasePool.query<any[]>(
                'SELECT COUNT(*) as total FROM pppoe_secrets'
            );
            const totalCount = secrets[0]?.total || 0;

            // Get active (non-disabled) secrets
            const [activeSecrets] = await databasePool.query<any[]>(
                'SELECT COUNT(*) as active FROM pppoe_secrets WHERE disabled = 0'
            );
            const activeCount = activeSecrets[0]?.active || 0;

            res.locals.pppoeStats = {
                total: totalCount,
                active: activeCount,
                online: onlineCount
            };
        }
    } catch (error) {
        console.error('Error in pppoeStatsMiddleware:', error);
        // Keep default values on error
    }

    next();
}
