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
        // Query auto_logout_enabled setting dari database
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_enabled' LIMIT 1"
        );

        // Set autoLogoutEnabled di res.locals agar tersedia di semua view
        const setting = Array.isArray(settings) && settings.length > 0 ? settings[0] : null;
        const autoLogoutEnabled = setting?.setting_value === 'true' || setting?.setting_value === true;

        res.locals.autoLogoutEnabled = autoLogoutEnabled;

        next();
        console.log('[Middleware] autoLogoutMiddleware end');
    } catch (error) {
        console.error('Error loading auto logout setting:', error);

        // Set default value (enabled) jika terjadi error
        res.locals.autoLogoutEnabled = true;

        next();
    }
}



