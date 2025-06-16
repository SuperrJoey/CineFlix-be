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
exports.deletePermission = exports.updatePermission = exports.assignPermission = exports.getAdminById = exports.getAdmins = void 0;
const db_1 = __importDefault(require("../config/db"));
const reportService = __importStar(require("../services/reportService"));
const getAdmins = async (req, res) => {
    try {
        const db = await db_1.default;
        const [admins] = await db.execute(`
            SELECT a.adminid, a.adminrole, a.lastlogin, u.userid, u.username, u.name
            FROM admins a
            JOIN users u ON a.userid = u.userid
        `);
        res.status(200).json(admins);
    }
    catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({ message: "Server Error" });
    }
};
exports.getAdmins = getAdmins;
const getAdminById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        const [adminRows] = await db.execute(`
            SELECT a.adminid, a.adminrole, a.lastlogin, u.userid, u.username, u.name
            FROM admins a 
            JOIN users u ON a.userid = u.userid
            WHERE a.adminid = $1
        `, [id]);
        if (adminRows.length === 0) {
            res.status(404).json({ message: "Admin not found" });
            return;
        }
        const [permRows] = await db.execute(`
            SELECT permissionid, role, accesslevel
            FROM permissions 
            WHERE adminid = $1
        `, [id]);
        const admin = {
            ...adminRows[0],
            permissions: permRows
        };
        res.status(200).json(admin);
    }
    catch (error) {
        console.error("Error fetching admin details:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getAdminById = getAdminById;
const assignPermission = async (req, res) => {
    const { adminId } = req.params;
    const { role, accessLevel } = req.body;
    if (!role || !accessLevel) {
        res.status(400).json({ message: "Role and access level are required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [adminRows] = await db.execute("SELECT * FROM admins WHERE adminid = $1", [adminId]);
        if (adminRows.length === 0) {
            res.status(404).json({ message: "Admin not found" });
            return;
        }
        const [existingPerm] = await db.execute("SELECT * FROM permissions WHERE adminid = $1 AND role = $2", [adminId, role]);
        if (existingPerm.length > 0) {
            res.status(409).json({ message: "Permission already exists for this role" });
            return;
        }
        const [result] = await db.execute("INSERT INTO permissions (adminid, role, accesslevel) VALUES ($1, $2, $3) RETURNING permissionid", [adminId, role, accessLevel]);
        await reportService.createReport(req.user?.adminId || null, null, reportService.ReportType.ADMIN_ACTION, {
            action: "permission_assigned",
            details: { adminId, role, accessLevel },
            ip: req.ip
        });
        res.status(201).json({
            message: "Permission assigned successfully",
            permissionId: result[0].permissionid
        });
    }
    catch (error) {
        console.error("Error assigning permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.assignPermission = assignPermission;
const updatePermission = async (req, res) => {
    const { adminId, permissionId } = req.params;
    const { accessLevel } = req.body;
    if (!accessLevel) {
        res.status(400).json({ message: "Access Level is required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [permRows] = await db.execute("SELECT * FROM permissions WHERE adminid = $1 AND permissionid = $2", [adminId, permissionId]);
        if (permRows.length === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }
        await db.execute("UPDATE permissions SET accesslevel = $1 WHERE adminid = $2 AND permissionid = $3", [accessLevel, adminId, permissionId]);
        await reportService.createReport(req.user?.adminId || null, null, reportService.ReportType.ADMIN_ACTION, {
            action: "permission_updated",
            details: { adminId, permissionId, accessLevel },
            ip: req.ip
        });
        res.status(200).json({ message: "Permission updated successfully" });
    }
    catch (error) {
        console.error("Error updating permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updatePermission = updatePermission;
const deletePermission = async (req, res) => {
    const { adminId, permissionId } = req.params;
    try {
        const db = await db_1.default;
        const [permRows] = await db.execute("SELECT * FROM permissions WHERE adminid = $1 AND permissionid = $2", [adminId, permissionId]);
        if (permRows.length === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }
        await db.execute("DELETE FROM permissions WHERE adminid = $1 AND permissionid = $2", [adminId, permissionId]);
        await reportService.createReport(req.user?.adminId || null, null, reportService.ReportType.ADMIN_ACTION, {
            action: "permission_deleted",
            details: { adminId, permissionId },
            ip: req.ip
        });
        res.status(200).json({ message: "Permission deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deletePermission = deletePermission;
