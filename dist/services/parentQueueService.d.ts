export type ParentQueue = {
    id: number;
    name: string;
    description?: string | null;
    status: 'active' | 'inactive';
    created_at: Date;
    updated_at: Date;
};
export declare function listParentQueues(): Promise<ParentQueue[]>;
export declare function getParentQueueById(id: number): Promise<ParentQueue | null>;
export declare function createParentQueue(data: {
    name: string;
    description?: string;
    status?: 'active' | 'inactive';
}): Promise<number>;
export declare function updateParentQueue(id: number, data: {
    name?: string;
    description?: string;
    status?: 'active' | 'inactive';
}): Promise<void>;
export declare function deleteParentQueue(id: number): Promise<void>;
//# sourceMappingURL=parentQueueService.d.ts.map