"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressListController = void 0;
const addressListService_1 = require("../services/addressListService");
const AddressListMikrotikService_1 = require("../services/mikrotik/AddressListMikrotikService");
class AddressListController {
    // Address List CRUD operations
    static async getAllAddressLists(req, res) {
        try {
            const addressLists = await addressListService_1.AddressListService.getAllAddressListsWithCounts();
            res.json({
                success: true,
                data: addressLists
            });
        }
        catch (error) {
            console.error('Error getting address lists:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil daftar address list'
            });
        }
    }
    static async getAddressListById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const addressList = await addressListService_1.AddressListService.getAddressListWithItems(parseInt(id));
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
        }
        catch (error) {
            console.error('Error getting address list:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil address list'
            });
        }
    }
    static async createAddressList(req, res) {
        try {
            const { name, description, status } = req.body;
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Nama address list harus diisi'
                });
            }
            // Check if name already exists
            const existingList = await addressListService_1.AddressListService.getAddressListByName(name);
            if (existingList) {
                return res.status(400).json({
                    success: false,
                    message: 'Nama address list sudah ada'
                });
            }
            const addressList = await addressListService_1.AddressListService.createAddressList({
                name,
                description,
                status: status || 'active'
            });
            res.status(201).json({
                success: true,
                data: addressList,
                message: 'Address list berhasil dibuat'
            });
        }
        catch (error) {
            console.error('Error creating address list:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal membuat address list'
            });
        }
    }
    static async updateAddressList(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const { name, description, status } = req.body;
            // Check if name already exists (if name is being changed)
            if (name) {
                const existingList = await addressListService_1.AddressListService.getAddressListByName(name);
                if (existingList && existingList.id !== parseInt(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Nama address list sudah ada'
                    });
                }
            }
            const addressList = await addressListService_1.AddressListService.updateAddressList(parseInt(id), {
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
        }
        catch (error) {
            console.error('Error updating address list:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui address list'
            });
        }
    }
    static async deleteAddressList(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const addressList = await addressListService_1.AddressListService.getAddressListById(parseInt(id));
            if (!addressList) {
                return res.status(404).json({
                    success: false,
                    message: 'Address list tidak ditemukan'
                });
            }
            // Remove from MikroTik first
            await AddressListMikrotikService_1.AddressListMikrotikService.removeAddressListFromMikrotik(addressList.name);
            const deleted = await addressListService_1.AddressListService.deleteAddressList(parseInt(id));
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
        }
        catch (error) {
            console.error('Error deleting address list:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus address list'
            });
        }
    }
    // Address List Items operations
    static async getAddressListItems(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const items = await addressListService_1.AddressListService.getAddressListItems(parseInt(id));
            res.json({
                success: true,
                data: items
            });
        }
        catch (error) {
            console.error('Error getting address list items:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil daftar alamat'
            });
        }
    }
    static async createAddressListItem(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const { address, comment, disabled } = req.body;
            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Alamat harus diisi'
                });
            }
            const item = await addressListService_1.AddressListService.createAddressListItem({
                address_list_id: parseInt(id),
                address,
                comment,
                disabled: disabled || false
            });
            // Sync to MikroTik
            const addressList = await addressListService_1.AddressListService.getAddressListById(parseInt(id));
            if (addressList) {
                await AddressListMikrotikService_1.AddressListMikrotikService.addAddressToMikrotik(addressList.name, address, comment);
            }
            res.status(201).json({
                success: true,
                data: item,
                message: 'Alamat berhasil ditambahkan'
            });
        }
        catch (error) {
            console.error('Error creating address list item:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menambahkan alamat'
            });
        }
    }
    static async updateAddressListItem(req, res) {
        try {
            const { id, itemId } = req.params;
            if (!id || !itemId) {
                return res.status(400).json({ success: false, error: 'ID and itemId are required' });
            }
            const { address, comment, disabled } = req.body;
            const existingItem = await addressListService_1.AddressListService.getAddressListItemById(parseInt(itemId));
            if (!existingItem) {
                return res.status(404).json({
                    success: false,
                    message: 'Item tidak ditemukan'
                });
            }
            const item = await addressListService_1.AddressListService.updateAddressListItem(parseInt(itemId), {
                address,
                comment,
                disabled
            });
            // Sync to MikroTik
            const addressList = await addressListService_1.AddressListService.getAddressListById(parseInt(id));
            if (addressList && address) {
                await AddressListMikrotikService_1.AddressListMikrotikService.updateAddressInMikrotik(addressList.name, existingItem.address, address, comment, disabled);
            }
            res.json({
                success: true,
                data: item,
                message: 'Alamat berhasil diperbarui'
            });
        }
        catch (error) {
            console.error('Error updating address list item:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memperbarui alamat'
            });
        }
    }
    static async deleteAddressListItem(req, res) {
        try {
            const { id, itemId } = req.params;
            if (!id || !itemId) {
                return res.status(400).json({ success: false, error: 'ID and itemId are required' });
            }
            const item = await addressListService_1.AddressListService.getAddressListItemById(parseInt(itemId));
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item tidak ditemukan'
                });
            }
            // Remove from MikroTik first
            const addressList = await addressListService_1.AddressListService.getAddressListById(parseInt(id));
            if (addressList) {
                await AddressListMikrotikService_1.AddressListMikrotikService.removeAddressFromMikrotik(addressList.name, item.address);
            }
            const deleted = await addressListService_1.AddressListService.deleteAddressListItem(parseInt(itemId));
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
        }
        catch (error) {
            console.error('Error deleting address list item:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menghapus alamat'
            });
        }
    }
    // Bulk operations
    static async createBulkAddressListItems(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const { addresses } = req.body;
            if (!addresses || !Array.isArray(addresses)) {
                return res.status(400).json({
                    success: false,
                    message: 'Daftar alamat harus berupa array'
                });
            }
            const items = await addressListService_1.AddressListService.createAddressListItems(parseInt(id), addresses);
            // Sync to MikroTik
            const addressList = await addressListService_1.AddressListService.getAddressListById(parseInt(id));
            if (addressList) {
                await AddressListMikrotikService_1.AddressListMikrotikService.syncAddressListToMikrotik(parseInt(id));
            }
            res.status(201).json({
                success: true,
                data: items,
                message: `${items.length} alamat berhasil ditambahkan`
            });
        }
        catch (error) {
            console.error('Error creating bulk address list items:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menambahkan alamat dalam jumlah besar'
            });
        }
    }
    // MikroTik sync operations
    static async syncAddressListToMikrotik(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const result = await AddressListMikrotikService_1.AddressListMikrotikService.syncAddressListToMikrotik(parseInt(id));
            if (result) {
                res.json({
                    success: true,
                    message: 'Address list berhasil disinkronkan ke MikroTik'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Gagal menyinkronkan address list ke MikroTik'
                });
            }
        }
        catch (error) {
            console.error('Error syncing address list to MikroTik:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menyinkronkan address list ke MikroTik'
            });
        }
    }
    static async syncAllAddressListsToMikrotik(req, res) {
        try {
            const result = await AddressListMikrotikService_1.AddressListMikrotikService.syncAllAddressListsToMikrotik();
            res.json({
                success: true,
                data: result,
                message: `Sinkronisasi selesai: ${result.success} berhasil, ${result.failed} gagal`
            });
        }
        catch (error) {
            console.error('Error syncing all address lists to MikroTik:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menyinkronkan semua address list ke MikroTik'
            });
        }
    }
    static async getAddressListFromMikrotik(req, res) {
        try {
            const { listName } = req.params;
            if (!listName || typeof listName !== 'string') {
                return res.status(400).json({ success: false, error: 'listName is required' });
            }
            const addresses = await AddressListMikrotikService_1.AddressListMikrotikService.getAddressListFromMikrotik(listName);
            res.json({
                success: true,
                data: addresses
            });
        }
        catch (error) {
            console.error('Error getting address list from MikroTik:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil address list dari MikroTik'
            });
        }
    }
}
exports.AddressListController = AddressListController;
//# sourceMappingURL=addressListController.js.map