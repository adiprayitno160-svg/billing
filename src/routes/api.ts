/**
 * General API Routes
 * Server time and other general utilities
  */

import { Router, Request, Response } from 'express';

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

export default router;
