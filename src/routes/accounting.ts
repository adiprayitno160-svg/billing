import { Router } from 'express';
import { BookkeepingController } from '../controllers/accounting/bookkeepingController';
import { AuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const bookkeepingController = new BookkeepingController();
const authMiddleware = new AuthMiddleware();

console.log('[ACCOUNTING ROUTES] Registering accounting routes...');

// Test route to verify routing works (no auth for testing)
router.get('/test', (req, res) => {
    console.log('[ACCOUNTING ROUTES] Test route hit!');
    res.send('Accounting routes working! Path: ' + req.path);
});

// Main bookkeeping route
router.get('/bookkeeping', authMiddleware.requireAuth, bookkeepingController.index.bind(bookkeepingController));
console.log('[ACCOUNTING ROUTES] Registered /bookkeeping route');
router.get('/bookkeeping/export/unpaid', authMiddleware.requireAuth, bookkeepingController.exportUnpaidPDF.bind(bookkeepingController));
router.get('/bookkeeping/export/paid', authMiddleware.requireAuth, bookkeepingController.exportPaidPDF.bind(bookkeepingController));
router.get('/bookkeeping/print/unpaid', authMiddleware.requireAuth, bookkeepingController.printUnpaid.bind(bookkeepingController));
router.get('/bookkeeping/print/paid', authMiddleware.requireAuth, bookkeepingController.printPaid.bind(bookkeepingController));

export default router;

