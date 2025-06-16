"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaff = exports.getStaffSchedules = exports.deleteWorkSchedule = exports.updateWorkSchedule = exports.createWorkSchedule = exports.getStaffPermissions = exports.removeWorkArea = exports.assignWorkArea = exports.updateStaff = exports.addStaff = exports.getStaffById = exports.getAllStaff = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const reportService = __importStar(require("../services/reportService"));
const getAllStaff = async (req, res) => {
    try {
        const db = await db_1.default;
        const [staffRows] = await db.execute(`
            SELECT u.userid, u.username, u.name, u.role
            FROM users u
            LEFT JOIN admins a ON u.userid = a.userid
            WHERE a.adminrole = 'staff'
            ORDER BY u.name
        `);
        res.status(200).json(staffRows);
    }
    catch (error) {
        console.error("Error fetching staff:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getAllStaff = getAllStaff;
const getStaffById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        const [staffRows] = await db.execute(`
            SELECT u.userid, u.username, u.name, u.role,
                   a.adminid, a.adminrole, a.lastlogin
            FROM users u
            LEFT JOIN admins a ON u.userid = a.userid
            WHERE u.userid = $1 AND a.adminrole = 'staff'
        `, [id]);
        if (staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }
        res.status(200).json(staffRows[0]);
    }
    catch (error) {
        console.error("Error fetching staff details: ", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getStaffById = getStaffById;
const addStaff = async (req, res) => {
    const { username, name, password, adminRole, workAreas } = req.body;
    if (!username || !name || !password || !adminRole) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [existingUsers] = await db.execute("SELECT * FROM users WHERE username = $1", [username]);
        if (existingUsers.length > 0) {
            res.status(409).json({ message: "Username already exists" });
            return;
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 8);
        await db.beginTransaction();
        try {
            const [userResult] = await db.execute("INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, 'admin') RETURNING userid", [username, hashedPassword, name]);
            const userId = userResult[0].userid;
            const [adminResult] = await db.execute("INSERT INTO admins (userid, adminrole, lastlogin) VALUES ($1, $2, NOW()) RETURNING adminid", [userId, adminRole]);
            const adminId = adminResult[0].adminid;
            if (workAreas && workAreas.length > 0) {
                for (const area of workAreas) {
                    await db.execute("INSERT INTO permissions (adminid, role, accesslevel) VALUES ($1, $2, 'read')", [adminId, area]);
                }
            }
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, userId, reportService.ReportType.ADMIN_ACTION, {
                action: "staff_added",
                details: { username, name, adminRole, workAreas },
                ip: req.ip
            });
            res.status(201).json({
                message: "Staff member added successfully",
                userId,
                adminId
            });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error adding staff member: ", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.addStaff = addStaff;
const updateStaff = async (req, res) => {
    const { id } = req.params;
    const { name, adminRole } = req.body;
    if (!name) {
        res.status(400).json({ message: "Name is required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [staffRows] = await db.execute("SELECT u.userid, a.adminid FROM users u LEFT JOIN admins a ON u.userid = a.userid WHERE u.userid = $1 AND u.role = 'admin'", [id]);
        if (staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }
        const staff = staffRows[0];
        await db.beginTransaction();
        try {
            await db.execute("UPDATE users SET name = $1 WHERE userid = $2", [name, id]);
            if (adminRole && staff.adminid) {
                await db.execute("UPDATE admins SET adminrole = $1 WHERE adminid = $2", [adminRole, staff.adminid]);
            }
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, parseInt(id), reportService.ReportType.ADMIN_ACTION, {
                action: "staff_updated",
                details: { name, adminRole },
                ip: req.ip
            });
            res.status(200).json({ message: "Staff member updated successfully" });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error updating staff member:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateStaff = updateStaff;
const assignWorkArea = async (req, res) => {
    const { staffId } = req.params;
    const { role, accessLevel } = req.body;
    if (!role || !accessLevel) {
        res.status(400).json({ message: "Role and access level are required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [adminRows] = await db.execute(`
            SELECT a.adminid
            FROM users u
            JOIN admins a ON u.userid = a.userid
            WHERE u.userid = $1 AND u.role = 'admin'
        `, [staffId]);
        if (adminRows.length === 0) {
            res.status(404).json({ message: "Staff admin record not found" });
            return;
        }
        const adminId = adminRows[0].adminid;
        const [existingPermissions] = await db.execute("SELECT * FROM permissions WHERE adminid = $1 AND role = $2", [adminId, role]);
        if (existingPermissions.length > 0) {
            res.status(409).json({ message: "Permission already exists for this role" });
            return;
        }
        const [result] = await db.execute("INSERT INTO permissions (adminid, role, accesslevel) VALUES ($1, $2, $3) RETURNING permissionid", [adminId, role, accessLevel]);
        await reportService.createReport(req.user?.adminId || null, parseInt(staffId), reportService.ReportType.ADMIN_ACTION, {
            action: "work_area_assigned",
            details: { role, accessLevel },
            ip: req.ip
        });
        res.status(201).json({
            message: "Work area assigned successfully",
            permissionId: result[0].permissionid
        });
    }
    catch (error) {
        console.error("Error assigning work area:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.assignWorkArea = assignWorkArea;
const removeWorkArea = async (req, res) => {
    const { staffId, permissionId } = req.params;
    try {
        const db = await db_1.default;
        const [result] = await db.execute("DELETE FROM permissions WHERE permissionid = $1 AND adminid = (SELECT adminid FROM admins WHERE userid = $2)", [permissionId, staffId]);
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }
        await reportService.createReport(req.user?.adminId || null, parseInt(staffId), reportService.ReportType.ADMIN_ACTION, {
            action: "work_area_removed",
            details: { permissionId },
            ip: req.ip
        });
        res.status(200).json({ message: "Work area removed successfully" });
    }
    catch (error) {
        console.error("Error removing work area:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.removeWorkArea = removeWorkArea;
const getStaffPermissions = async (req, res) => {
    const { staffId } = req.params;
    try {
        const db = await db_1.default;
        const [permissions] = await db.execute(`
            SELECT p.permissionid, p.role, p.accesslevel
            FROM permissions p
            JOIN admins a ON p.adminid = a.adminid
            WHERE a.userid = $1
        `, [staffId]);
        res.status(200).json(permissions);
    }
    catch (error) {
        console.error("Error fetching staff permissions:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getStaffPermissions = getStaffPermissions;
const createWorkSchedule = async (req, res) => {
    const { staffId, scheduleDate, startTime, endTime, workArea } = req.body;
    if (!staffId || !scheduleDate || !startTime || !endTime || !workArea) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }
    try {
        const db = await db_1.default;
        await reportService.createReport(req.user?.adminId || null, parseInt(staffId), reportService.ReportType.WORK_SCHEDULE, {
            action: "schedule_created",
            details: { scheduleDate, startTime, endTime, workArea },
            ip: req.ip
        });
        res.status(201).json({
            message: "Work schedule created successfully"
        });
    }
    catch (error) {
        console.error("Error creating work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.createWorkSchedule = createWorkSchedule;
const updateWorkSchedule = async (req, res) => {
    const { scheduleId } = req.params;
    const { scheduleDate, startTime, endTime, workArea } = req.body;
    try {
        const db = await db_1.default;
        await reportService.createReport(req.user?.adminId || null, null, reportService.ReportType.WORK_SCHEDULE, {
            action: "schedule_updated",
            details: { scheduleId, scheduleDate, startTime, endTime, workArea },
            ip: req.ip
        });
        res.status(200).json({ message: "Work schedule updated successfully" });
    }
    catch (error) {
        console.error("Error updating work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateWorkSchedule = updateWorkSchedule;
const deleteWorkSchedule = async (req, res) => {
    const { scheduleId } = req.params;
    try {
        const db = await db_1.default;
        await reportService.createReport(req.user?.adminId || null, null, reportService.ReportType.WORK_SCHEDULE, {
            action: "schedule_deleted",
            details: { scheduleId },
            ip: req.ip
        });
        res.status(200).json({ message: "Work schedule deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteWorkSchedule = deleteWorkSchedule;
const getStaffSchedules = async (req, res) => {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;
    try {
        const db = await db_1.default;
        res.status(200).json([]);
    }
    catch (error) {
        console.error("Error fetching staff schedules:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getStaffSchedules = getStaffSchedules;
const deleteStaff = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        await db.beginTransaction();
        try {
            await db.execute("DELETE FROM admins WHERE userid = $1", [id]);
            const [result] = await db.execute("DELETE FROM users WHERE userid = $1", [id]);
            if (result.rowCount === 0) {
                await db.rollback();
                res.status(404).json({ message: "Staff member not found" });
                return;
            }
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, parseInt(id), reportService.ReportType.ADMIN_ACTION, {
                action: "staff_deleted",
                details: { deletedUserId: id },
                ip: req.ip
            });
            res.status(200).json({ message: "Staff member deleted successfully" });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error deleting staff member:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteStaff = deleteStaff;
