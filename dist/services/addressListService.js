"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressListService = void 0;
const pool_1 = require("../db/pool");
class AddressListService {
    // Address List CRUD operations
    static async getAllAddressLists() {
        const [rows] = await pool_1.databasePool.execute('SELECT * FROM address_lists ORDER BY created_at DESC');
        return rows;
    }
    static async getAddressListById(id) {
        const [rows] = await pool_1.databasePool.execute('SELECT * FROM address_lists WHERE id = ?', [id]);
        const result = rows;
        return result.length > 0 ? result[0] : null;
    }
    static async getAddressListByName(name) {
        const [rows] = await pool_1.databasePool.execute('SELECT * FROM address_lists WHERE name = ?', [name]);
        const result = rows;
        return result.length > 0 ? result[0] : null;
    }
    static async createAddressList(data) {
        const [result] = await pool_1.databasePool.execute('INSERT INTO address_lists (name, description, status) VALUES (?, ?, ?)', [data.name, data.description || null, data.status || 'active']);
        const insertResult = result;
        const created = await this.getAddressListById(insertResult.insertId);
        if (!created)
            throw new Error('Failed to create address list');
        return created;
    }
    static async updateAddressList(id, data) {
        const updateFields = [];
        const values = [];
        if (data.name !== undefined) {
            updateFields.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updateFields.push('description = ?');
            values.push(data.description);
        }
        if (data.status !== undefined) {
            updateFields.push('status = ?');
            values.push(data.status);
        }
        if (updateFields.length === 0) {
            return this.getAddressListById(id);
        }
        values.push(id);
        await pool_1.databasePool.execute(`UPDATE address_lists SET ${updateFields.join(', ')} WHERE id = ?`, values);
        return this.getAddressListById(id);
    }
    static async deleteAddressList(id) {
        const [result] = await pool_1.databasePool.execute('DELETE FROM address_lists WHERE id = ?', [id]);
        const deleteResult = result;
        return deleteResult.affectedRows > 0;
    }
    // Address List Items CRUD operations
    static async getAddressListItems(addressListId) {
        const [rows] = await pool_1.databasePool.execute('SELECT * FROM address_list_items WHERE address_list_id = ? ORDER BY created_at DESC', [addressListId]);
        return rows;
    }
    static async getAddressListItemById(id) {
        const [rows] = await pool_1.databasePool.execute('SELECT * FROM address_list_items WHERE id = ?', [id]);
        const result = rows;
        return result.length > 0 ? result[0] : null;
    }
    static async createAddressListItem(data) {
        const [result] = await pool_1.databasePool.execute('INSERT INTO address_list_items (address_list_id, address, comment, disabled) VALUES (?, ?, ?, ?)', [data.address_list_id, data.address, data.comment || null, data.disabled || false]);
        const insertResult = result;
        const created = await this.getAddressListItemById(insertResult.insertId);
        if (!created)
            throw new Error('Failed to create address list item');
        return created;
    }
    static async updateAddressListItem(id, data) {
        const updateFields = [];
        const values = [];
        if (data.address !== undefined) {
            updateFields.push('address = ?');
            values.push(data.address);
        }
        if (data.comment !== undefined) {
            updateFields.push('comment = ?');
            values.push(data.comment);
        }
        if (data.disabled !== undefined) {
            updateFields.push('disabled = ?');
            values.push(data.disabled);
        }
        if (updateFields.length === 0) {
            return this.getAddressListItemById(id);
        }
        values.push(id);
        await pool_1.databasePool.execute(`UPDATE address_list_items SET ${updateFields.join(', ')} WHERE id = ?`, values);
        return this.getAddressListItemById(id);
    }
    static async deleteAddressListItem(id) {
        const [result] = await pool_1.databasePool.execute('DELETE FROM address_list_items WHERE id = ?', [id]);
        const deleteResult = result;
        return deleteResult.affectedRows > 0;
    }
    // Bulk operations
    static async createAddressListItems(addressListId, addresses) {
        const items = [];
        for (const address of addresses) {
            try {
                const item = await this.createAddressListItem({
                    address_list_id: addressListId,
                    address: address.trim()
                });
                items.push(item);
            }
            catch (error) {
                // Skip duplicate addresses
                console.log(`Skipping duplicate address: ${address}`);
            }
        }
        return items;
    }
    static async deleteAllAddressListItems(addressListId) {
        const [result] = await pool_1.databasePool.execute('DELETE FROM address_list_items WHERE address_list_id = ?', [addressListId]);
        const deleteResult = result;
        return deleteResult.affectedRows >= 0;
    }
    // Get address list with items
    static async getAddressListWithItems(id) {
        const addressList = await this.getAddressListById(id);
        if (!addressList) {
            return null;
        }
        const items = await this.getAddressListItems(id);
        return {
            ...addressList,
            items
        };
    }
    // Get all address lists with item counts
    static async getAllAddressListsWithCounts() {
        const [rows] = await pool_1.databasePool.execute(`
			SELECT al.*, COUNT(ali.id) as item_count
			FROM address_lists al
			LEFT JOIN address_list_items ali ON al.id = ali.address_list_id
			GROUP BY al.id
			ORDER BY al.created_at DESC
		`);
        return rows;
    }
}
exports.AddressListService = AddressListService;
//# sourceMappingURL=addressListService.js.map