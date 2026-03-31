import { MikrotikService } from './MikrotikService';
import { AddressListService } from '../addressListService';
import { getMikrotikConfig } from '../pppoeService';
import { RouterOSAPI } from 'routeros-api';

export interface MikrotikAddressList {
	'.id': string;
	list: string;
	address: string;
	comment?: string;
	disabled: string;
}

export class AddressListMikrotikService {
	private static async executeWithConnection<T>(
		operation: (api: RouterOSAPI) => Promise<T>
	): Promise<T> {
		const config = await getMikrotikConfig();
		if (!config) {
			throw new Error('MikroTik configuration not found');
		}

		const api = new RouterOSAPI({
			host: config.host,
			port: config.port || 8728,
			user: config.username,
			password: config.password,
			timeout: 10000
		});

		try {
			await api.connect();
			return await operation(api);
		} finally {
			api.close();
		}
	}

	// Sync address list to MikroTik
	static async syncAddressListToMikrotik(addressListId: number): Promise<boolean> {
		try {
			const addressList = await AddressListService.getAddressListWithItems(addressListId);
			if (!addressList) {
				throw new Error('Address list not found');
			}

			return await this.executeWithConnection(async (api) => {
				// Get existing address list from MikroTik
				const existingAddresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=.id,list,address,comment,disabled',
					'?list=' + addressList.name
				]);

				// Delete existing addresses for this list
				for (const existing of existingAddresses) {
					await api.write('/ip/firewall/address-list/remove', [
						'=.id=' + existing['.id']
					]);
				}

				// Add new addresses
				for (const item of addressList.items) {
					if (!item.disabled) {
						await api.write('/ip/firewall/address-list/add', [
							'=list=' + addressList.name,
							'=address=' + item.address,
							'=comment=' + (item.comment || ''),
							'=disabled=' + (item.disabled ? 'yes' : 'no')
						]);
					}
				}

				return true;
			});
		} catch (error) {
			console.error('Error syncing address list to MikroTik:', error);
			return false;
		}
	}

	// Get address list from MikroTik
	static async getAddressListFromMikrotik(listName: string): Promise<MikrotikAddressList[]> {
		try {
			return await this.executeWithConnection(async (api) => {
				const addresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=.id,list,address,comment,disabled',
					'?list=' + listName
				]);
				return addresses as MikrotikAddressList[];
			});
		} catch (error) {
			console.error('Error getting address list from MikroTik:', error);
			return [];
		}
	}

	// Sync all address lists to MikroTik
	static async syncAllAddressListsToMikrotik(): Promise<{ success: number; failed: number }> {
		const addressLists = await AddressListService.getAllAddressLists();
		let success = 0;
		let failed = 0;

		for (const addressList of addressLists) {
			if (addressList.status === 'active') {
				const result = await this.syncAddressListToMikrotik(addressList.id);
				if (result) {
					success++;
				} else {
					failed++;
				}
			}
		}

		return { success, failed };
	}

	// Remove address list from MikroTik
	static async removeAddressListFromMikrotik(listName: string): Promise<boolean> {
		try {
			return await this.executeWithConnection(async (api) => {
				// Get all addresses for this list
				const addresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=.id',
					'?list=' + listName
				]);

				// Remove all addresses
				for (const address of addresses) {
					await api.write('/ip/firewall/address-list/remove', [
						'=.id=' + address['.id']
					]);
				}

				return true;
			});
		} catch (error) {
			console.error('Error removing address list from MikroTik:', error);
			return false;
		}
	}

	// Add single address to MikroTik
	static async addAddressToMikrotik(listName: string, address: string, comment?: string): Promise<boolean> {
		try {
			return await this.executeWithConnection(async (api) => {
				await api.write('/ip/firewall/address-list/add', [
					'=list=' + listName,
					'=address=' + address,
					'=comment=' + (comment || ''),
					'=disabled=no'
				]);
				return true;
			});
		} catch (error) {
			console.error('Error adding address to MikroTik:', error);
			return false;
		}
	}

	// Remove single address from MikroTik
	static async removeAddressFromMikrotik(listName: string, address: string): Promise<boolean> {
		try {
			return await this.executeWithConnection(async (api) => {
				// Find the address
				const addresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=.id',
					'?list=' + listName,
					'?address=' + address
				]);

				// Remove if found
				if (addresses.length > 0) {
					await api.write('/ip/firewall/address-list/remove', [
						'=.id=' + addresses[0]['.id']
					]);
				}

				return true;
			});
		} catch (error) {
			console.error('Error removing address from MikroTik:', error);
			return false;
		}
	}

	// Update address in MikroTik
	static async updateAddressInMikrotik(listName: string, oldAddress: string, newAddress: string, comment?: string, disabled?: boolean): Promise<boolean> {
		try {
			return await this.executeWithConnection(async (api) => {
				// Find the address
				const addresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=.id',
					'?list=' + listName,
					'?address=' + oldAddress
				]);

				// Update if found
				if (addresses.length > 0) {
					await api.write('/ip/firewall/address-list/set', [
						'=.id=' + addresses[0]['.id'],
						'=address=' + newAddress,
						'=comment=' + (comment || ''),
						'=disabled=' + (disabled ? 'yes' : 'no')
					]);
				}

				return true;
			});
		} catch (error) {
			console.error('Error updating address in MikroTik:', error);
			return false;
		}
	}

	// Get all address lists from MikroTik
	static async getAllAddressListsFromMikrotik(): Promise<string[]> {
		try {
			return await this.executeWithConnection(async (api) => {
				const addresses = await api.write('/ip/firewall/address-list/print', [
					'=.proplist=list'
				]);

				// Get unique list names
				const uniqueLists = [...new Set(addresses.map((addr: any) => addr.list))];
				return uniqueLists;
			});
		} catch (error) {
			console.error('Error getting all address lists from MikroTik:', error);
			return [];
		}
	}
}


