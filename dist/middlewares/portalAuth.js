"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePortalAuth = requirePortalAuth;
exports.redirectIfPortalAuthenticated = redirectIfPortalAuthenticated;
exports.attachPortalSession = attachPortalSession;
/**
 * Middleware untuk autentikasi portal prepaid
 * Check if customer is logged in to portal
 */
function requirePortalAuth(req, res, next) {
    const session = req.session;
    if (!session || !session.portalCustomerId) {
        return res.redirect('/prepaid/portal/login?error=Silakan login terlebih dahulu');
    }
    next();
}
/**
 * Middleware untuk redirect jika sudah login
 */
function redirectIfPortalAuthenticated(req, res, next) {
    const session = req.session;
    if (session && session.portalCustomerId) {
        return res.redirect('/prepaid/portal/packages');
    }
    next();
}
/**
 * Attach portal session data to locals untuk views
 */
function attachPortalSession(req, res, next) {
    const session = req.session;
    if (session && session.portalCustomerId) {
        res.locals.portalLoggedIn = true;
        res.locals.portalCustomerId = session.portalCustomerId;
        res.locals.portalCustomerName = session.customerName || 'Customer';
    }
    else {
        res.locals.portalLoggedIn = false;
    }
    next();
}
//# sourceMappingURL=portalAuth.js.map