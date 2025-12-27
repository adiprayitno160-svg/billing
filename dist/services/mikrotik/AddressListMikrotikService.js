"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressListMikrotikService = void 0;
const MikrotikService_1 = require("./MikrotikService");
const addressListService_1 = require("../addressListService");
class AddressListMikrotikService {
    static async getMikrotikConnection() {
        const mikrotikService = new MikrotikService_1.MikrotikService();
        await mikrotikService.connect();
        return mikrotikService;
    }
    // Sync address list to MikroTik
    static async syncAddressListToMikrotik(addressListId) {
        try {
            const addressList = await addressListService_1.AddressListService.getAddressListWithItems(addressListId);
            if (!addressList) {
                throw new Error('Address list not found');
            }
            const mikrotik = await this.getMikrotikConnection();
            // Get existing address list from MikroTik
            const existingAddresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=.id,list,address,comment,disabled',
                '?list=' + addressList.name
            ]);
            // Delete existing addresses for this list
            for (const existing of existingAddresses) {
                await mikrotik.getConnection().write('/ip/firewall/address-list/remove', [
                    '=.id=' + existing['.id']
                ]);
            }
            // Add new addresses
            for (const item of addressList.items) {
                if (!item.disabled) {
                    await mikrotik.getConnection().write('/ip/firewall/address-list/add', [
                        '=list=' + addressList.name,
                        '=address=' + item.address,
                        '=comment=' + (item.comment || ''),
                        '=disabled=' + (item.disabled ? 'yes' : 'no')
                    ]);
                }
            }
            await mikrotik.disconnect();
            return true;
        }
        catch (error) {
            console.error('Error syncing address list to MikroTik:', error);
            return false;
        }
    }
    // Get address list from MikroTik
    static async getAddressListFromMikrotik(listName) {
        try {
            const mikrotik = await this.getMikrotikConnection();
            const addresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=.id,list,address,comment,disabled',
                '?list=' + listName
            ]);
            await mikrotik.disconnect();
            return addresses;
        }
        catch (error) {
            console.error('Error getting address list from MikroTik:', error);
            return [];
        }
    }
    // Sync all address lists to MikroTik
    static async syncAllAddressListsToMikrotik() {
        const addressLists = await addressListService_1.AddressListService.getAllAddressLists();
        let success = 0;
        let failed = 0;
        for (const addressList of addressLists) {
            if (addressList.status === 'active') {
                const result = await this.syncAddressListToMikrotik(addressList.id);
                if (result) {
                    success++;
                }
                else {
                    failed++;
                }
            }
        }
        return { success, failed };
    }
    // Remove address list from MikroTik
    static async removeAddressListFromMikrotik(listName) {
        try {
            const mikrotik = await this.getMikrotikConnection();
            // Get all addresses for this list
            const addresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=.id',
                '?list=' + listName
            ]);
            // Remove all addresses
            for (const address of addresses) {
                await mikrotik.getConnection().write('/ip/firewall/address-list/remove', [
                    '=.id=' + address['.id']
                ]);
            }
            await mikrotik.disconnect();
            return true;
        }
        catch (error) {
            console.error('Error removing address list from MikroTik:', error);
            return false;
        }
    }
    // Add single address to MikroTik
    static async addAddressToMikrotik(listName, address, comment) {
        try {
            const mikrotik = await this.getMikrotikConnection();
            await mikrotik.getConnection().write('/ip/firewall/address-list/add', [
                '=list=' + listName,
                '=address=' + address,
                '=comment=' + (comment || ''),
                '=disabled=no'
            ]);
            await mikrotik.disconnect();
            return true;
        }
        catch (error) {
            console.error('Error adding address to MikroTik:', error);
            return false;
        }
    }
    // Remove single address from MikroTik
    static async removeAddressFromMikrotik(listName, address) {
        try {
            const mikrotik = await this.getMikrotikConnection();
            // Find the address
            const addresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=.id',
                '?list=' + listName,
                '?address=' + address
            ]);
            // Remove if found
            if (addresses.length > 0) {
                await mikrotik.getConnection().write('/ip/firewall/address-list/remove', [
                    '=.id=' + addresses[0]['.id']
                ]);
            }
            await mikrotik.disconnect();
            return true;
        }
        catch (error) {
            console.error('Error removing address from MikroTik:', error);
            return false;
        }
    }
    // Update address in MikroTik
    static async updateAddressInMikrotik(listName, oldAddress, newAddress, comment, disabled) {
        try {
            const mikrotik = await this.getMikrotikConnection();
            // Find the address
            const addresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=.id',
                '?list=' + listName,
                '?address=' + oldAddress
            ]);
            // Update if found
            if (addresses.length > 0) {
                await mikrotik.getConnection().write('/ip/firewall/address-list/set', [
                    '=.id=' + addresses[0]['.id'],
                    '=address=' + newAddress,
                    '=comment=' + (comment || ''),
                    '=disabled=' + (disabled ? 'yes' : 'no')
                ]);
            }
            await mikrotik.disconnect();
            return true;
        }
        catch (error) {
            console.error('Error updating address in MikroTik:', error);
            return false;
        }
    }
    // Get all address lists from MikroTik
    static async getAllAddressListsFromMikrotik() {
        try {
            const mikrotik = await this.getMikrotikConnection();
            const addresses = await mikrotik.getConnection().write('/ip/firewall/address-list/print', [
                '=.proplist=list'
            ]);
            // Get unique list names
            const uniqueLists = [...new Set(addresses.map((addr) => addr.list))];
            await mikrotik.disconnect();
            return uniqueLists;
        }
        catch (error) {
            console.error('Error getting all address lists from MikroTik:', error);
            return [];
        }
    }
}
exports.AddressListMikrotikService = AddressListMikrotikService;
//# sourceMappingURL=AddressListMikrotikService.js.map