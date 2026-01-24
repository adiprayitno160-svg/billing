import { Router } from 'express';
import { checkPppoeAvailability } from '../controllers/api/CustomerApiController';

const router = Router();

router.get('/customers/check-pppoe', checkPppoeAvailability);

export default router;
