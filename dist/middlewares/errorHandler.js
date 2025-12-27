"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, _next) {
    const status = err?.status || 500;
    const message = err?.message || 'Internal Server Error';
    console.error('Error handler called:', { status, message, error: err });
    // Always return JSON for API endpoints (whatsapp, api, etc.)
    const isAPIRequest = req.path.startsWith('/whatsapp') ||
        req.path.startsWith('/api') ||
        req.method === 'POST' ||
        req.headers.accept?.includes('application/json') ||
        req.headers['content-type']?.includes('application/json');
    if (isAPIRequest || !req.accepts('html')) {
        res.status(status).json({
            success: false,
            error: message,
            status
        });
        return;
    }
    // For non-API requests, render HTML error page
    res.status(status).render('error', {
        title: 'Error',
        status,
        message
    });
}
//# sourceMappingURL=errorHandler.js.map