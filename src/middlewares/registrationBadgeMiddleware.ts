import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

export async function registrationBadgeMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM registration_requests WHERE status = "pending"');
        res.locals.pendingRegistrationCount = rows[0].count || 0;
    } catch (error) {
        res.locals.pendingRegistrationCount = 0;
    }
    next();
}
