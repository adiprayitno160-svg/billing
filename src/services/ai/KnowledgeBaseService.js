"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeBaseService = void 0;
const pool_1 = require("../../db/pool");
class KnowledgeBaseService {
    /**
     * Search knowledge base using FULLTEXT search
     */
    static async search(query, limit = 3) {
        try {
            // Check if query is too short for FULLTEXT (usually 3-4 chars)
            if (!query || query.trim().length < 3) {
                const [rows] = await pool_1.databasePool.query('SELECT * FROM ai_knowledge_base WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ?) LIMIT ?', [`%${query}%`, `%${query}%`, limit]);
                return rows;
            }
            const sql = `
                SELECT *, 
                MATCH(question, answer) AGAINST(?) as score
                FROM ai_knowledge_base
                WHERE is_active = 1
                AND MATCH(question, answer) AGAINST(?)
                ORDER BY score DESC
                LIMIT ?
            `;
            const [rows] = await pool_1.databasePool.query(sql, [query, query, limit]);
            return rows;
        }
        catch (error) {
            console.warn('[KnowledgeBase] FULLTEXT search failed, falling back to LIKE:', error);
            const [rows] = await pool_1.databasePool.query('SELECT * FROM ai_knowledge_base WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ?) LIMIT ?', [`%${query}%`, `%${query}%`, limit]);
            return rows;
        }
    }
    /**
     * Get all categories
     */
    static async getCategories() {
        const [rows] = await pool_1.databasePool.query('SELECT DISTINCT category FROM ai_knowledge_base');
        return rows.map(r => r.category);
    }
    /**
     * Add new knowledge item
     */
    static async add(item) {
        const [result] = await pool_1.databasePool.query('INSERT INTO ai_knowledge_base (category, question, answer, tags) VALUES (?, ?, ?, ?)', [item.category, item.question, item.answer, item.tags]);
        return result.insertId;
    }
}
exports.KnowledgeBaseService = KnowledgeBaseService;
