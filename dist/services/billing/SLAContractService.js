"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLAContractService = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
class SLAContractService {
    /**
     * Get all SLA contracts with pagination and filters
     */
    static async getAllContracts(options) {
        const { page, limit, search, status } = options;
        const offset = (page - 1) * limit;
        let whereClause = '1=1';
        const params = [];
        if (search) {
            whereClause += ' AND (contract_number LIKE ? OR contract_title LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        // Get total count
        const [countResult] = await pool_1.default.query(`SELECT COUNT(*) as total FROM customer_contracts WHERE ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated data
        const [rows] = await pool_1.default.query(`SELECT cc.*, c.name as customer_name 
       FROM customer_contracts cc
       LEFT JOIN customers c ON cc.customer_id = c.id
       WHERE ${whereClause.replace('contract_number', 'cc.contract_number').replace('contract_title', 'cc.contract_title').replace('status = ?', 'cc.status = ?')}
       ORDER BY cc.created_at DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        return {
            contracts: rows,
            total,
            page,
            limit
        };
    }
    /**
     * Create a new SLA contract
     */
    static async createContract(contract) {
        const [result] = await pool_1.default.query(`INSERT INTO customer_contracts 
       (customer_id, contract_number, contract_title, sla_target, penalty_clause, 
        compensation_terms, special_conditions, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        return result.insertId;
    }
    /**
     * Get SLA contract by ID
     */
    static async getContractById(id) {
        const [rows] = await pool_1.default.query('SELECT * FROM customer_contracts WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Get all contracts for a customer
     */
    static async getContractsByCustomerId(customerId) {
        const [rows] = await pool_1.default.query('SELECT * FROM customer_contracts WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
        return rows;
    }
    /**
     * Get active contracts
     */
    static async getActiveContracts() {
        const [rows] = await pool_1.default.query(`SELECT * FROM customer_contracts 
       WHERE status = 'active' 
       AND start_date <= CURDATE() 
       AND end_date >= CURDATE()
       ORDER BY created_at DESC`);
        return rows;
    }
    /**
     * Update SLA contract
     */
    static async updateContract(id, contract) {
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
        const [result] = await pool_1.default.query(`UPDATE customer_contracts SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }
    /**
     * Update contract status
     */
    static async updateContractStatus(id, status) {
        const [result] = await pool_1.default.query('UPDATE customer_contracts SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
        return result.affectedRows > 0;
    }
    /**
     * Check if customer has active contract
     */
    static async hasActiveContract(customerId) {
        const [rows] = await pool_1.default.query(`SELECT id FROM customer_contracts 
       WHERE customer_id = ? 
       AND status = 'active' 
       AND start_date <= CURDATE() 
       AND end_date >= CURDATE() 
       LIMIT 1`, [customerId]);
        return rows.length > 0;
    }
    /**
     * Get customer's current SLA target (from contract or default)
     */
    static async getCurrentSLATarget(customerId) {
        // First check if customer has an active contract
        const activeContract = await this.hasActiveContract(customerId);
        if (activeContract) {
            const [rows] = await pool_1.default.query(`SELECT sla_target FROM customer_contracts 
         WHERE customer_id = ? 
         AND status = 'active' 
         AND start_date <= CURDATE() 
         AND end_date >= CURDATE()
         ORDER BY created_at DESC
         LIMIT 1`, [customerId]);
            if (rows.length > 0) {
                return Number(rows[0].sla_target);
            }
        }
        // If no active contract, get from customer's tier
        const [customerRows] = await pool_1.default.query(`SELECT cs.custom_sla_target, ct.sla_target as tier_sla_target
       FROM customers c
       LEFT JOIN customer_sla_settings cs ON c.id = cs.customer_id
       LEFT JOIN customer_tiers ct ON cs.tier_id = ct.id OR c.tier_id = ct.id
       WHERE c.id = ?`, [customerId]);
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
    static async getExpiringContracts(days = 30) {
        const [rows] = await pool_1.default.query(`SELECT * FROM customer_contracts 
       WHERE status = 'active'
       AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY end_date ASC`, [days]);
        return rows;
    }
    /**
     * Get contracts that expired recently
     */
    static async getExpiredContracts(daysSince = 7) {
        const [rows] = await pool_1.default.query(`SELECT * FROM customer_contracts 
       WHERE status = 'active'
       AND end_date < CURDATE()
       AND end_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY end_date DESC`, [daysSince]);
        return rows;
    }
    /**
     * Get contract by number
     */
    static async getContractByNumber(contractNumber) {
        const [rows] = await pool_1.default.query('SELECT * FROM customer_contracts WHERE contract_number = ?', [contractNumber]);
        return rows.length > 0 ? rows[0] : null;
    }
}
exports.SLAContractService = SLAContractService;
exports.default = SLAContractService;
//# sourceMappingURL=SLAContractService.js.map