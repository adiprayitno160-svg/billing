"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const addressListController_1 = require("../controllers/addressListController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
const auth = new authMiddleware_1.AuthMiddleware();
router.use(auth.requireAuth);
// Address List CRUD routes
router.get('/', addressListController_1.AddressListController.getAllAddressLists);
router.get('/:id', addressListController_1.AddressListController.getAddressListById);
router.post('/', addressListController_1.AddressListController.createAddressList);
router.put('/:id', addressListController_1.AddressListController.updateAddressList);
router.delete('/:id', addressListController_1.AddressListController.deleteAddressList);
// Address List Items routes
router.get('/:id/items', addressListController_1.AddressListController.getAddressListItems);
router.post('/:id/items', addressListController_1.AddressListController.createAddressListItem);
router.put('/:id/items/:itemId', addressListController_1.AddressListController.updateAddressListItem);
router.delete('/:id/items/:itemId', addressListController_1.AddressListController.deleteAddressListItem);
// Bulk operations
router.post('/:id/items/bulk', addressListController_1.AddressListController.createBulkAddressListItems);
// MikroTik sync routes
router.post('/:id/sync', addressListController_1.AddressListController.syncAddressListToMikrotik);
router.post('/sync/all', addressListController_1.AddressListController.syncAllAddressListsToMikrotik);
router.get('/mikrotik/:listName', addressListController_1.AddressListController.getAddressListFromMikrotik);
exports.default = router;
//# sourceMappingURL=addressList.js.map