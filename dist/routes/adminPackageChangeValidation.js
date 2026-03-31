"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminPackageChangeValidationController_1 = require("../controllers/adminPackageChangeValidationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Route untuk halaman validasi perubahan paket
router.get('/package-change-validation', authMiddleware_1.isAuthenticated, authMiddleware_1.isAdmin, adminPackageChangeValidationController_1.getPackageChangeValidationPage);
// Route untuk memaksa perubahan paket
router.post('/package-change-validation/force', authMiddleware_1.isAuthenticated, authMiddleware_1.isAdmin, adminPackageChangeValidationController_1.forcePackageChange);
// Route untuk mengirim notifikasi pengingat
router.post('/package-change-validation/remind/:customerId', authMiddleware_1.isAuthenticated, authMiddleware_1.isAdmin, adminPackageChangeValidationController_1.sendReminderNotification);
// Route API untuk mendapatkan pelanggan dengan tagihan tertunggak
router.get('/api/pending-customers', authMiddleware_1.isAuthenticated, authMiddleware_1.isAdmin, adminPackageChangeValidationController_1.getPendingCustomers);
exports.default = router;
//# sourceMappingURL=adminPackageChangeValidation.js.map