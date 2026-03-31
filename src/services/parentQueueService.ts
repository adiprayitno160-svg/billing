import { databasePool } from '../db/pool';

export type ParentQueue = {
    id: number;
    name: string;
    description?: string | null;
    status: 'active' | 'inactive';
    created_at: Date;
    updated_at: Date;
};

export async function listParentQueues(): Promise<ParentQueue[]> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
            SELECT * FROM parent_queues WHERE status = 'active' ORDER BY name ASC
        `);
        return Array.isArray(rows) ? rows as ParentQueue[] : [];
    } finally {
        conn.release();
    }
}

export async function getParentQueueById(id: number): Promise<ParentQueue | null> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM parent_queues WHERE id = ?', [id]);
        const result = Array.isArray(rows) ? rows : [];
        return result.length > 0 ? result[0] as ParentQueue : null;
    } finally {
        conn.release();
    }
}

export async function createParentQueue(data: { name: string; description?: string; status?: 'active' | 'inactive' }): Promise<number> {
    const conn = await databasePool.getConnection();
    try {
        const [result] = await conn.execute(
            'INSERT INTO parent_queues (name, description, status) VALUES (?, ?, ?)',
            [data.name, data.description || null, data.status || 'active']
        );
        return (result as any).insertId as number;
    } finally {
        conn.release();
    }
}

export async function updateParentQueue(id: number, data: { name?: string; description?: string; status?: 'active' | 'inactive' }): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (fields.length > 0) {
            fields.push('updated_at = NOW()');
            values.push(id);
            await conn.execute(`UPDATE parent_queues SET ${fields.join(', ')} WHERE id = ?`, values);
        }
    } finally {
        conn.release();
    }
}

export async function deleteParentQueue(id: number): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        await conn.execute('DELETE FROM parent_queues WHERE id = ?', [id]);
    } finally {
        conn.release();
    }
}



