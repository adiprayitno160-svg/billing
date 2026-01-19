import pool from '../../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface CustomerTier {
  id: number;
  name: string;
  description: string;
  sla_target: number;
  discount_rate: number;
  max_discount_percent: number;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  created_at: Date;
  updated_at: Date;
}

interface CustomerSLASetting {
  id: number;
  customer_id: number;
  tier_id: number | null;
  custom_sla_target: number | null;
  custom_discount_rate: number | null;
  custom_max_discount_percent: number | null;
  priority_override: 'low' | 'medium' | 'high' | 'critical' | null;
  created_at: Date;
  updated_at: Date;
}

interface CustomerCreditScore {
  id: number;
  customer_id: number;
  score: number;
  category: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  last_calculated: Date;
  payment_history_score: number;
  tenure_score: number;
  dispute_score: number;
  notes: string | null;
}

export class CustomerTierService {
  /**
   * Get all customer tiers
   */
  static async getAllTiers(): Promise<CustomerTier[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_tiers ORDER BY id ASC'
    );
    
    return rows as CustomerTier[];
  }

  /**
   * Get tier by ID
   */
  static async getTierById(id: number): Promise<CustomerTier | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_tiers WHERE id = ?',
      [id]
    );
    
    return rows.length > 0 ? (rows[0] as CustomerTier) : null;
  }

  /**
   * Create a new customer tier
   */
  static async createTier(tier: Omit<CustomerTier, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO customer_tiers (name, description, sla_target, discount_rate, max_discount_percent, priority_level) VALUES (?, ?, ?, ?, ?, ?)',
      [tier.name, tier.description, tier.sla_target, tier.discount_rate, tier.max_discount_percent, tier.priority_level]
    );
    
    return result.insertId;
  }

  /**
   * Update customer tier
   */
  static async updateTier(id: number, tier: Partial<Omit<CustomerTier, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(tier)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(id);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE customer_tiers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * Delete customer tier
   */
  static async deleteTier(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM customer_tiers WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Get customer SLA settings
   */
  static async getCustomerSLASettings(customerId: number): Promise<CustomerSLASetting | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customer_sla_settings WHERE customer_id = ?`,
      [customerId]
    );

    return rows.length > 0 ? (rows[0] as CustomerSLASetting) : null;
  }

  /**
   * Update customer SLA settings
   */
  static async updateCustomerSLASettings(
    customerId: number,
    settings: Partial<Omit<CustomerSLASetting, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    const existingSettings = await this.getCustomerSLASettings(customerId);
    
    if (existingSettings) {
      // Update existing settings
      const fields = [];
      const values = [];

      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(customerId);

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE customer_sla_settings SET ${fields.join(', ')} WHERE customer_id = ?`,
        values
      );

      return result.affectedRows > 0;
    } else {
      // Create new settings
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO customer_sla_settings (customer_id, tier_id, custom_sla_target, custom_discount_rate, custom_max_discount_percent, priority_override) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          customerId,
          settings.tier_id,
          settings.custom_sla_target,
          settings.custom_discount_rate,
          settings.custom_max_discount_percent,
          settings.priority_override
        ]
      );

      return result.insertId > 0;
    }
  }

  /**
   * Get customer credit score
   */
  static async getCustomerCreditScore(customerId: number): Promise<CustomerCreditScore | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_credit_scores WHERE customer_id = ?',
      [customerId]
    );

    return rows.length > 0 ? (rows[0] as CustomerCreditScore) : null;
  }

  /**
   * Calculate and update customer credit score
   */
  static async calculateAndUpdateCreditScore(customerId: number): Promise<CustomerCreditScore> {
    // This is a simplified calculation - in reality, this would be more complex
    // based on payment history, tenure, disputes, etc.
    
    // Get customer's payment history
    const [paymentHistory] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(*) as total_invoices,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
         SUM(CASE WHEN DATEDIFF(payment_date, due_date) > 0 THEN 1 ELSE 0 END) as late_payments
       FROM invoices 
       WHERE customer_id = ? AND invoice_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`,
      [customerId]
    );

    const history = paymentHistory[0];
    const totalInvoices = Number(history.total_invoices) || 1; // Avoid division by zero
    const paidInvoices = Number(history.paid_invoices) || 0;
    const latePayments = Number(history.late_payments) || 0;

    // Calculate payment history score (0-400 points)
    const paymentHistoryScore = Math.min(400, Math.floor((paidInvoices / totalInvoices) * 400));

    // Calculate tenure score (0-300 points) - based on how long they've been a customer
    const [tenureResult] = await pool.query<RowDataPacket[]>(
      `SELECT DATEDIFF(NOW(), MIN(created_at)) as days_as_customer FROM customers WHERE id = ?`,
      [customerId]
    );
    
    const daysAsCustomer = Number(tenureResult[0].days_as_customer) || 0;
    const tenureScore = Math.min(300, Math.floor(daysAsCustomer * 0.5)); // 0.5 points per day, max 300

    // Calculate dispute score (0-300 points) - fewer disputes = higher score
    const [disputeResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as dispute_count FROM tickets WHERE customer_id = ? AND status = 'open'`,
      [customerId]
    );
    
    const disputeCount = Number(disputeResult[0].dispute_count) || 0;
    const disputeScore = Math.max(0, 300 - (disputeCount * 50)); // 50 points deduction per dispute

    // Calculate total score
    const totalScore = Math.min(1000, paymentHistoryScore + tenureScore + disputeScore);

    // Determine category based on score
    let category: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
    if (totalScore >= 800) category = 'excellent';
    else if (totalScore >= 700) category = 'good';
    else if (totalScore >= 600) category = 'fair';
    else if (totalScore >= 500) category = 'poor';
    else category = 'bad';

    // Check if record exists
    const existingScore = await this.getCustomerCreditScore(customerId);
    
    if (existingScore) {
      // Update existing record
      await pool.query<ResultSetHeader>(
        `UPDATE customer_credit_scores 
         SET score = ?, category = ?, last_calculated = NOW(), 
             payment_history_score = ?, tenure_score = ?, dispute_score = ?
         WHERE customer_id = ?`,
        [totalScore, category, paymentHistoryScore, tenureScore, disputeScore, customerId]
      );
    } else {
      // Insert new record
      await pool.query<ResultSetHeader>(
        `INSERT INTO customer_credit_scores 
         (customer_id, score, category, payment_history_score, tenure_score, dispute_score) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customerId, totalScore, category, paymentHistoryScore, tenureScore, disputeScore]
      );
    }

    // Return the updated score
    return {
      id: existingScore?.id || 0,
      customer_id: customerId,
      score: totalScore,
      category,
      last_calculated: new Date(),
      payment_history_score: paymentHistoryScore,
      tenure_score: tenureScore,
      dispute_score: disputeScore,
      notes: null
    };
  }
}

export default CustomerTierService;