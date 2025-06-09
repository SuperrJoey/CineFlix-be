import { Request, Response } from "express";
import { AuthRequest } from "../types/express";
import dbPromise from "../config/db";
import * as reportService from "../services/reportService";

export const getAdmins = async (req: AuthRequest, res: Response) => {
    try {
        const db = await dbPromise;
        const [admins]: any = await db.execute(`
            SELECT a.adminid, a.adminrole, a.lastlogin, u.userid, u.username, u.name
            FROM admins a
            JOIN users u ON a.userid = u.userid
        `);

        res.status(200).json(admins);
    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getAdminById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;
        
        const [adminRows]: any = await db.execute(`
            SELECT a.adminid, a.adminrole, a.lastlogin, u.userid, u.username, u.name
            FROM admins a 
            JOIN users u ON a.userid = u.userid
            WHERE a.adminid = $1
        `, [id]);
        
        if (adminRows.length === 0) {
            res.status(404).json({ message: "Admin not found" });
            return;
        }

        const [permRows]: any = await db.execute(`
            SELECT permissionid, role, accesslevel
            FROM permissions 
            WHERE adminid = $1
        `, [id]);

        const admin = {
            ...adminRows[0],
            permissions: permRows
        };

        res.status(200).json(admin);
    } catch (error) {
        console.error("Error fetching admin details:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const assignPermission = async (req: AuthRequest, res: Response) => {
    const { adminId } = req.params;
    const { role, accessLevel } = req.body;

    if (!role || !accessLevel) {
        res.status(400).json({ message: "Role and access level are required" });
        return;
    }
    
    try {
        const db = await dbPromise;

        const [adminRows]: any = await db.execute(
            "SELECT * FROM admins WHERE adminid = $1", 
            [adminId]
        );

        if (adminRows.length === 0) {
            res.status(404).json({ message: "Admin not found" });
            return;
        }

        // Check if permission already exists
        const [existingPerm]: any = await db.execute(
            "SELECT * FROM permissions WHERE adminid = $1 AND role = $2",
            [adminId, role]
        );

        if (existingPerm.length > 0) {
            res.status(409).json({ message: "Permission already exists for this role" });
            return;
        }

        const [result]: any = await db.execute(
            "INSERT INTO permissions (adminid, role, accesslevel) VALUES ($1, $2, $3) RETURNING permissionid",
            [adminId, role, accessLevel]
        );

        // Create audit report
        await reportService.createReport(
            req.user?.adminId || null,
            null,
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "permission_assigned",
                details: { adminId, role, accessLevel },
                ip: req.ip
            }
        );

        res.status(201).json({
            message: "Permission assigned successfully",
            permissionId: result[0].permissionid
        });
    } catch (error) {
        console.error("Error assigning permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updatePermission = async (req: AuthRequest, res: Response) => {
    const { adminId, permissionId } = req.params;
    const { accessLevel } = req.body;

    if (!accessLevel) {
        res.status(400).json({ message: "Access Level is required" });
        return;
    }

    try {
        const db = await dbPromise;

        const [permRows]: any = await db.execute(
            "SELECT * FROM permissions WHERE adminid = $1 AND permissionid = $2",
            [adminId, permissionId]
        );

        if (permRows.length === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }

        await db.execute(
            "UPDATE permissions SET accesslevel = $1 WHERE adminid = $2 AND permissionid = $3",
            [accessLevel, adminId, permissionId]
        );

        // Create audit report
        await reportService.createReport(
            req.user?.adminId || null,
            null,
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "permission_updated",
                details: { adminId, permissionId, accessLevel },
                ip: req.ip
            }
        );

        res.status(200).json({ message: "Permission updated successfully" });
    } catch (error) {
        console.error("Error updating permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const deletePermission = async (req: AuthRequest, res: Response) => {
    const { adminId, permissionId } = req.params;

    try {
        const db = await dbPromise;

        const [permRows]: any = await db.execute(
            "SELECT * FROM permissions WHERE adminid = $1 AND permissionid = $2",
            [adminId, permissionId]
        );

        if (permRows.length === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }

        await db.execute(
            "DELETE FROM permissions WHERE adminid = $1 AND permissionid = $2",
            [adminId, permissionId]
        );

        // Create audit report
        await reportService.createReport(
            req.user?.adminId || null,
            null,
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "permission_deleted",
                details: { adminId, permissionId },
                ip: req.ip
            }
        );

        res.status(200).json({ message: "Permission deleted successfully" });
    } catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};