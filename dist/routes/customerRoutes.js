"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const customersController_1 = require("../controllers/customersController");
const auth_1 = require("../middleware/auth");
const adminOnly_1 = require("../middleware/adminOnly");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/', customersController_1.getAllCustomers);
router.get('/:customerId', adminOnly_1.adminOnly, customersController_1.getCustomerById);
exports.default = router;
