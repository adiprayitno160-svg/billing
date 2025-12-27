"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listParentQueues = listParentQueues;
exports.getParentQueueById = getParentQueueById;
exports.createParentQueue = createParentQueue;
exports.updateParentQueue = updateParentQueue;
exports.deleteParentQueue = deleteParentQueue;
const pool_1 = require("../db/pool");
async function listParentQueues() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
            SELECT * FROM parent_queues WHERE status = 'active' ORDER BY name ASC
        `);
        return Array.isArray(rows) ? rows : [];
    }
    finally {
        conn.release();
    }
}
async function getParentQueueById(id) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT * FROM parent_queues WHERE id = ?', [id]);
        const result = Array.isArray(rows) ? rows : [];
        return result.length > 0 ? result[0] : null;
    }
    finally {
        conn.release();
    }
}
async function createParentQueue(data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [result] = await conn.execute('INSERT INTO parent_queues (name, description, status) VALUES (?, ?, ?)', [data.name, data.description || null, data.status || 'active']);
        return result.insertId;
    }
    finally {
        conn.release();
    }
}
async function updateParentQueue(id, data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const fields = [];
        const values = [];
        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            fields.push('description = ?');
            values.push(data.description);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            values.push(data.status);
        }
        if (fields.length > 0) {
            fields.push('updated_at = NOW()');
            values.push(id);
            await conn.execute(`UPDATE parent_queues SET ${fields.join(', ')} WHERE id = ?`, values);
        }
    }
    finally {
        conn.release();
    }
}
async function deleteParentQueue(id) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        await conn.execute('DELETE FROM parent_queues WHERE id = ?', [id]);
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=parentQueueService.js.map