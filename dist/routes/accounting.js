"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookkeepingController_1 = require("../controllers/accounting/bookkeepingController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const bookkeepingController = new bookkeepingController_1.BookkeepingController();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
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
exports.default = router;
//# sourceMappingURL=accounting.js.map