import { Router } from "express";
import {
    getAllStaff,
    getStaffById,
    addStaff,
    updateStaff,
    assignWorkArea,
    createWorkSchedule,
    getStaffSchedules
} from "../controllers/staffController"

import { authenticateToken, AuthRequest } from "../middleware/auth";
import { adminOnly, hasPermission } from "../middleware/adminOnly";

const router = Router();

router.use(authenticateToken);

router.get("/", adminOnly, getAllStaff);
router.get("/:id", adminOnly, getStaffById);

router.get("/:staffId/schedules", (req: AuthRequest, res, next) => {
    const staffId = parseInt(req.params.staffId);
    const userId = req.user?.id;
    
    if (staffId === userId || req.user?.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied" });
    }
}, getStaffSchedules);

router.post("/", adminOnly, hasPermission("staff", "write"), addStaff);
router.put("/:id", adminOnly, hasPermission("staff", "write"), updateStaff);
router.post("/:staffId/work-areas", adminOnly, hasPermission("staff", "write"), assignWorkArea);
router.post("/schedules", adminOnly, hasPermission("staff", "write"), createWorkSchedule);

export default router;