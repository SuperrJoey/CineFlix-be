import { RequestHandler } from "express";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

export const signup: RequestHandler = async (req, res) => {
    const { username, name, password, role, adminRole } = req.body;

    if (!username || !password || !role || !name) {
        res.status(400).json({ message: "Error❌! All fields are required" });
        return;
    }

    // Validate role
    if (!["user", "admin"].includes(role)) {
        res.status(400).json({ message: "Error❌! Invalid role. Must be either 'user' or 'admin'" });
        return;
    }

    if (role === "admin" && !adminRole) {
        res.status(400).json({ message: "Error! Admin Role is required for admin users" });
        return;
    }

    try {
        const hashedPw = await bcrypt.hash(password, 8);
        const db = await dbPromise;

        // Prevent duplicate usernames
        const [existingUsers]: any = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
        if (existingUsers.length > 0) {
            res.status(400).json({ message: "Username already exists❌" });
            return;
        }

        await db.beginTransaction();

        try {
            // Insert user with validated role
            const [userResult]: any = await db.execute(
                "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", 
                [username, hashedPw, name, role]
            );
            
            const userId = userResult.insertId;

            if (role === "admin" ) {
                await db.execute(
                    "INSERT INTO admins(UserID, AdminRole, LastLogin) VALUES (?, ?, NOW())", 
                [userId, adminRole]
                );

                const [adminResult]: any = await db.execute(
                    "SELECT AdminID FROM admins WHERE UserID = ?",
                    [userId]
                );

                const adminID = adminResult[0].AdminID;

                await db.execute(
                    "INSERT INTO permissions (PermissionID, AdminID, Role, AccessLevel) VALUES (?, ?, ?)",
                    [1, adminID, "movies", "read, write, delete"]
                )
            }
            
            res.status(201).json({ 
                message: `User (${role}) registered successfully!✅`,
                role: role // Include role in response for frontend routing
            });

            await db.commit();

        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).json({ message: "Error❌! Failed to register user" });
    }
};



export const login: RequestHandler = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password ) {
        res.status(400).json({ message: "Error❌! All fields are required"});
        return;
    }


    try {
        const db = await dbPromise;
        const [ rows ]: any = await db.execute("SELECT u.*, a.AdminID, a.AdminRole FROM users u LEFT JOIN admins a ON u.UserID = a.UserID WHERE u.username = ?", [username]);

        if (rows.length === 0) {
            res.status(401).json({ message: "Invalid username or password"});
            return;
        }

        const user = rows[0];
        
        const isMatch = await bcrypt.compare(password, user.Password);

        if (!isMatch) {
            res.status(401).json({ message: "Invalid username or password"});
            return;
        }

        if (user.AdminID) {
            await db.execute(
                "UPDATE admins SET LastLogin = NOW() WHERE AdminID = ?",
                [user.AdminID]
            )
        }

        let permissions = [];
        if (user.AdminID) {
            const [permRows]: any = await db.execute(
                "SELECT Role, AccessLevel FROM permissions WHERE AdminID = ?",
                [user.AdminID]
            );
            permissions = permRows;
        }

        const token = jwt.sign({ 
            id: user.id, 
            role: user.role,
            adminId: user.AdminID,
            adminRole: user.AdminRole,
            permissions
        }, SECRET_KEY!, {expiresIn: "1h"});

        res.status(200).json({ 
            token, 
            role: user.Role,
            name: user.Name,
            isAdmin: !!user.AdminID,
            adminRole: user.AdminRole || null,
            permissions
        });
    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ message: "Error❌! Failed to login"});
    }
}

