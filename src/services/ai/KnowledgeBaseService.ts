import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface KnowledgeItem {
    id: number;
    category: string;
    question: string;
    answer: string;
    tags?: string;
    is_active: boolean;
}

export class KnowledgeBaseService {
    /**
     * Search knowledge base using FULLTEXT search
     */
    static async search(query: string, limit: number = 3): Promise<KnowledgeItem[]> {
        try {
            // Check if query is too short for FULLTEXT (usually 3-4 chars)
            if (!query || query.trim().length < 3) {
                const [rows] = await databasePool.query<RowDataPacket[]>(
                    'SELECT * FROM ai_knowledge_base WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ?) LIMIT ?',
                    [`%${query}%`, `%${query}%`, limit]
                );
                return rows as KnowledgeItem[];
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
            const [rows] = await databasePool.query<RowDataPacket[]>(sql, [query, query, limit]);
            return rows as KnowledgeItem[];
        } catch (error) {
            console.warn('[KnowledgeBase] FULLTEXT search failed, falling back to LIKE:', error);
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM ai_knowledge_base WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ?) LIMIT ?',
                [`%${query}%`, `%${query}%`, limit]
            );
            return rows as KnowledgeItem[];
        }
    }

    /**
     * Get all categories
     */
    static async getCategories(): Promise<string[]> {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            'SELECT DISTINCT category FROM ai_knowledge_base'
        );
        return rows.map(r => r.category);
    }

    /**
     * Add new knowledge item
     */
    static async add(item: Omit<KnowledgeItem, 'id' | 'is_active'>): Promise<number> {
        const [result] = await databasePool.query<ResultSetHeader>(
            'INSERT INTO ai_knowledge_base (category, question, answer, tags) VALUES (?, ?, ?, ?)',
            [item.category, item.question, item.answer, item.tags]
        );
        return result.insertId;
    }
}
