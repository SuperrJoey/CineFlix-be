import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { adminOnly, hasPermission } from "../middleware/adminOnly";
import {
    getReports,
    getReportById,
    getReportSummary,
    createAuditLog
} from "../controllers/reportsController"

const router = Router();

router.use(authenticateToken);
router.use(adminOnly);

router.use(hasPermission("reports", "read"));

router.get("/",getReports);
router.get("/summary", getReportSummary);
router.get("/:id", getReportById);
router.post("/audit", hasPermission("reports", "write"), createAuditLog);

export default router;