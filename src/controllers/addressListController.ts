import { Request, Response } from 'express';
import { AddressListService } from '../services/addressListService';
import { AddressListMikrotikService } from '../services/mikrotik/AddressListMikrotikService';

export class AddressListController {
	// Address List CRUD operations
	static async getAllAddressLists(req: Request, res: Response) {
		try {
			const addressLists = await AddressListService.getAllAddressListsWithCounts();
			res.json({
				success: true,
				data: addressLists
			});
		} catch (error) {
			console.error('Error getting address lists:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal mengambil daftar address list'
			});
		}
	}

	static async getAddressListById(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const addressList = await AddressListService.getAddressListWithItems(parseInt(id));
			
			if (!addressList) {
				return res.status(404).json({
					success: false,
					message: 'Address list tidak ditemukan'
				});
			}

			res.json({
				success: true,
				data: addressList
			});
		} catch (error) {
			console.error('Error getting address list:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal mengambil address list'
			});
		}
	}

	static async createAddressList(req: Request, res: Response) {
		try {
			const { name, description, status } = req.body;

			if (!name) {
				return res.status(400).json({
					success: false,
					message: 'Nama address list harus diisi'
				});
			}

			// Check if name already exists
			const existingList = await AddressListService.getAddressListByName(name);
			if (existingList) {
				return res.status(400).json({
					success: false,
					message: 'Nama address list sudah ada'
				});
			}

			const addressList = await AddressListService.createAddressList({
				name,
				description,
				status: status || 'active'
			});

			res.status(201).json({
				success: true,
				data: addressList,
				message: 'Address list berhasil dibuat'
			});
		} catch (error) {
			console.error('Error creating address list:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal membuat address list'
			});
		}
	}

	static async updateAddressList(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const { name, description, status } = req.body;

			// Check if name already exists (if name is being changed)
			if (name) {
				const existingList = await AddressListService.getAddressListByName(name);
				if (existingList && existingList.id !== parseInt(id)) {
					return res.status(400).json({
						success: false,
						message: 'Nama address list sudah ada'
					});
				}
			}

			const addressList = await AddressListService.updateAddressList(parseInt(id), {
				name,
				description,
				status
			});

			if (!addressList) {
				return res.status(404).json({
					success: false,
					message: 'Address list tidak ditemukan'
				});
			}

			res.json({
				success: true,
				data: addressList,
				message: 'Address list berhasil diperbarui'
			});
		} catch (error) {
			console.error('Error updating address list:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal memperbarui address list'
			});
		}
	}

	static async deleteAddressList(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const addressList = await AddressListService.getAddressListById(parseInt(id));
			
			if (!addressList) {
				return res.status(404).json({
					success: false,
					message: 'Address list tidak ditemukan'
				});
			}

			// Remove from MikroTik first
			await AddressListMikrotikService.removeAddressListFromMikrotik(addressList.name);

			const deleted = await AddressListService.deleteAddressList(parseInt(id));
			
			if (!deleted) {
				return res.status(500).json({
					success: false,
					message: 'Gagal menghapus address list'
				});
			}

			res.json({
				success: true,
				message: 'Address list berhasil dihapus'
			});
		} catch (error) {
			console.error('Error deleting address list:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menghapus address list'
			});
		}
	}

	// Address List Items operations
	static async getAddressListItems(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const items = await AddressListService.getAddressListItems(parseInt(id));
			
			res.json({
				success: true,
				data: items
			});
		} catch (error) {
			console.error('Error getting address list items:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal mengambil daftar alamat'
			});
		}
	}

	static async createAddressListItem(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const { address, comment, disabled } = req.body;

			if (!address) {
				return res.status(400).json({
					success: false,
					message: 'Alamat harus diisi'
				});
			}

			const item = await AddressListService.createAddressListItem({
				address_list_id: parseInt(id),
				address,
				comment,
				disabled: disabled || false
			});

			// Sync to MikroTik
			const addressList = await AddressListService.getAddressListById(parseInt(id));
			if (addressList) {
				await AddressListMikrotikService.addAddressToMikrotik(addressList.name, address, comment);
			}

			res.status(201).json({
				success: true,
				data: item,
				message: 'Alamat berhasil ditambahkan'
			});
		} catch (error) {
			console.error('Error creating address list item:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menambahkan alamat'
			});
		}
	}

	static async updateAddressListItem(req: Request, res: Response) {
		try {
			const { id, itemId } = req.params;
			const { address, comment, disabled } = req.body;

			const existingItem = await AddressListService.getAddressListItemById(parseInt(itemId));
			if (!existingItem) {
				return res.status(404).json({
					success: false,
					message: 'Item tidak ditemukan'
				});
			}

			const item = await AddressListService.updateAddressListItem(parseInt(itemId), {
				address,
				comment,
				disabled
			});

			// Sync to MikroTik
			const addressList = await AddressListService.getAddressListById(parseInt(id));
			if (addressList && address) {
				await AddressListMikrotikService.updateAddressInMikrotik(
					addressList.name,
					existingItem.address,
					address,
					comment,
					disabled
				);
			}

			res.json({
				success: true,
				data: item,
				message: 'Alamat berhasil diperbarui'
			});
		} catch (error) {
			console.error('Error updating address list item:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal memperbarui alamat'
			});
		}
	}

	static async deleteAddressListItem(req: Request, res: Response) {
		try {
			const { id, itemId } = req.params;

			const item = await AddressListService.getAddressListItemById(parseInt(itemId));
			if (!item) {
				return res.status(404).json({
					success: false,
					message: 'Item tidak ditemukan'
				});
			}

			// Remove from MikroTik first
			const addressList = await AddressListService.getAddressListById(parseInt(id));
			if (addressList) {
				await AddressListMikrotikService.removeAddressFromMikrotik(addressList.name, item.address);
			}

			const deleted = await AddressListService.deleteAddressListItem(parseInt(itemId));
			
			if (!deleted) {
				return res.status(500).json({
					success: false,
					message: 'Gagal menghapus alamat'
				});
			}

			res.json({
				success: true,
				message: 'Alamat berhasil dihapus'
			});
		} catch (error) {
			console.error('Error deleting address list item:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menghapus alamat'
			});
		}
	}

	// Bulk operations
	static async createBulkAddressListItems(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const { addresses } = req.body;

			if (!addresses || !Array.isArray(addresses)) {
				return res.status(400).json({
					success: false,
					message: 'Daftar alamat harus berupa array'
				});
			}

			const items = await AddressListService.createAddressListItems(parseInt(id), addresses);

			// Sync to MikroTik
			const addressList = await AddressListService.getAddressListById(parseInt(id));
			if (addressList) {
				await AddressListMikrotikService.syncAddressListToMikrotik(parseInt(id));
			}

			res.status(201).json({
				success: true,
				data: items,
				message: `${items.length} alamat berhasil ditambahkan`
			});
		} catch (error) {
			console.error('Error creating bulk address list items:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menambahkan alamat dalam jumlah besar'
			});
		}
	}

	// MikroTik sync operations
	static async syncAddressListToMikrotik(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const result = await AddressListMikrotikService.syncAddressListToMikrotik(parseInt(id));

			if (result) {
				res.json({
					success: true,
					message: 'Address list berhasil disinkronkan ke MikroTik'
				});
			} else {
				res.status(500).json({
					success: false,
					message: 'Gagal menyinkronkan address list ke MikroTik'
				});
			}
		} catch (error) {
			console.error('Error syncing address list to MikroTik:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menyinkronkan address list ke MikroTik'
			});
		}
	}

	static async syncAllAddressListsToMikrotik(req: Request, res: Response) {
		try {
			const result = await AddressListMikrotikService.syncAllAddressListsToMikrotik();

			res.json({
				success: true,
				data: result,
				message: `Sinkronisasi selesai: ${result.success} berhasil, ${result.failed} gagal`
			});
		} catch (error) {
			console.error('Error syncing all address lists to MikroTik:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menyinkronkan semua address list ke MikroTik'
			});
		}
	}

	static async getAddressListFromMikrotik(req: Request, res: Response) {
		try {
			const { listName } = req.params;
			const addresses = await AddressListMikrotikService.getAddressListFromMikrotik(listName);

			res.json({
				success: true,
				data: addresses
			});
		} catch (error) {
			console.error('Error getting address list from MikroTik:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal mengambil address list dari MikroTik'
			});
		}
	}
}


