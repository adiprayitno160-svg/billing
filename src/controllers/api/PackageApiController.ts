import { Request, Response } from 'express';
import { getPackageById, listPackages } from '../../services/pppoeService';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class PackageApiController {
    /**
     * Get PPPoE Package Detail by ID
     * GET /api/packages/pppoe/:id
     */
    static async getPppoePackageDetail(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'Invalid package ID' });
            }

            const pkg = await getPackageById(id);

            if (!pkg) {
                return res.status(404).json({ success: false, message: 'Package not found' });
            }

            res.json({
                success: true,
                data: pkg
            });
        } catch (error: any) {
            console.error('[API] Error fetching PPPoE package:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get Packages by Connection Type
     * GET /api/packages/:connectionType
     */
    static async getPackagesByType(req: Request, res: Response) {
        try {
            const { connectionType } = req.params;
            let packages: any[] = [];

            if (connectionType === 'pppoe') {
                packages = await listPackages();
            } else if (connectionType === 'static_ip') {
                // Fetch static IP packages manually as there isn't a unified service export yet, or use database directly
                const conn = await databasePool.getConnection();
                try {
                    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM static_ip_packages ORDER BY name ASC');
                    packages = rows;
                } finally {
                    conn.release();
                }
            } else {
                return res.status(400).json({ success: false, message: 'Invalid connection type. Use "pppoe" or "static_ip"' });
            }

            res.json({
                success: true,
                data: packages
            });
        } catch (error: any) {
            console.error('[API] Error fetching packages:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
