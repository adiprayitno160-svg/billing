import { Request, Response } from 'express';
import TaxCalculationService from '../../services/billing/TaxCalculationService';

export class TaxCalculationController {
  /**
   * Get all tax calculations with pagination
   */
  async getAllTaxCalculations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const transactionType = req.query.type as string || '';

      const calculations = await TaxCalculationService.getAllTaxCalculations({ page, limit, transactionType });

      res.json({
        success: true,
        data: calculations
      });
    } catch (error) {
      console.error('Error getting all tax calculations:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving tax calculations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate tax for an amount and rate
   */
  async calculateTax(req: Request, res: Response): Promise<void> {
    try {
      const { base_amount, tax_rate } = req.body;

      // Validate required fields
      if (base_amount === undefined || tax_rate === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: base_amount, tax_rate'
        });
        return;
      }

      // Validate numeric fields
      if (typeof base_amount !== 'number' || typeof tax_rate !== 'number') {
        res.status(400).json({
          success: false,
          message: 'Base amount and tax rate must be numbers'
        });
        return;
      }

      const result = TaxCalculationService.calculateTax(base_amount, tax_rate);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating tax:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating tax',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get tax calculation by transaction ID and type
   */
  async getTaxCalculation(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, transactionType } = req.params;
      const id = parseInt(transactionId);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid transaction ID'
        });
        return;
      }

      if (!transactionType) {
        res.status(400).json({
          success: false,
          message: 'Transaction type is required'
        });
        return;
      }

      const calculation = await TaxCalculationService.getTaxCalculation(id, transactionType);
      if (!calculation) {
        res.status(404).json({
          success: false,
          message: 'Tax calculation not found'
        });
        return;
      }

      res.json({
        success: true,
        data: calculation
      });
    } catch (error) {
      console.error('Error getting tax calculation:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving tax calculation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all tax calculations for a transaction
   */
  async getTaxCalculationsForTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(req.params.transactionId);

      if (isNaN(transactionId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid transaction ID'
        });
        return;
      }

      const calculations = await TaxCalculationService.getTaxCalculationsForTransaction(transactionId);

      res.json({
        success: true,
        data: calculations
      });
    } catch (error) {
      console.error('Error getting tax calculations for transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving tax calculations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get tax summary for a date range
   */
  async getTaxSummary(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'Both startDate and endDate are required (format: YYYY-MM-DD)'
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
        return;
      }

      const summary = await TaxCalculationService.getTaxSummary(start, end);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting tax summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving tax summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate tax for an invoice
   */
  async calculateInvoiceTax(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);

      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
        return;
      }

      const result = await TaxCalculationService.calculateInvoiceTax(invoiceId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating invoice tax:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating invoice tax',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process tax for an invoice
   */
  async processInvoiceTax(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);

      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
        return;
      }

      const calculation = await TaxCalculationService.processInvoiceTax(invoiceId);

      res.json({
        success: true,
        message: 'Invoice tax processed successfully',
        data: calculation
      });
    } catch (error) {
      console.error('Error processing invoice tax:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing invoice tax',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get monthly tax report
   */
  async getMonthlyTaxReport(req: Request, res: Response): Promise<void> {
    try {
      const { year, month } = req.query;

      if (!year || !month) {
        res.status(400).json({
          success: false,
          message: 'Both year and month are required'
        });
        return;
      }

      const yearNum = parseInt(year as string);
      const monthNum = parseInt(month as string);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        res.status(400).json({
          success: false,
          message: 'Year must be a valid number and month must be between 1 and 12'
        });
        return;
      }

      const report = await TaxCalculationService.getMonthlyTaxReport(yearNum, monthNum);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error getting monthly tax report:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving monthly tax report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get tax calculations by type
   */
  async getTaxCalculationsByType(req: Request, res: Response): Promise<void> {
    try {
      const transactionType = req.params.type as 'invoice' | 'payment' | 'refund' | 'adjustment';
      const limit = parseInt(req.query.limit as string) || 100;

      const validTypes = ['invoice', 'payment', 'refund', 'adjustment'];
      if (!validTypes.includes(transactionType)) {
        res.status(400).json({
          success: false,
          message: 'Invalid transaction type. Must be one of: invoice, payment, refund, adjustment'
        });
        return;
      }

      const calculations = await TaxCalculationService.getTaxCalculationsByType(transactionType, limit);

      res.json({
        success: true,
        data: calculations
      });
    } catch (error) {
      console.error('Error getting tax calculations by type:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving tax calculations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new TaxCalculationController();