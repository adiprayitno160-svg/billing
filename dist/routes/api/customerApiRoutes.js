"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CustomerApiController_1 = require("../../controllers/api/CustomerApiController");
const router = (0, express_1.Router)();
router.get('/customers/check-pppoe', CustomerApiController_1.checkPppoeAvailability);
exports.default = router;
//# sourceMappingURL=customerApiRoutes.js.map