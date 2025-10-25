import { Router } from 'express';
import { AddressListController } from '../controllers/addressListController';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Apply authentication middleware to all routes
const auth = new AuthMiddleware();
router.use(auth.requireAuth);

// Address List CRUD routes
router.get('/', AddressListController.getAllAddressLists);
router.get('/:id', AddressListController.getAddressListById);
router.post('/', AddressListController.createAddressList);
router.put('/:id', AddressListController.updateAddressList);
router.delete('/:id', AddressListController.deleteAddressList);

// Address List Items routes
router.get('/:id/items', AddressListController.getAddressListItems);
router.post('/:id/items', AddressListController.createAddressListItem);
router.put('/:id/items/:itemId', AddressListController.updateAddressListItem);
router.delete('/:id/items/:itemId', AddressListController.deleteAddressListItem);

// Bulk operations
router.post('/:id/items/bulk', AddressListController.createBulkAddressListItems);

// MikroTik sync routes
router.post('/:id/sync', AddressListController.syncAddressListToMikrotik);
router.post('/sync/all', AddressListController.syncAllAddressListsToMikrotik);
router.get('/mikrotik/:listName', AddressListController.getAddressListFromMikrotik);

export default router;


