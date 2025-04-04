import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { getAdmins, getAdminById, assignPermission, updatePermission, deletePermission } from "../controllers/adminController";

const router = Router();

router.use(authenticateToken);
router.use(adminOnly);

router.get("/", getAdmins);
router.get("/:id", getAdminById);

router.post("/:adminId/permissions", assignPermission);
router.put("/:adminId/permissions/:permissionId", updatePermission);
router.delete("/:adminId/permissions/:permissionsId", deletePermission);

export default router;
