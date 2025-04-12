import express from 'express';
import { getAllCustomers, getCustomerById } from '../controllers/customersController';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { adminOnly, hasPermission } from '../middleware/adminOnly';

const router = express.Router();

router.use(authenticateToken);
// Get all customers (admin only)
router.get('/', getAllCustomers);

// Get customer by ID with booking history (admin only)
router.get('/:customerId', adminOnly, getCustomerById);

export default router;