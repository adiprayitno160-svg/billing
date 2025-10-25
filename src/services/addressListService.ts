import { databasePool } from '../db/pool';

export interface AddressList {
	id: number;
	name: string;
	description?: string;
	status: 'active' | 'inactive';
	created_at: Date;
	updated_at: Date;
}

export interface AddressListItem {
	id: number;
	address_list_id: number;
	address: string;
	comment?: string;
	disabled: boolean;
	created_at: Date;
	updated_at: Date;
}

export interface CreateAddressListData {
	name: string;
	description?: string;
	status?: 'active' | 'inactive';
}

export interface UpdateAddressListData {
	name?: string;
	description?: string;
	status?: 'active' | 'inactive';
}

export interface CreateAddressListItemData {
	address_list_id: number;
	address: string;
	comment?: string;
	disabled?: boolean;
}

export interface UpdateAddressListItemData {
	address?: string;
	comment?: string;
	disabled?: boolean;
}

export class AddressListService {
	// Address List CRUD operations
	static async getAllAddressLists(): Promise<AddressList[]> {
		const [rows] = await databasePool.execute(
			'SELECT * FROM address_lists ORDER BY created_at DESC'
		);
		return rows as AddressList[];
	}

	static async getAddressListById(id: number): Promise<AddressList | null> {
		const [rows] = await databasePool.execute(
			'SELECT * FROM address_lists WHERE id = ?',
			[id]
		);
		const result = rows as AddressList[];
		return result.length > 0 ? result[0] : null as AddressList | null;
	}

	static async getAddressListByName(name: string): Promise<AddressList | null> {
		const [rows] = await databasePool.execute(
			'SELECT * FROM address_lists WHERE name = ?',
			[name]
		);
		const result = rows as AddressList[];
		return result.length > 0 ? result[0] : null as AddressList | null;
	}

	static async createAddressList(data: CreateAddressListData): Promise<AddressList> {
		const [result] = await databasePool.execute(
			'INSERT INTO address_lists (name, description, status) VALUES (?, ?, ?)',
			[data.name, data.description || null, data.status || 'active']
		);
		const insertResult = result as any;
		const created = await this.getAddressListById(insertResult.insertId);
		if (!created) throw new Error('Failed to create address list');
		return created;
	}

	static async updateAddressList(id: number, data: UpdateAddressListData): Promise<AddressList | null> {
		const updateFields: string[] = [];
		const values: any[] = [];

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
		await databasePool.execute(
			`UPDATE address_lists SET ${updateFields.join(', ')} WHERE id = ?`,
			values
		);

		return this.getAddressListById(id);
	}

	static async deleteAddressList(id: number): Promise<boolean> {
		const [result] = await databasePool.execute(
			'DELETE FROM address_lists WHERE id = ?',
			[id]
		);
		const deleteResult = result as any;
		return deleteResult.affectedRows > 0;
	}

	// Address List Items CRUD operations
	static async getAddressListItems(addressListId: number): Promise<AddressListItem[]> {
		const [rows] = await databasePool.execute(
			'SELECT * FROM address_list_items WHERE address_list_id = ? ORDER BY created_at DESC',
			[addressListId]
		);
		return rows as AddressListItem[];
	}

	static async getAddressListItemById(id: number): Promise<AddressListItem | null> {
		const [rows] = await databasePool.execute(
			'SELECT * FROM address_list_items WHERE id = ?',
			[id]
		);
		const result = rows as AddressListItem[];
		return result.length > 0 ? result[0] : null as AddressList | null;
	}

	static async createAddressListItem(data: CreateAddressListItemData): Promise<AddressListItem> {
		const [result] = await databasePool.execute(
			'INSERT INTO address_list_items (address_list_id, address, comment, disabled) VALUES (?, ?, ?, ?)',
			[data.address_list_id, data.address, data.comment || null, data.disabled || false]
		);
		const insertResult = result as any;
		const created = await this.getAddressListItemById(insertResult.insertId);
		if (!created) throw new Error('Failed to create address list item');
		return created;
	}

	static async updateAddressListItem(id: number, data: UpdateAddressListItemData): Promise<AddressListItem | null> {
		const updateFields: string[] = [];
		const values: any[] = [];

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
		await databasePool.execute(
			`UPDATE address_list_items SET ${updateFields.join(', ')} WHERE id = ?`,
			values
		);

		return this.getAddressListItemById(id);
	}

	static async deleteAddressListItem(id: number): Promise<boolean> {
		const [result] = await databasePool.execute(
			'DELETE FROM address_list_items WHERE id = ?',
			[id]
		);
		const deleteResult = result as any;
		return deleteResult.affectedRows > 0;
	}

	// Bulk operations
	static async createAddressListItems(addressListId: number, addresses: string[]): Promise<AddressListItem[]> {
		const items: AddressListItem[] = [];
		
		for (const address of addresses) {
			try {
				const item = await this.createAddressListItem({
					address_list_id: addressListId,
					address: address.trim()
				});
				items.push(item);
			} catch (error) {
				// Skip duplicate addresses
				console.log(`Skipping duplicate address: ${address}`);
			}
		}
		
		return items;
	}

	static async deleteAllAddressListItems(addressListId: number): Promise<boolean> {
		const [result] = await databasePool.execute(
			'DELETE FROM address_list_items WHERE address_list_id = ?',
			[addressListId]
		);
		const deleteResult = result as any;
		return deleteResult.affectedRows >= 0;
	}

	// Get address list with items
	static async getAddressListWithItems(id: number): Promise<(AddressList & { items: AddressListItem[] }) | null> {
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
	static async getAllAddressListsWithCounts(): Promise<(AddressList & { item_count: number })[]> {
		const [rows] = await databasePool.execute(`
			SELECT al.*, COUNT(ali.id) as item_count
			FROM address_lists al
			LEFT JOIN address_list_items ali ON al.id = ali.address_list_id
			GROUP BY al.id
			ORDER BY al.created_at DESC
		`);
		return rows as (AddressList & { item_count: number })[];
	}
}
