import { Router } from 'express';
import { TechnicianController } from '../controllers/technician/TechnicianController';
import { isAuthenticated } from '../middlewares/authMiddleware';

const router = Router();

// Middleware to ensure user is logged in
// We don't strictly enforce 'technician' role for ALL routes because 
// Admins might want to see the dashboard too, or we can handle role checks in controller.
// But typically, 'technician' dashboard is for technicians.
// For now, let's allow authenticated users and handle data filtering in controller.

router.use((req, res, next) => {
    console.log(`🛠️ [Technician Route] Accessing: ${req.method} ${req.path}`);
    next();
});

router.get('/', isAuthenticated, TechnicianController.dashboard);
router.get('/jobs', isAuthenticated, TechnicianController.getJobs);
router.post('/jobs/accept', isAuthenticated, TechnicianController.acceptJob);
router.post('/jobs/decline', isAuthenticated, TechnicianController.declineJob);
import { technicianUpload } from '../middlewares/uploadMiddleware';

router.post('/jobs/complete', isAuthenticated, technicianUpload.single('proof'), TechnicianController.completeJob);
router.post('/jobs/save', isAuthenticated, TechnicianController.apiSaveJob);
router.get('/customers/search', isAuthenticated, TechnicianController.apiSearchCustomers);
router.get('/jobs/:id', isAuthenticated, TechnicianController.getJobDetail);
router.get('/history', isAuthenticated, TechnicianController.getJobHistory);
router.post('/jobs/:id/verify', isAuthenticated, TechnicianController.verifyJob);
router.delete('/jobs/:id', isAuthenticated, TechnicianController.deleteJob);



// Installation Approval (Admin/Operator only)
import { InstallationApprovalController } from '../controllers/technician/InstallationApprovalController';
router.get('/installations/approval', isAuthenticated, InstallationApprovalController.list);
router.get('/installations/:jobId', isAuthenticated, InstallationApprovalController.getDetail);
router.post('/installations/approve', isAuthenticated, InstallationApprovalController.approve);
router.post('/installations/reject', isAuthenticated, InstallationApprovalController.reject);

// Salary Routes for Technician
import { TechnicianSalaryController } from '../controllers/technician/TechnicianSalaryController';
router.get('/salary/my-history', isAuthenticated, TechnicianSalaryController.viewMySalaryHistory);
router.get('/salary/slip/:id', isAuthenticated, TechnicianSalaryController.printSalarySlip);

export default router;
