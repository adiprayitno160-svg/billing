import { Request, Response } from 'express';
import SLAContractService from '../../services/billing/SLAContractService';

export class SLAContractController {
  /**
   * Get all SLA contracts with pagination
   */
  async getAllContracts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const status = req.query.status as string || '';

      const contracts = await SLAContractService.getAllContracts({ page, limit, search, status });

      res.json({
        success: true,
        data: contracts
      });
    } catch (error) {
      console.error('Error getting all SLA contracts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving SLA contracts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new SLA contract
   */
  async createContract(req: Request, res: Response): Promise<void> {
    try {
      const {
        customer_id,
        contract_number,
        contract_title,
        sla_target,
        penalty_clause,
        compensation_terms,
        special_conditions,
        start_date,
        end_date,
        status
      } = req.body;

      // Validate required fields
      if (!customer_id || !contract_number || !contract_title || !sla_target || !start_date || !end_date || !status) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: customer_id, contract_number, contract_title, sla_target, start_date, end_date, status'
        });
        return;
      }

      // Validate dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format for start_date or end_date'
        });
        return;
      }

      if (startDate > endDate) {
        res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
        return;
      }

      // Validate status
      const validStatuses = ['draft', 'active', 'expired', 'terminated'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: draft, active, expired, terminated'
        });
        return;
      }

      // Validate numeric fields
      if (typeof sla_target !== 'number' || sla_target < 0 || sla_target > 100) {
        res.status(400).json({
          success: false,
          message: 'SLA target must be a number between 0 and 100'
        });
        return;
      }

      const newContractId = await SLAContractService.createContract({
        customer_id,
        contract_number,
        contract_title,
        sla_target,
        penalty_clause: penalty_clause || null,
        compensation_terms: compensation_terms || null,
        special_conditions: special_conditions || null,
        start_date: startDate,
        end_date: endDate,
        status
      });

      res.status(201).json({
        success: true,
        message: 'SLA contract created successfully',
        data: { id: newContractId }
      });
    } catch (error) {
      console.error('Error creating SLA contract:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating SLA contract',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get SLA contract by ID
   */
  async getContractById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        });
        return;
      }

      const contract = await SLAContractService.getContractById(id);
      if (!contract) {
        res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
        return;
      }

      res.json({
        success: true,
        data: contract
      });
    } catch (error) {
      console.error('Error getting SLA contract:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving SLA contract',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all contracts for a customer
   */
  async getContractsByCustomerId(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const contracts = await SLAContractService.getContractsByCustomerId(customerId);

      res.json({
        success: true,
        data: contracts
      });
    } catch (error) {
      console.error('Error getting customer contracts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer contracts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get active contracts
   */
  async getActiveContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await SLAContractService.getActiveContracts();

      res.json({
        success: true,
        data: contracts
      });
    } catch (error) {
      console.error('Error getting active contracts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving active contracts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update SLA contract
   */
  async updateContract(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        });
        return;
      }

      const {
        contract_number,
        contract_title,
        sla_target,
        penalty_clause,
        compensation_terms,
        special_conditions,
        start_date,
        end_date,
        status
      } = req.body;

      // Validate dates if provided
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (start_date !== undefined) {
        startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Invalid date format for start_date'
          });
          return;
        }
      }

      if (end_date !== undefined) {
        endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Invalid date format for end_date'
          });
          return;
        }
      }

      // Validate status if provided
      if (status !== undefined) {
        const validStatuses = ['draft', 'active', 'expired', 'terminated'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({
            success: false,
            message: 'Invalid status. Must be one of: draft, active, expired, terminated'
          });
          return;
        }
      }

      // Validate SLA target if provided
      if (sla_target !== undefined) {
        if (typeof sla_target !== 'number' || sla_target < 0 || sla_target > 100) {
          res.status(400).json({
            success: false,
            message: 'SLA target must be a number between 0 and 100'
          });
          return;
        }
      }

      // Prepare update object
      const updateData: any = {};
      if (contract_number !== undefined) updateData.contract_number = contract_number;
      if (contract_title !== undefined) updateData.contract_title = contract_title;
      if (sla_target !== undefined) updateData.sla_target = sla_target;
      if (penalty_clause !== undefined) updateData.penalty_clause = penalty_clause;
      if (compensation_terms !== undefined) updateData.compensation_terms = compensation_terms;
      if (special_conditions !== undefined) updateData.special_conditions = special_conditions;
      if (startDate !== undefined) updateData.start_date = startDate;
      if (endDate !== undefined) updateData.end_date = endDate;
      if (status !== undefined) updateData.status = status;

      const updated = await SLAContractService.updateContract(id, updateData);
      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Contract not found or no changes made'
        });
        return;
      }

      res.json({
        success: true,
        message: 'SLA contract updated successfully'
      });
    } catch (error) {
      console.error('Error updating SLA contract:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating SLA contract',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update contract status
   */
  async updateContractStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid contract ID'
        });
        return;
      }

      const { status } = req.body;

      // Validate status
      const validStatuses = ['draft', 'active', 'expired', 'terminated'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: draft, active, expired, terminated'
        });
        return;
      }

      const updated = await SLAContractService.updateContractStatus(id, status);
      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Contract status updated successfully'
      });
    } catch (error) {
      console.error('Error updating contract status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating contract status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if customer has active contract
   */
  async hasActiveContract(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const hasActive = await SLAContractService.hasActiveContract(customerId);

      res.json({
        success: true,
        data: { has_active_contract: hasActive }
      });
    } catch (error) {
      console.error('Error checking active contract:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking active contract',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get customer's current SLA target
   */
  async getCurrentSLATarget(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const slaTarget = await SLAContractService.getCurrentSLATarget(customerId);

      res.json({
        success: true,
        data: { sla_target: slaTarget }
      });
    } catch (error) {
      console.error('Error getting current SLA target:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting current SLA target',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get expiring contracts
   */
  async getExpiringContracts(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const contracts = await SLAContractService.getExpiringContracts(days);

      res.json({
        success: true,
        data: contracts
      });
    } catch (error) {
      console.error('Error getting expiring contracts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving expiring contracts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get expired contracts
   */
  async getExpiredContracts(req: Request, res: Response): Promise<void> {
    try {
      const daysSince = parseInt(req.query.days as string) || 7;

      const contracts = await SLAContractService.getExpiredContracts(daysSince);

      res.json({
        success: true,
        data: contracts
      });
    } catch (error) {
      console.error('Error getting expired contracts:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving expired contracts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get contract by number
   */
  async getContractByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { contractNumber } = req.params;

      if (!contractNumber) {
        res.status(400).json({
          success: false,
          message: 'Contract number is required'
        });
        return;
      }

      const contract = await SLAContractService.getContractByNumber(contractNumber);
      if (!contract) {
        res.status(404).json({
          success: false,
          message: 'Contract not found'
        });
        return;
      }

      res.json({
        success: true,
        data: contract
      });
    } catch (error) {
      console.error('Error getting contract by number:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving contract',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new SLAContractController();