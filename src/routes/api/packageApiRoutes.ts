import { Router } from 'express';
import { PackageApiController } from '../../controllers/api/PackageApiController';

const router = Router();

// PPPoE specific package detail
router.get('/packages/pppoe/:id', PackageApiController.getPppoePackageDetail);

// List packages by type (pppoe, static_ip)
router.get('/packages/:connectionType', PackageApiController.getPackagesByType);

export default router;
