"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staffController_1 = require("../controllers/staffController");
const auth_1 = require("../middleware/auth");
const adminOnly_1 = require("../middleware/adminOnly");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get("/", adminOnly_1.adminOnly, staffController_1.getAllStaff);
router.get("/:id", adminOnly_1.adminOnly, staffController_1.getStaffById);
router.get("/:staffId/schedules", (req, res, next) => {
    const staffId = parseInt(req.params.staffId);
    const userId = req.user?.id;
    if (staffId === userId || req.user?.role === "admin") {
        next();
    }
    else {
        res.status(403).json({ message: "Access denied" });
    }
}, staffController_1.getStaffSchedules);
router.post("/", adminOnly_1.adminOnly, (0, adminOnly_1.hasPermission)("staff", "write"), staffController_1.addStaff);
router.put("/:id", adminOnly_1.adminOnly, (0, adminOnly_1.hasPermission)("staff", "write"), staffController_1.updateStaff);
router.post("/:staffId/work-areas", adminOnly_1.adminOnly, (0, adminOnly_1.hasPermission)("staff", "write"), staffController_1.assignWorkArea);
router.post("/schedules", adminOnly_1.adminOnly, (0, adminOnly_1.hasPermission)("staff", "write"), staffController_1.createWorkSchedule);
router.post("/view-schedules", adminOnly_1.adminOnly, (0, adminOnly_1.hasPermission)("staff", "view"), staffController_1.getStaffSchedules);
exports.default = router;
