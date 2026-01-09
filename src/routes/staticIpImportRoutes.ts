import { Router } from 'express';
import { StaticIpImportController } from '../controllers/StaticIpImportController';
import { isAuthenticated } from '../middlewares/authMiddleware';

const router = Router();
const controller = new StaticIpImportController();

// Menggunakan middleware auth untuk semua route di sini
router.use(isAuthenticated);

router.get('/settings/static-ip/import', (req, res) => controller.renderPage(req, res));
router.get('/api/static-ip/import/scan', (req, res) => controller.scan(req, res));
router.post('/api/static-ip/import/link', (req, res) => controller.linkCustomer(req, res));

// Rute Baru untuk Import Form (Adopsi)
router.get('/customers/import', (req, res) => controller.renderFormImport(req, res));
router.post('/api/static-ip/import/create-link', (req, res) => controller.createAndLink(req, res));

export default router;
