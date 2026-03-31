"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectAppVersion = injectAppVersion;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Middleware to inject app version from VERSION files to all views
 *
 * Versioning Strategy:
 * - appVersion (VERSION_MAJOR): Untuk About page (2.0.8) - stable release only
 * - fullVersion (VERSION): Untuk footer/internal (2.0.8.5) - includes hotfixes
 *
 * Falls back to package.json if VERSION files are not available
 */
function injectAppVersion(req, res, next) {
    // Strategy: ALWAYS trust package.json as the single source of truth for the version.
    // VERSION and VERSION_MAJOR files are legacy or secondary.
    let version = '1.0.0';
    try {
        const packagePath = (0, path_1.join)(__dirname, '../../package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packagePath, 'utf-8'));
        if (packageJson.version) {
            version = packageJson.version;
        }
    }
    catch (err) {
        console.warn('Failed to read package.json version:', err);
    }
    // Set both to the same package.json version to ensure consistency
    // If you really want a split (major vs full), we can parse it, but for now exact match is best for debugging updates.
    res.locals.appVersion = version;
    res.locals.fullVersion = version;
    next();
}
//# sourceMappingURL=versionMiddleware.js.map