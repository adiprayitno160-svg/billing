"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TechnicianController_1 = require("../controllers/technician/TechnicianController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Middleware to ensure user is logged in
// We don't strictly enforce 'technician' role for ALL routes because 
// Admins might want to see the dashboard too, or we can handle role checks in controller.
// But typically, 'technician' dashboard is for technicians.
// For now, let's allow authenticated users and handle data filtering in controller.
router.use((req, res, next) => {
    console.log(`🛠️ [Technician Route] Accessing: ${req.method} ${req.path}`);
    next();
});
router.get('/', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.dashboard);
router.get('/jobs', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.getJobs);
router.post('/jobs/accept', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.acceptJob);
router.post('/jobs/decline', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.declineJob);
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
router.post('/jobs/complete', authMiddleware_1.isAuthenticated, uploadMiddleware_1.technicianUpload.single('proof'), TechnicianController_1.TechnicianController.completeJob);
router.post('/jobs/save', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.apiSaveJob);
router.get('/customers/search', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.apiSearchCustomers);
router.get('/jobs/:id', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.getJobDetail);
router.get('/history', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.getJobHistory);
router.post('/jobs/:id/verify', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.verifyJob);
router.delete('/jobs/:id', authMiddleware_1.isAuthenticated, TechnicianController_1.TechnicianController.deleteJob);
// Installation Approval (Admin/Operator only)
const InstallationApprovalController_1 = require("../controllers/technician/InstallationApprovalController");
router.get('/installations/approval', authMiddleware_1.isAuthenticated, InstallationApprovalController_1.InstallationApprovalController.list);
router.get('/installations/:jobId', authMiddleware_1.isAuthenticated, InstallationApprovalController_1.InstallationApprovalController.getDetail);
router.post('/installations/approve', authMiddleware_1.isAuthenticated, InstallationApprovalController_1.InstallationApprovalController.approve);
router.post('/installations/reject', authMiddleware_1.isAuthenticated, InstallationApprovalController_1.InstallationApprovalController.reject);
// Salary Routes for Technician
const TechnicianSalaryController_1 = require("../controllers/technician/TechnicianSalaryController");
router.get('/salary/my-history', authMiddleware_1.isAuthenticated, TechnicianSalaryController_1.TechnicianSalaryController.viewMySalaryHistory);
router.get('/salary/slip/:id', authMiddleware_1.isAuthenticated, TechnicianSalaryController_1.TechnicianSalaryController.printSalarySlip);
exports.default = router;
//# sourceMappingURL=technician.js.map