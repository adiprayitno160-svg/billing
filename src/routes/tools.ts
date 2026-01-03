import { Router } from 'express';
import { MigrationController } from '../controllers/tools/MigrationController';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const authMiddleware = new AuthMiddleware();

// All routes require authentication
router.use(authMiddleware.isAuthenticated);

// Migration routes
router.post('/migrate/postpaid-ppn', MigrationController.runPostpaidPpnMigration);

export default router;
