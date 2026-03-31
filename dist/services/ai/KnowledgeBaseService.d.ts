export interface KnowledgeItem {
    id: number;
    category: string;
    question: string;
    answer: string;
    tags?: string;
    is_active: boolean;
}
export declare class KnowledgeBaseService {
    /**
     * Search knowledge base using FULLTEXT search
     */
    static search(query: string, limit?: number): Promise<KnowledgeItem[]>;
    /**
     * Get all categories
     */
    static getCategories(): Promise<string[]>;
    /**
     * Add new knowledge item
     */
    static add(item: Omit<KnowledgeItem, 'id' | 'is_active'>): Promise<number>;
}
//# sourceMappingURL=KnowledgeBaseService.d.ts.map