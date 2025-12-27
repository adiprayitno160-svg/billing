"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const authController = new authController_1.AuthController();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// Login routes
router.get('/login', authMiddleware.redirectIfAuthenticated.bind(authMiddleware), authController.loginForm.bind(authController));
router.post('/login', authController.login.bind(authController));
router.get('/logout', authController.logout.bind(authController));
// Initialize default users
router.get('/init-users', async (req, res) => {
    try {
        await authController.initializeDefaultUsers();
        res.json({ success: true, message: 'Default users initialized' });
    }
    catch (error) {
        console.error('Error initializing users:', error);
        res.status(500).json({ success: false, message: 'Failed to initialize users' });
    }
});
// Reset kasir user (delete and recreate)
router.get('/reset-kasir', async (req, res) => {
    try {
        await authController.resetKasirUser();
        res.json({ success: true, message: 'Kasir user reset successfully. Username: kasir, Password: kasir' });
    }
    catch (error) {
        console.error('Error resetting kasir user:', error);
        res.status(500).json({ success: false, message: 'Failed to reset kasir user' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map