import { Request, Response, NextFunction } from 'express';
// import { OntService, OntInventoryService } from '../../services/ftth/ontService';

/**
 * Get all ONT records
 */
export async function getOntList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const onts = await OntService.listOnts();
        res.json({
            success: true,
            data: onts
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get ONT by ID
 */
export async function getOntById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(req.params.id || '0');
        
        // Validate ID
        if (isNaN(id) || id <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid ONT ID'
            });
            return;
        }
        
        const ont = await OntService.getOntById(id);
        
        if (!ont) {
            res.status(404).json({
                success: false,
                message: 'ONT not found'
            });
            return;
        }

        res.json({
            success: true,
            data: ont
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Create new ONT
 */
export async function createOnt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const {
            serial_number,
            mac_address,
            model,
            customer_id,
            olt_id,
            olt_port,
            status,
            location,
            installed_date,
            notes
        } = req.body;

        // Validate required fields
        if (!serial_number) {
            res.status(400).json({
                success: false,
                message: 'Serial number is required'
            });
        }

        // Check if serial number already exists
        const existingOnt = await OntService.getOntBySerial(serial_number);
        if (existingOnt) {
            res.status(400).json({
                success: false,
                message: 'ONT with this serial number already exists'
            });
        }

        const ontId = await OntService.createOnt({
            serial_number,
            mac_address,
            model,
            customer_id: customer_id ? parseInt(customer_id) : undefined,
            olt_id: olt_id ? parseInt(olt_id) : undefined,
            olt_port,
            status: status || 'offline',
            location,
            installed_date: installed_date ? new Date(installed_date) : undefined,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'ONT created successfully',
            data: { id: ontId }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update ONT
 */
export async function updateOnt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idParam = req.params.id;
        console.log('updateOnt controller - idParam:', idParam, 'type:', typeof idParam);
        
        // Validate ID parameter
        if (!idParam || isNaN(Number(idParam))) {
            res.status(400).json({
                success: false,
                message: 'Invalid ONT ID parameter'
            });
            return;
        }
        
        const id = parseInt(idParam);
        console.log('updateOnt controller - parsed id:', id, 'type:', typeof id);
        const {
            serial_number,
            mac_address,
            model,
            customer_id,
            olt_id,
            olt_port,
            status,
            location,
            installed_date,
            notes
        } = req.body;

        const updated = await OntService.updateOnt(id, {
            serial_number,
            mac_address,
            model,
            customer_id: customer_id ? parseInt(customer_id) : undefined,
            olt_id: olt_id ? parseInt(olt_id) : undefined,
            olt_port,
            status,
            location,
            installed_date: installed_date ? new Date(installed_date) : undefined,
            notes
        });

        if (!updated) {
            res.status(400).json({
                success: false,
                message: 'ONT not found'
            });
        }

        res.json({
            success: true,
            message: 'ONT updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Delete ONT
 */
export async function deleteOnt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(req.params.id || '0');
        
        // Validate ID
        if (isNaN(id) || id <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid ONT ID'
            });
            return;
        }
        
        const deleted = await OntService.deleteOnt(id);

        if (!deleted) {
            res.status(400).json({
                success: false,
                message: 'ONT not found'
            });
        }

        res.json({
            success: true,
            message: 'ONT deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Assign ONT to customer
 */
export async function assignOntToCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { ontId, customerId } = req.body;

        if (!ontId || !customerId) {
            res.status(400).json({
                success: false,
                message: 'ONT ID and Customer ID are required'
            });
        }

        const assigned = await OntService.assignOntToCustomer(
            parseInt(ontId),
            parseInt(customerId)
        );

        if (!assigned) {
            res.status(400).json({
                success: false,
                message: 'ONT or Customer not found'
            });
        }

        res.json({
            success: true,
            message: 'ONT assigned to customer successfully'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update ONT status
 */
export async function updateOntStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { ontId, status, signalStrength } = req.body;

        if (!ontId || !status) {
            res.status(400).json({
                success: false,
                message: 'ONT ID and status are required'
            });
        }

        const updated = await OntService.updateOntStatus(
            parseInt(ontId),
            status,
            signalStrength ? parseFloat(signalStrength) : undefined
        );

        res.json({
            success: true,
            message: 'ONT status updated successfully'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get ONT status history
 */
export async function getOntStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const ontId = parseInt(req.params.id || '0');
        
        // Validate ID
        if (isNaN(ontId) || ontId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid ONT ID'
            });
            return;
        }
        
        const limit = parseInt(req.query.limit as string || '100') || 100;

        const history = await OntService.getOntStatusHistory(ontId, limit);

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get ONT statistics
 */
export async function getOntStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const stats = await OntService.getOntStatistics();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get customer ONT
 */
export async function getCustomerOnt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const customerId = parseInt(req.params.customerId || '0');
        
        // Validate ID
        if (isNaN(customerId) || customerId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid Customer ID'
            });
            return;
        }
        
        const ont = await OntService.getOntByCustomer(customerId);

        res.json({
            success: true,
            data: ont
        });
    } catch (error) {
        next(error);
    }
}

// Inventory Management

/**
 * Get ONT inventory
 */
export async function getOntInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const inventory = await OntInventoryService.listInventory();

        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get available ONTs
 */
export async function getAvailableOnts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const availableOnts = await OntInventoryService.getAvailableOnts();

        res.json({
            success: true,
            data: availableOnts
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Add ONT to inventory
 */
export async function addToInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const {
            serial_number,
            mac_address,
            model,
            status,
            location,
            purchase_date,
            warranty_expiry,
            notes
        } = req.body;

        if (!serial_number) {
            res.status(400).json({
                success: false,
                message: 'Serial number is required'
            });
        }

        const inventoryId = await OntInventoryService.addToInventory({
            serial_number,
            mac_address,
            model,
            status: status || 'available',
            location,
            purchase_date: purchase_date ? new Date(purchase_date) : undefined,
            warranty_expiry: warranty_expiry ? new Date(warranty_expiry) : undefined,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'ONT added to inventory successfully',
            data: { id: inventoryId }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update inventory status
 */
export async function updateInventoryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(req.params.id || '0');
        
        // Validate ID
        if (isNaN(id) || id <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid ONT ID'
            });
            return;
        }
        
        const { status } = req.body;

        if (!status) {
            res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const updated = await OntInventoryService.updateInventoryStatus(id, status);

        if (!updated) {
            res.status(400).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        res.json({
            success: true,
            message: 'Inventory status updated successfully'
        });
    } catch (error) {
        next(error);
    }
}
