"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageApiController = void 0;
const pppoeService_1 = require("../../services/pppoeService");
const pool_1 = require("../../db/pool");
class PackageApiController {
    /**
     * Get PPPoE Package Detail by ID
     * GET /api/packages/pppoe/:id
     */
    static async getPppoePackageDetail(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'Invalid package ID' });
            }
            const pkg = await (0, pppoeService_1.getPackageById)(id);
            if (!pkg) {
                return res.status(404).json({ success: false, message: 'Package not found' });
            }
            res.json({
                success: true,
                data: pkg
            });
        }
        catch (error) {
            console.error('[API] Error fetching PPPoE package:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * Get Packages by Connection Type
     * GET /api/packages/:connectionType
     */
    static async getPackagesByType(req, res) {
        try {
            const { connectionType } = req.params;
            let packages = [];
            if (connectionType === 'pppoe') {
                packages = await (0, pppoeService_1.listPackages)();
            }
            else if (connectionType === 'static_ip') {
                // Fetch static IP packages manually as there isn't a unified service export yet, or use database directly
                const conn = await pool_1.databasePool.getConnection();
                try {
                    const [rows] = await conn.query('SELECT * FROM static_ip_packages ORDER BY name ASC');
                    packages = rows;
                }
                finally {
                    conn.release();
                }
            }
            else {
                return res.status(400).json({ success: false, message: 'Invalid connection type. Use "pppoe" or "static_ip"' });
            }
            res.json({
                success: true,
                data: packages
            });
        }
        catch (error) {
            console.error('[API] Error fetching packages:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PackageApiController = PackageApiController;
//# sourceMappingURL=PackageApiController.js.map