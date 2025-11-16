import { Request, Response } from 'express';

/**
 * Validate and parse integer parameter from request params
 */
export function getIntParam(req: Request, paramName: string): number | null {
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
export function requireIntParam(
    req: Request, 
    res: Response, 
    paramName: string
): number | null {
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






