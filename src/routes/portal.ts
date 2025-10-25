import { Router } from 'express';
import { PortalController } from '../controllers/portal/PortalController';

const router = Router();
const portalController = new PortalController();

// Portal routes
router.get('/login', portalController.getPortalLogin.bind(portalController));
router.post('/login', portalController.postPortalLogin.bind(portalController));
router.get('/packages', portalController.getPortalPackages.bind(portalController));
router.post('/packages', portalController.postPurchasePackage.bind(portalController));
router.get('/profile', portalController.getPortalProfile.bind(portalController));
router.post('/logout', portalController.postPortalLogout.bind(portalController));

export default router;
