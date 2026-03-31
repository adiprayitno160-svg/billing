import { Request, Response } from 'express';
import CustomerTierService from '../../services/billing/CustomerTierService';

export class CustomerTierController {
  /**
   * Get all customer tiers
   */
  async getAllTiers(req: Request, res: Response): Promise<void> {
    try {
      const tiers = await CustomerTierService.getAllTiers();
      res.json({
        success: true,
        data: tiers
      });
    } catch (error) {
      console.error('Error getting customer tiers:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer tiers',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get tier by ID
   */
  async getTierById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid tier ID'
        });
        return;
      }

      const tier = await CustomerTierService.getTierById(id);
      if (!tier) {
        res.status(404).json({
          success: false,
          message: 'Tier not found'
        });
        return;
      }

      res.json({
        success: true,
        data: tier
      });
    } catch (error) {
      console.error('Error getting customer tier:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer tier',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new customer tier
   */
  async createTier(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, sla_target, discount_rate, max_discount_percent, priority_level } = req.body;

      // Validate required fields
      if (!name || sla_target === undefined || discount_rate === undefined || max_discount_percent === undefined || !priority_level) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: name, sla_target, discount_rate, max_discount_percent, priority_level'
        });
        return;
      }

      // Validate numeric fields
      if (typeof sla_target !== 'number' || typeof discount_rate !== 'number' || typeof max_discount_percent !== 'number') {
        res.status(400).json({
          success: false,
          message: 'SLA target, discount rate, and max discount percent must be numbers'
        });
        return;
      }

      // Validate priority level
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority_level)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority level. Must be one of: low, medium, high, critical'
        });
        return;
      }

      const newTierId = await CustomerTierService.createTier({
        name,
        description: description || '',
        sla_target,
        discount_rate,
        max_discount_percent,
        priority_level
      });

      res.status(201).json({
        success: true,
        message: 'Customer tier created successfully',
        data: { id: newTierId }
      });
    } catch (error) {
      console.error('Error creating customer tier:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating customer tier',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update a customer tier
   */
  async updateTier(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid tier ID'
        });
        return;
      }

      const { name, description, sla_target, discount_rate, max_discount_percent, priority_level } = req.body;
      const validPriorities = ['low', 'medium', 'high', 'critical'];

      // Validate priority level if provided
      if (priority_level && !validPriorities.includes(priority_level)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority level. Must be one of: low, medium, high, critical'
        });
        return;
      }

      // Prepare update object
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (sla_target !== undefined) updateData.sla_target = sla_target;
      if (discount_rate !== undefined) updateData.discount_rate = discount_rate;
      if (max_discount_percent !== undefined) updateData.max_discount_percent = max_discount_percent;
      if (priority_level !== undefined) updateData.priority_level = priority_level;

      const updated = await CustomerTierService.updateTier(id, updateData);
      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Tier not found or no changes made'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Customer tier updated successfully'
      });
    } catch (error) {
      console.error('Error updating customer tier:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating customer tier',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a customer tier
   */
  async deleteTier(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid tier ID'
        });
        return;
      }

      // Check if tier exists
      const tier = await CustomerTierService.getTierById(id);
      if (!tier) {
        res.status(404).json({
          success: false,
          message: 'Tier not found'
        });
        return;
      }

      // TODO: Check if tier is assigned to any customers before deletion
      // This would require checking customer records

      const deleted = await CustomerTierService.deleteTier(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Tier not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Customer tier deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting customer tier:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting customer tier',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get customer SLA settings
   */
  async getCustomerSLASettings(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const settings = await CustomerTierService.getCustomerSLASettings(customerId);
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error getting customer SLA settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer SLA settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update customer SLA settings
   */
  async updateCustomerSLASettings(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const { tier_id, custom_sla_target, custom_discount_rate, custom_max_discount_percent, priority_override } = req.body;

      // Validate priority override if provided
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (priority_override && !validPriorities.includes(priority_override)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority override. Must be one of: low, medium, high, critical'
        });
        return;
      }

      const updateData: any = {};
      if (tier_id !== undefined) updateData.tier_id = tier_id;
      if (custom_sla_target !== undefined) updateData.custom_sla_target = custom_sla_target;
      if (custom_discount_rate !== undefined) updateData.custom_discount_rate = custom_discount_rate;
      if (custom_max_discount_percent !== undefined) updateData.custom_max_discount_percent = custom_max_discount_percent;
      if (priority_override !== undefined) updateData.priority_override = priority_override;

      const updated = await CustomerTierService.updateCustomerSLASettings(customerId, updateData);
      if (!updated) {
        res.status(500).json({
          success: false,
          message: 'Error updating customer SLA settings'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Customer SLA settings updated successfully'
      });
    } catch (error) {
      console.error('Error updating customer SLA settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating customer SLA settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate and update customer credit score
   */
  async calculateCustomerCreditScore(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const score = await CustomerTierService.calculateAndUpdateCreditScore(customerId);
      
      res.json({
        success: true,
        message: 'Customer credit score calculated and updated successfully',
        data: score
      });
    } catch (error) {
      console.error('Error calculating customer credit score:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating customer credit score',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new CustomerTierController();