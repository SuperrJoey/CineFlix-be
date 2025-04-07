import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";

export const getAllStaff = async (req: AuthRequest, res: Response) => {
    try {
        const db = await dbPromise;
        const [staffRows]: any = await db.execute(`
            SELECT u.UserID, u.Username, u.Name, u.Role,
            u.adminID, u.AdminRole, a.LastLogin
        FROM Users u 
        LEFT JOIN Admins a ON u.UserID 
        WHERE u.Role = 'manager'
        ORDER BY u.Name
        `);
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
            WHERE u.UserID = ? AND u.Role = 'manager'
        `, [id]);

        if(staffRows.length === 0) {
            res.status(404).json({ message: "Staff member not found" });
            return;
        }
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