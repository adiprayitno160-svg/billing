/**
 * General API Routes
 * Server time and other general utilities
  */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * GET /api/server-time
 * Get current server time in ISO format
 */
router.get('/server-time', (req: Request, res: Response) => {
    const serverTime = new Date();
    res.json({
        success: true,
        serverTime: serverTime.toISOString(),
        timestamp: serverTime.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
});
// Proxy for IP Location (to avoid Mixed Content/CORS on client)
router.get('/proxy/ip-location', async (req: Request, res: Response) => {
    try {
        // Try to get client IP
        let clientIp = req.query.ip as string;

        if (!clientIp) {
            const forwarded = req.headers['x-forwarded-for'];
            clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress || '';
        }

        // Clean up IP (remove IPv6 prefix if present)
        if (clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.substring(7);
        }

        // If localhost, use external service to get public IP
        // BUT for local development, we want the *server's* public IP if client is local?
        // Actually, ip-api.com returns the requester's IP if no query param is passed.
        // So we can just call ip-api.com from the server.
        // However, if the server is also local (same network as client), it will return the same public IP.

        // Use axios or fetch
        const response = await axios.get('http://ip-api.com/json');
        res.json(response.data);
    } catch (error: any) {
        console.error('Error fetching IP location:', error);
        res.status(500).json({ status: 'fail', message: error.message });
    }
});

import customerApiRoutes from './api/customerApiRoutes';
router.use(customerApiRoutes);

import { checkSystemUpdate, performSystemUpdate } from '../controllers/api/SystemUpdateController';

router.get('/system/check-update', checkSystemUpdate);
router.post('/system/update', performSystemUpdate);

export default router;
