import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Middleware untuk menyediakan setting auto logout ke semua view
 * Data auto_logout_enabled akan tersedia sebagai autoLogoutEnabled di semua EJS templates
 */
export async function autoLogoutMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Skip auto-logout check for certain paths
        const publicPaths = ['/login', '/logout', '/auth', '/kasir/login', '/api/v1/billing/whatsapp/callback'];
        if (publicPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Query auto_logout_enabled setting from database
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_enabled' LIMIT 1"
        );

        // Set autoLogoutEnabled di res.locals agar tersedia di semua view
        const setting = Array.isArray(settings) && settings.length > 0 ? settings[0] : null;
        let autoLogoutEnabled = setting?.setting_value === 'true' || setting?.setting_value === true || setting?.setting_value === '1';

        // Add to locals
        res.locals.autoLogoutEnabled = autoLogoutEnabled;

        const userId = (req.session as any)?.userId;

        // If enabled and user is logged in, enforce timeout based on auto_logout_timeout (seconds)
        if (autoLogoutEnabled && userId) {
            // Fetch timeout setting, default 7200 seconds (2 hours)
            const [timeoutRows] = await pool.query<RowDataPacket[]>(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_timeout' LIMIT 1"
            );

            let timeoutSec = 7200; // default 2 hours
            if (Array.isArray(timeoutRows) && timeoutRows.length > 0) {
                const val = timeoutRows[0].setting_value;
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 0) timeoutSec = parsed;
            } else {
                // Insert default timeout if missing
                await pool.query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('auto_logout_timeout', '7200')");
            }

            // Add timeout to locals (in minutes for client side)
            res.locals.autoLogoutTimeout = Math.ceil(timeoutSec / 60);

            const now = Date.now();
            const last = (req.session as any).lastActivity as number | undefined;

            if (last && now - last > timeoutSec * 1000) {
                console.log(`[AutoLogout] Session for user ${userId} expired after ${timeoutSec}s of inactivity.`);
                // Session expired: destroy and redirect to login
                req.session.destroy(err => {
                    if (err) console.error('Error destroying session:', err);
                    res.clearCookie('billing_sid');

                    let redirectUrl = '/login?timeout=1';
                    if (req.path.startsWith('/kasir')) {
                        redirectUrl = '/kasir/login?timeout=1';
                    }
                    return res.redirect(redirectUrl);
                });
                return;
            }
            // Update last activity timestamp
            (req.session as any).lastActivity = now;
        }

        next();
    } catch (error) {
        console.error('Error loading auto logout setting:', error);
        res.locals.autoLogoutEnabled = false; // Default to false on error to avoid lockout
        next();
    }
}
