import { Request, Response } from 'express';
/**
 * Validate and parse integer parameter from request params
 */
export declare function getIntParam(req: Request, paramName: string): number | null;
/**
 * Validate required integer parameter and return error response if invalid
 */
export declare function requireIntParam(req: Request, res: Response, paramName: string): number | null;
//# sourceMappingURL=paramValidator.d.ts.map