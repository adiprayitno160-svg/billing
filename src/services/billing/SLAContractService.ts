import pool from '../../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface SLAContract {
  id: number;
  customer_id: number;
  contract_number: string;
  contract_title: string;
  sla_target: number;
  penalty_clause: string | null;
  compensation_terms: string | null;
  special_conditions: string | null;
  start_date: Date;
  end_date: Date;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  created_at: Date;
  updated_at: Date;
}

export class SLAContractService {
  /**
   * Get all SLA contracts with pagination and filters
   */
  static async getAllContracts(options: { page: number, limit: number, search?: string, status?: string }): Promise<{ contracts: SLAContract[], total: number, page: number, limit: number }> {
    const { page, limit, search, status } = options;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (contract_number LIKE ? OR contract_title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM customer_contracts WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.*, c.name as customer_name 
       FROM customer_contracts cc
       LEFT JOIN customers c ON cc.customer_id = c.id
       WHERE ${whereClause.replace('contract_number', 'cc.contract_number').replace('contract_title', 'cc.contract_title').replace('status = ?', 'cc.status = ?')}
       ORDER BY cc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      contracts: rows as SLAContract[],
      total,
      page,
      limit
    };
  }

  /**
   * Create a new SLA contract
   */
  static async createContract(contract: Omit<SLAContract, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO customer_contracts 
       (customer_id, contract_number, contract_title, sla_target, penalty_clause, 
        compensation_terms, special_conditions, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contract.customer_id,
        contract.contract_number,
        contract.contract_title,
        contract.sla_target,
        contract.penalty_clause,
        contract.compensation_terms,
        contract.special_conditions,
        contract.start_date,
        contract.end_date,
        contract.status
      ]
    );

    return result.insertId;
  }

  /**
   * Get SLA contract by ID
   */
  static async getContractById(id: number): Promise<SLAContract | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_contracts WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? (rows[0] as SLAContract) : null;
  }

  /**
   * Get all contracts for a customer
   */
  static async getContractsByCustomerId(customerId: number): Promise<SLAContract[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_contracts WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );

    return rows as SLAContract[];
  }

  /**
   * Get active contracts
   */
  static async getActiveContracts(): Promise<SLAContract[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customer_contracts 
       WHERE status = 'active' 
       AND start_date <= CURDATE() 
       AND end_date >= CURDATE()
       ORDER BY created_at DESC`
    );

    return rows as SLAContract[];
  }

  /**
   * Update SLA contract
   */
  static async updateContract(id: number, contract: Partial<Omit<SLAContract, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(contract)) {
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
      `UPDATE customer_contracts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * Update contract status
   */
  static async updateContractStatus(id: number, status: 'draft' | 'active' | 'expired' | 'terminated'): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE customer_contracts SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Check if customer has active contract
   */
  static async hasActiveContract(customerId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM customer_contracts 
       WHERE customer_id = ? 
       AND status = 'active' 
       AND start_date <= CURDATE() 
       AND end_date >= CURDATE() 
       LIMIT 1`,
      [customerId]
    );

    return rows.length > 0;
  }

  /**
   * Get customer's current SLA target (from contract or default)
   */
  static async getCurrentSLATarget(customerId: number): Promise<number> {
    // First check if customer has an active contract
    const activeContract = await this.hasActiveContract(customerId);

    if (activeContract) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT sla_target FROM customer_contracts 
         WHERE customer_id = ? 
         AND status = 'active' 
         AND start_date <= CURDATE() 
         AND end_date >= CURDATE()
         ORDER BY created_at DESC
         LIMIT 1`,
        [customerId]
      );

      if (rows.length > 0) {
        return Number(rows[0].sla_target);
      }
    }

    // If no active contract, get from customer's tier
    const [customerRows] = await pool.query<RowDataPacket[]>(
      `SELECT cs.custom_sla_target, ct.sla_target as tier_sla_target
       FROM customers c
       LEFT JOIN customer_sla_settings cs ON c.id = cs.customer_id
       LEFT JOIN customer_tiers ct ON cs.tier_id = ct.id OR c.tier_id = ct.id
       WHERE c.id = ?`,
      [customerId]
    );

    if (customerRows.length > 0) {
      const customerData = customerRows[0];
      // Return custom SLA target if set, otherwise tier SLA target, otherwise default
      return Number(customerData.custom_sla_target) || Number(customerData.tier_sla_target) || 95.00;
    }

    // Default SLA target
    return 95.00;
  }

  /**
   * Get contracts expiring soon (within specified days)
   */
  static async getExpiringContracts(days: number = 30): Promise<SLAContract[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customer_contracts 
       WHERE status = 'active'
       AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY end_date ASC`,
      [days]
    );

    return rows as SLAContract[];
  }

  /**
   * Get contracts that expired recently
   */
  static async getExpiredContracts(daysSince: number = 7): Promise<SLAContract[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM customer_contracts 
       WHERE status = 'active'
       AND end_date < CURDATE()
       AND end_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY end_date DESC`,
      [daysSince]
    );

    return rows as SLAContract[];
  }

  /**
   * Get contract by number
   */
  static async getContractByNumber(contractNumber: string): Promise<SLAContract | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customer_contracts WHERE contract_number = ?',
      [contractNumber]
    );

    return rows.length > 0 ? (rows[0] as SLAContract) : null;
  }
}

export default SLAContractService;