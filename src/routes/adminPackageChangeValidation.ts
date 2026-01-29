import { Router } from 'express';
import { getPackageChangeValidationPage, forcePackageChange, sendReminderNotification, getPendingCustomers } from '../controllers/adminPackageChangeValidationController';
import { isAuthenticated, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Route untuk halaman validasi perubahan paket
router.get('/package-change-validation', isAuthenticated, isAdmin, getPackageChangeValidationPage);

// Route untuk memaksa perubahan paket
router.post('/package-change-validation/force', isAuthenticated, isAdmin, forcePackageChange);

// Route untuk mengirim notifikasi pengingat
router.post('/package-change-validation/remind/:customerId', isAuthenticated, isAdmin, sendReminderNotification);

// Route API untuk mendapatkan pelanggan dengan tagihan tertunggak
router.get('/api/pending-customers', isAuthenticated, isAdmin, getPendingCustomers);

export default router;