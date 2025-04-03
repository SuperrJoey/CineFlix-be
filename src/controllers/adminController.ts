import { Request, Response } from "express";
import { AuthRequest  } from "../middleware/auth";
import dbPromise from "../config/db";
import { permission } from "process";

export const getAdmins = async (req: AuthRequest, res: Response) => {
    try {
        const db = await dbPromise;
        const [admins]: any = await db.execute(`
            SELECT a.AdminID, a.AdminRole, a.LastLogin, u.UserID, u.Username, u.Name
            FROM admins a
            JOIN users u ON a.UserID = U.UserID`);

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
            SELECT a.AdminID, a.AdminRole, a.LastLogin, u.UserID, u.Username, u.Name
            FROM admins a 
            JOIN users u ON a.UserID = u.UserID
            WHERE a.AdminID = ?`, [id]);
        
        if (adminRows.length === 0) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const [permRows]: any = await db.execute(`
            SELECT PermissionID, Role, AccessLevel
            FROM permissions 
            WHERE AdminID = ?
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
    const [ role, AccessLevel ] = req.body;

    if (!role || !AccessLevel) {
        return res.status(400).json({ message: "Role and access level are required" });
    }
    
    try {
        const db = await dbPromise;

        const [adminRows]: any = await db.execute("SELECT * FROM admins WHERE AdminID = ?", [adminId]);

        if (adminRows.length === 0) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const [maxIdRows]: any = await db.execute(
            "SELECT MAX(PermissionID) as maxId FROM permissions WHERE AdminID = ?",
            [adminId]
        );
        const nextPermissionId = (maxIdRows[0].maxId || 0) + 1;

        await db.execute(
            "INSERT INTO permissions (PermissionID, AdminID, Role, AccessLevel) VALUES (?, ?, ?, ?)",
            [nextPermissionId, adminId, role, AccessLevel]
        );

        res.status(201).json({
            message: "Permission  assisgned successfully",
            permissionId: nextPermissionId
        });
    } catch (error) {
        console.error("Error assigning permission:", error);
        res.status(500).json({ message: "Server error" });
    }
};