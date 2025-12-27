"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoLogoutMiddleware = autoLogoutMiddleware;
const pool_1 = __importDefault(require("../db/pool"));
/**
 * Middleware untuk menyediakan setting auto logout ke semua view
 * Data auto_logout_enabled akan tersedia sebagai autoLogoutEnabled di semua EJS templates
 */
async function autoLogoutMiddleware(req, res, next) {
    try {
        // Query auto_logout_enabled setting dari database
        const [settings] = await pool_1.default.query("SELECT setting_value FROM system_settings WHERE setting_key = 'auto_logout_enabled' LIMIT 1");
        // Set autoLogoutEnabled di res.locals agar tersedia di semua view
        const setting = Array.isArray(settings) && settings.length > 0 ? settings[0] : null;
        const autoLogoutEnabled = setting?.setting_value === 'true' || setting?.setting_value === true;
        res.locals.autoLogoutEnabled = autoLogoutEnabled;
        next();
    }
    catch (error) {
        console.error('Error loading auto logout setting:', error);
        // Set default value (enabled) jika terjadi error
        res.locals.autoLogoutEnabled = true;
        next();
    }
}
//# sourceMappingURL=autoLogoutMiddleware.js.map