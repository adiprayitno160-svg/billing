import { Request, Response } from 'express';
import { databasePool } from '../db/pool';

export class BulkOperationsController {
    private wsService: any;

    constructor(db: any, wsService: any) {
        this.wsService = wsService;
    }

    /**
     * Bulk enable/disable ONTs
     */
    async bulkToggleONTStatus(req: Request, res: Response): Promise<void> {
        try {
            const { mac_addresses, status, operation_type } = req.body;

            if (!Array.isArray(mac_addresses) || mac_addresses.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'mac_addresses must be a non-empty array'
                });
                return;
            }

            if (typeof status !== 'boolean') {
                res.status(400).json({
                    success: false,
                    message: 'Status must be boolean (true/false)'
                });
                return;
            }

            // Validate MAC addresses
            const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
            const invalidMacs = mac_addresses.filter((mac: string) => !macRegex.test(mac));
            
            if (invalidMacs.length > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid MAC address format in array',
                    invalid_macs: invalidMacs
                });
                return;
            }

            // SNMP service removed - return error
            res.status(503).json({
                success: false,
                message: 'SNMP service has been removed. This feature is no longer available.'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: `Error in bulk toggle operation: ${error.message}`
            });
        }
    }

    /**
     * Bulk sync ONTs from OLT
     */
    async bulkSyncONTs(req: Request, res: Response): Promise<void> {
        res.status(503).json({
            success: false,
            message: 'SNMP service has been removed. This feature is no longer available.'
        });
    }

    /**
     * Bulk update ONT information
     */
    async bulkUpdateONTInfo(req: Request, res: Response): Promise<void> {
        try {
            const { ont_updates } = req.body;

            if (!Array.isArray(ont_updates) || ont_updates.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'ont_updates must be a non-empty array'
                });
                return;
            }

            const results = [];
            let successCount = 0;
            let failCount = 0;

            for (const update of ont_updates) {
                try {
                    const { mac_address, customer_id, location, notes } = update;

                    // Validate MAC address
                    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
                    if (!macRegex.test(mac_address)) {
                        results.push({
                            mac_address,
                            success: false,
                            message: 'Invalid MAC address format'
                        });
                        failCount++;
                        continue;
                    }

                    // Update ONT in database
                    await databasePool.execute(
                        `UPDATE onts SET 
                            customer_id = ?, 
                            location = ?, 
                            notes = ?, 
                            updated_at = NOW()
                         WHERE mac_address = ?`,
                        [customer_id, location, notes, mac_address]
                    );

                    results.push({
                        mac_address,
                        success: true,
                        message: 'ONT information updated successfully'
                    });
                    successCount++;
                } catch (error: any) {
                    results.push({
                        mac_address: update.mac_address,
                        success: false,
                        message: error.message
                    });
                    failCount++;
                }
            }

            const result = {
                success: failCount === 0,
                data: results,
                summary: {
                    total: ont_updates.length,
                    success: successCount,
                    failed: failCount
                }
            };

            // Log bulk operation
            await this.logBulkOperation('bulk_update_info', ont_updates.map(u => u.mac_address), null, result);

            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: `Error in bulk update: ${error.message}`
            });
        }
    }

    /**
     * Bulk assign ONTs to customers
     */
    async bulkAssignONTs(req: Request, res: Response): Promise<void> {
        try {
            const { assignments } = req.body;

            if (!Array.isArray(assignments) || assignments.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'assignments must be a non-empty array'
                });
                return;
            }

            const results = [];
            let successCount = 0;
            let failCount = 0;

            for (const assignment of assignments) {
                try {
                    const { mac_address, customer_id } = assignment;

                    // Validate MAC address
                    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
                    if (!macRegex.test(mac_address)) {
                        results.push({
                            mac_address,
                            success: false,
                            message: 'Invalid MAC address format'
                        });
                        failCount++;
                        continue;
                    }

                    // Check if customer exists
                    const [customers] = await databasePool.execute(
                        'SELECT id FROM customers WHERE id = ?',
                        [customer_id]
                    );

                    if (!Array.isArray(customers) || customers.length === 0) {
                        results.push({
                            mac_address,
                            success: false,
                            message: 'Customer not found'
                        });
                        failCount++;
                        continue;
                    }

                    // Assign ONT to customer
                    await databasePool.execute(
                        `UPDATE onts SET 
                            customer_id = ?, 
                            assigned_at = NOW(),
                            updated_at = NOW()
                         WHERE mac_address = ?`,
                        [customer_id, mac_address]
                    );

                    results.push({
                        mac_address,
                        success: true,
                        message: 'ONT assigned to customer successfully'
                    });
                    successCount++;
                } catch (error: any) {
                    results.push({
                        mac_address: assignment.mac_address,
                        success: false,
                        message: error.message
                    });
                    failCount++;
                }
            }

            const result = {
                success: failCount === 0,
                data: results,
                summary: {
                    total: assignments.length,
                    success: successCount,
                    failed: failCount
                }
            };

            // Log bulk operation
            await this.logBulkOperation('bulk_assign', assignments.map(a => a.mac_address), null, result);

            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: `Error in bulk assignment: ${error.message}`
            });
        }
    }

    /**
     * Bulk unassign ONTs
     */
    async bulkUnassignONTs(req: Request, res: Response): Promise<void> {
        try {
            const { mac_addresses } = req.body;

            if (!Array.isArray(mac_addresses) || mac_addresses.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'mac_addresses must be a non-empty array'
                });
                return;
            }

            // Validate MAC addresses
            const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
            const invalidMacs = mac_addresses.filter((mac: string) => !macRegex.test(mac));
            
            if (invalidMacs.length > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid MAC address format in array',
                    invalid_macs: invalidMacs
                });
                return;
            }

            const results = [];
            let successCount = 0;
            let failCount = 0;

            for (const macAddress of mac_addresses) {
                try {
                    // Unassign ONT
                    await databasePool.execute(
                        `UPDATE onts SET 
                            customer_id = NULL, 
                            unassigned_at = NOW(),
                            updated_at = NOW()
                         WHERE mac_address = ?`,
                        [macAddress]
                    );

                    results.push({
                        mac_address: macAddress,
                        success: true,
                        message: 'ONT unassigned successfully'
                    });
                    successCount++;
                } catch (error: any) {
                    results.push({
                        mac_address: macAddress,
                        success: false,
                        message: error.message
                    });
                    failCount++;
                }
            }

            const result = {
                success: failCount === 0,
                data: results,
                summary: {
                    total: mac_addresses.length,
                    success: successCount,
                    failed: failCount
                }
            };

            // Log bulk operation
            await this.logBulkOperation('bulk_unassign', mac_addresses, null, result);

            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: `Error in bulk unassignment: ${error.message}`
            });
        }
    }

    /**
     * Get bulk operation history
     */
    async getBulkOperationHistory(req: Request, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 50, operation_type } = req.query;
            const offset = (Number(page) - 1) * Number(limit);

            let whereClause = '';
            let params: any[] = [];

            if (operation_type) {
                whereClause = 'WHERE operation_type = ?';
                params.push(operation_type);
            }

            const [operations] = await databasePool.execute(
                `SELECT * FROM bulk_operations 
                 ${whereClause}
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [...params, Number(limit), offset]
            );

            const [totalCount] = await databasePool.execute(
                `SELECT COUNT(*) as total FROM bulk_operations ${whereClause}`,
                params
            );

            res.json({
                success: true,
                data: {
                    operations: Array.isArray(operations) ? operations : [],
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: Array.isArray(totalCount) ? (totalCount[0] as any).total : 0,
                        pages: Math.ceil((Array.isArray(totalCount) ? (totalCount[0] as any).total : 0) / Number(limit))
                    }
                }
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: `Error getting bulk operation history: ${error.message}`
            });
        }
    }

    /**
     * Log bulk operation
     */
    private async logBulkOperation(
        operationType: string, 
        macAddresses: string[], 
        status: boolean | null, 
        result: any
    ): Promise<void> {
        try {
            await databasePool.execute(
                `INSERT INTO bulk_operations (operation_type, mac_addresses, status, result, created_at) 
                 VALUES (?, ?, ?, ?, NOW())`,
                [
                    operationType,
                    JSON.stringify(macAddresses),
                    status,
                    JSON.stringify(result)
                ]
            );
        } catch (error) {
            console.error('Error logging bulk operation:', error);
        }
    }
}