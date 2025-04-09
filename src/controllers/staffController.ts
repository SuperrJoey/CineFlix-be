import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import { permission } from "process";


// NEED TO CREATE A REPORTS TABLE FOR THIS ONE

export const getAllStaff = async (req: AuthRequest, res: Response) => {
    try {
        const db = await dbPromise;
        const [staffRows]: any = await db.execute(`
            SELECT u.UserID, u.Username, u.Name, u.Role
      FROM Users u
      LEFT JOIN Admins a ON u.UserID = a.UserID
      WHERE a.AdminRole = 'staff'
      ORDER BY u.Name
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
            SELECT u.UserID, u.Username, u.Name, u.Role,
                   a.AdminID, a.AdminRole, a.LastLogin
            FROM Users u
            LEFT JOIN Admins a ON u.UserID = a.UserID
            WHERE u.UserID = ? AND a.AdminRole = 'staff'
        `, [id]);

        if(staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }

        res.status(200).json(staffRows);
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
            "SELECT * FROM Users WHERE Username = ?",
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
                "INSERT INTO Users (Username, Password, Name, Role) VALUES (?, ?, ?, 'manager')",
            [username, hashedPassword, name]
        );

        const userId = userResult.insertId;

        const [adminResult]: any = await db.execute(
            "INSERT INTO Admins (UserID, AdminRole, LastLogin) VALUES (?, ?, NOW())",
            [userId, adminRole]
        );

        const adminId = adminResult.insertId;

        for (const area of workAreas) {
            await db.execute(
                "INSERT INTO Permissions (AdminID, Role, AccessLevel) VALUES (? , ?, 'read')",
                [adminId, area]
            );
        }

        await db.commit();

        res.status(201).json({
            message: "Staff member added successfully",
            userId,
            adminId,

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
    const { id }= req.params;
    const { name, adminRole, status } = req.body;

    if(!name) {
        res.status(400).json({ message: "Name is required" });
        return;
    }

    try {
        const db = await dbPromise;

        const [staffRows]: any = await db.execute(
            "SELECT u.UserID, a.AdminID FROM Users u LEFT JOIN Admins a ON u.UserID = a.UserID WHERE u.UserID = ? AND u.Role = 'manager'",
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
                "UPDATE Users SET Name = ? WHERE UserID = ?",
                [name, id]
            );

            await db.commit();

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
    const { role, AccessLevel } = req.body;

    if (!role || !AccessLevel) {
        res.status(400).json({ message: "Role and access level is required" });
        return;
    }

    try {
        const db = await dbPromise;
        
        const [adminRows]: any = await db.execute(`
            SELECT a.AdminID
            FROM Users u
            JOIN Admins a ON u.UserID = a.UserID
            WHERE u.UserID = ? AND u.Role = 'manager'
            `, [staffId]);
            
        if (adminRows.length === 0) {
            res.status(404).json({ message: "Manager admin record not found" });
            return;
        }

        const adminId = adminRows[0].AdminID;

        const [existingPermissions]: any = await db.execute(
            "SELECT * FROM Permissions WHERE AdminID = ? AND Role = ?",
            [adminId, role]
        );

        if (existingPermissions.length > 0) {
            res.status(409).json({ message: "Permission already exists for this role" });
            return;
        }

        const [result]: any = await db.execute(
            "INSERT INTO Permissions(AdminID, Role, AccessLevel) VALUES (?, ?, ?)",
            [adminId, role, AccessLevel]
        );

        res.status(201).json({
            message: "Work area assigned successfully",
            permission: result.insertId
        });
        } catch (error) {
            console.error("Error assigning work area:", error);
            res.status(500).json({ message: "Server Error" });
    }
};

// USE REPORTS TABLE FOR THIS
// CREATE ONE

export const createWorkSchedule = async (req: AuthRequest, res: Response) => {
    const { title, date, startTime, endTime, staffIds, notes } = req.body;
    const adminId = req.user?.adminId;

    if (!title || !date || !startTime || !endTime || !staffIds || !Array.isArray(staffIds)) {
        res.status(400).json({ message: "Missing required fields" });
        return;
    }

    if (!adminId) {
        res.status(403).json({ message: "Admin privileges required" });
        return;
    }

    try {
        const db = await dbPromise;

        const scheduleData = JSON.stringify({
            title,
            date,
            startTime,
            endTime,
            staffIds,
            notes
        });

        const schedulableRoles = ['admin', 'manager', 'junior_manager']

        const schedulePromises = staffIds.map(async (staffId) => {
            console.log(`🔍 Checking staff ID: ${staffId}`);
            const [staffRows]: any = await db.execute(
                `SELECT u.* FROM Users u 
                 JOIN Admins a ON u.UserID = a.UserID 
                 WHERE u.UserID = ?`,
                 [staffId]
              );
              console.log(`🧾 Query result for staff ID ${staffId}:`, staffRows);

            if (staffRows.length === 0) {
                throw new Error(`Staff member with ID ${staffId} not found`);
            };

            const [result]: any = await db.execute(
                "INSERT INTO Reports (AdminID, UserID, ReportType, ReportData, GeneratedDate) VALUES (? ,? ,'work_schedule' , ?, NOW())",
                [adminId, staffId, scheduleData]
            );

            return {
            reportId: result.insertId,
            staffId,
            success: true
            };
        });

        const results = await Promise.all(schedulePromises);

        res.status(201).json({
            message: "Work schedule created successfully",
            schedules: results
        });
    } catch (error) {
        console.error("Error creating work schedule: ", error);
        res.status(500).json({ message: "Server error" })
    }
};


export const getStaffSchedules = async (req: AuthRequest, res: Response) => {
    const { staffId } =  req.params;

    try {
        const db = await dbPromise;

        const [scheduleRows]: any = await db.execute(`
            SELECT r.ReportID, r.AdminID, r.ReportData, r.GeneratedDate,
                   a.AdminRole, u.Name as AdminName
            FROM Reports r
            JOIN Admins a ON r.AdminID = a.AdminID
            JOIN Users u ON a.UserID = u.UserID
            WHERE r.UserID = ? AND r.ReportType = 'work_schedule'
            ORDER BY r.GeneratedDate DESC
        `, [staffId]);

        const schedules = scheduleRows.map((row: any) => {
            const scheduleData = JSON.parse(row.ReportData);
            return {
                reportId: row.ReportID,
                adminId: row.AdminID,
                adminName: row.AdminName,
                adminRole: row.AdminRole,
                generatedDate: row.GeneratedDate,
                title: scheduleData.title,
                date: scheduleData.date,
                startTime: scheduleData.startTime,
                endTime: scheduleData.endTime,
                notes: scheduleData.notes
            };
        })

        res.status(200).json(schedules);
    } catch (error) {
        console.error("Error fetching staff schedules: ", error);
        res.status(500).json({ message: "Server error" });
    }
};