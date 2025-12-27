"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIntParam = getIntParam;
exports.requireIntParam = requireIntParam;
/**
 * Validate and parse integer parameter from request params
 */
function getIntParam(req, paramName) {
    const value = req.params[paramName];
    if (!value) {
        return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
}
/**
 * Validate required integer parameter and return error response if invalid
 */
function requireIntParam(req, res, paramName) {
    const value = getIntParam(req, paramName);
    if (value === null) {
        res.status(400).json({
            success: false,
            error: `${paramName} is required and must be a valid integer`
        });
        return null;
    }
    return value;
}
//# sourceMappingURL=paramValidator.js.map