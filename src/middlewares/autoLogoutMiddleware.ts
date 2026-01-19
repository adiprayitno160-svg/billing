import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Middleware untuk menyediakan setting auto logout ke semua view
 * Data auto_logout_enabled akan tersedia sebagai autoLogoutEnabled di semua EJS templates
 */
export async function autoLogoutMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        console.log('[Middleware] autoLogoutMiddleware start');
        // Query auto_logout_enabled setting from database
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_enabled' LIMIT 1"
        );

        // Set autoLogoutEnabled di res.locals agar tersedia di semua view
        const setting = Array.isArray(settings) && settings.length > 0 ? settings[0] : null;
        const autoLogoutEnabled = setting?.setting_value === 'true' || setting?.setting_value === true;

        res.locals.autoLogoutEnabled = autoLogoutEnabled;

        // If enabled, enforce timeout based on auto_logout_timeout (seconds)
        if (autoLogoutEnabled) {
            // Fetch timeout setting, default 1800 seconds (30 minutes)
            const [timeoutRows] = await pool.query<RowDataPacket[]>(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_timeout' LIMIT 1"
            );
            let timeoutSec = 1800; // default
            if (Array.isArray(timeoutRows) && timeoutRows.length > 0) {
                const val = timeoutRows[0].setting_value;
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 0) timeoutSec = parsed;
            } else {
                // Insert default timeout if missing
                await pool.query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('auto_logout_timeout', '1800')");
            }

            const now = Date.now();
            const last = (req.session as any).lastActivity as number | undefined;
            if (last && now - last > timeoutSec * 1000) {
                // Session expired: destroy and redirect to login
                req.session.destroy(err => {
                    if (err) console.error('Error destroying session:', err);
                    res.clearCookie('billing_sid');
                    return res.redirect('/login?timeout=1');
                });
                return;
            }
            // Update last activity timestamp
            (req.session as any).lastActivity = now;
        }

        next();
        console.log('[Middleware] autoLogoutMiddleware end');
    } catch (error) {
        console.error('Error loading auto logout setting:', error);

        // Set default value (enabled) jika terjadi error
        res.locals.autoLogoutEnabled = true;

        next();
    }
}
