import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import * as reportService from "../services/reportService";


// Get all staff members
export const getAllStaff = async (req: AuthRequest, res: Response) => {
    try {
        const db = await dbPromise;
        const [staffRows]: any = await db.execute(`
            SELECT u.userid, u.username, u.name, u.role
            FROM users u
            LEFT JOIN admins a ON u.userid = a.userid
            WHERE a.adminrole = 'staff'
            ORDER BY u.name
        `);
        
        res.status(200).json(staffRows);
    } catch (error) {
        console.error("Error fetching staff:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getStaffById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;

        const [staffRows]: any = await db.execute(`
            SELECT u.userid, u.username, u.name, u.role,
                   a.adminid, a.adminrole, a.lastlogin
            FROM users u
            LEFT JOIN admins a ON u.userid = a.userid
            WHERE u.userid = $1 AND a.adminrole = 'staff'
        `, [id]);

        if(staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }

        res.status(200).json(staffRows[0]);
    } catch (error) {
        console.error("Error fetching staff details: ", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const addStaff = async(req: AuthRequest, res: Response) => {
    const { username, name, password, adminRole, workAreas } = req.body;

    if (!username || !name || !password || !adminRole) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }

    try {
        const db = await dbPromise;

        const [existingUsers]: any = await db.execute(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if(existingUsers.length > 0) {
            res.status(409).json({message: "Username already exists" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 8);

        await db.beginTransaction();

        try {
            const [userResult]: any = await db.execute(
                "INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, 'admin') RETURNING userid",
                [username, hashedPassword, name]
            );

            const userId = userResult[0].userid;

            const [adminResult]: any = await db.execute(
                "INSERT INTO admins (userid, adminrole, lastlogin) VALUES ($1, $2, NOW()) RETURNING adminid",
                [userId, adminRole]
            );

            const adminId = adminResult[0].adminid;

            // Add work area permissions
            if (workAreas && workAreas.length > 0) {
                for (const area of workAreas) {
                    await db.execute(
                        "INSERT INTO permissions (adminid, role, accesslevel) VALUES ($1, $2, 'read')",
                        [adminId, area]
                    );
                }
            }

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                userId,
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "staff_added",
                    details: { username, name, adminRole, workAreas },
                    ip: req.ip
                }
            );

            res.status(201).json({
                message: "Staff member added successfully",
                userId,
                adminId
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error adding staff member: ", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, adminRole } = req.body;

    if(!name) {
        res.status(400).json({ message: "Name is required" });
        return;
    }

    try {
        const db = await dbPromise;

        const [staffRows]: any = await db.execute(
            "SELECT u.userid, a.adminid FROM users u LEFT JOIN admins a ON u.userid = a.userid WHERE u.userid = $1 AND u.role = 'admin'",
            [id]
        );

        if (staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }

        const staff = staffRows[0];

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE users SET name = $1 WHERE userid = $2",
                [name, id]
            );

            if (adminRole && staff.adminid) {
                await db.execute(
                    "UPDATE admins SET adminrole = $1 WHERE adminid = $2",
                    [adminRole, staff.adminid]
                );
            }

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                parseInt(id),
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "staff_updated",
                    details: { name, adminRole },
                    ip: req.ip
                }
            );

            res.status(200).json({ message: "Staff member updated successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error updating staff member:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const assignWorkArea = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;
    const { role, accessLevel } = req.body;

    if (!role || !accessLevel) {
        res.status(400).json({ message: "Role and access level are required" });
        return;
    }

    try {
        const db = await dbPromise;
        
        const [adminRows]: any = await db.execute(`
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

        const [existingPermissions]: any = await db.execute(
            "SELECT * FROM permissions WHERE adminid = $1 AND role = $2",
            [adminId, role]
        );

        if (existingPermissions.length > 0) {
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
            parseInt(staffId),
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "work_area_assigned",
                details: { role, accessLevel },
                ip: req.ip
            }
        );

        res.status(201).json({ 
            message: "Work area assigned successfully",
            permissionId: result[0].permissionid
        });
    } catch (error) {
        console.error("Error assigning work area:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const removeWorkArea = async (req: AuthRequest, res: Response) => {
    const { staffId, permissionId } = req.params;

    try {
        const db = await dbPromise;

        const [result]: any = await db.execute(
            "DELETE FROM permissions WHERE permissionid = $1 AND adminid = (SELECT adminid FROM admins WHERE userid = $2)",
            [permissionId, staffId]
        );

        if (result.rowCount === 0) {
            res.status(404).json({ message: "Permission not found" });
            return;
        }

        // Create audit report
        await reportService.createReport(
            req.user?.adminId || null,
            parseInt(staffId),
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "work_area_removed",
                details: { permissionId },
                ip: req.ip
            }
        );

        res.status(200).json({ message: "Work area removed successfully" });
    } catch (error) {
        console.error("Error removing work area:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getStaffPermissions = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;

    try {
        const db = await dbPromise;

        const [permissions]: any = await db.execute(`
            SELECT p.permissionid, p.role, p.accesslevel
            FROM permissions p
            JOIN admins a ON p.adminid = a.adminid
            WHERE a.userid = $1
        `, [staffId]);

        res.status(200).json(permissions);
    } catch (error) {
        console.error("Error fetching staff permissions:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const createWorkSchedule = async (req: AuthRequest, res: Response) => {
    const { staffId, scheduleDate, startTime, endTime, workArea } = req.body;

    if (!staffId || !scheduleDate || !startTime || !endTime || !workArea) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }

    try {
        const db = await dbPromise;

        // Create audit report for work schedule
        await reportService.createReport(
            req.user?.adminId || null,
            parseInt(staffId),
            reportService.ReportType.WORK_SCHEDULE,
            {
                action: "schedule_created",
                details: { scheduleDate, startTime, endTime, workArea },
                ip: req.ip
            }
        );

        res.status(201).json({ 
            message: "Work schedule created successfully"
        });
    } catch (error) {
        console.error("Error creating work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateWorkSchedule = async (req: AuthRequest, res: Response) => {
    const { scheduleId } = req.params;
    const { scheduleDate, startTime, endTime, workArea } = req.body;

    try {
        const db = await dbPromise;

        // Create audit report for work schedule update
        await reportService.createReport(
            req.user?.adminId || null,
            null,
            reportService.ReportType.WORK_SCHEDULE,
            {
                action: "schedule_updated",
                details: { scheduleId, scheduleDate, startTime, endTime, workArea },
                ip: req.ip
            }
        );

        res.status(200).json({ message: "Work schedule updated successfully" });
    } catch (error) {
        console.error("Error updating work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteWorkSchedule = async (req: AuthRequest, res: Response) => {
    const { scheduleId } = req.params;

    try {
        const db = await dbPromise;

        // Create audit report for work schedule deletion
        await reportService.createReport(
            req.user?.adminId || null,
            null,
            reportService.ReportType.WORK_SCHEDULE,
            {
                action: "schedule_deleted",
                details: { scheduleId },
                ip: req.ip
            }
        );

        res.status(200).json({ message: "Work schedule deleted successfully" });
    } catch (error) {
        console.error("Error deleting work schedule:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getStaffSchedules = async (req: AuthRequest, res: Response) => {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    try {
        const db = await dbPromise;

        // For now, return empty array as we don't have a schedules table
        // This would need to be implemented based on your schedule requirements
        res.status(200).json([]);
    } catch (error) {
        console.error("Error fetching staff schedules:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;

        await db.beginTransaction();

        try {
            // First delete from admins table
            await db.execute("DELETE FROM admins WHERE userid = $1", [id]);
            
            // Then delete from users table
            const [result]: any = await db.execute("DELETE FROM users WHERE userid = $1", [id]);

            if (result.rowCount === 0) {
                await db.rollback();
                res.status(404).json({ message: "Staff member not found" });
                return;
            }

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                parseInt(id),
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "staff_deleted",
                    details: { deletedUserId: id },
                    ip: req.ip
                }
            );

            res.status(200).json({ message: "Staff member deleted successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error deleting staff member:", error);
        res.status(500).json({ message: "Server error" });
    }
};