import { RequestHandler } from "express";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

export const signup: RequestHandler = async (req, res) => {
    const { username, name, password, role } = req.body;

    if (!username || !password || !role || !name) {
        res.status(400).json({ message: "Error❌! All fields are required" });
        return;
    }

    // Validate role
    if (!["user", "admin"].includes(role)) {
        res.status(400).json({ message: "Error❌! Invalid role. Must be either 'user' or 'admin'" });
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

        // Insert user with validated role
        await db.execute(
            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", 
            [username, hashedPw, name, role]
        );

        res.status(201).json({ 
            message: `User (${role}) registered successfully!✅`,
            role: role // Include role in response for frontend routing
        });
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

    console.log(username, password);

    try {
        const db = await dbPromise;
        const [ rows ]: any = await db.execute("SELECT * FROM users WHERE username = ?", [username]);

        if (rows.length === 0) {
            res.status(401).json({ message: "Invalid username or password"});
            return;
        }

        const user = rows[0];
        console.log("Type of password:", typeof password);
console.log("Type of stored hash:", typeof user.Password);
console.log("Raw user data from DB:", user);
console.log("Stored hash:", user.Password);

         
        const isMatch = await bcrypt.compare(password, user.Password);

        if (!isMatch) {
            res.status(401).json({ message: "Invalid username or password"});
            return;
        }

        const token = jwt.sign({ id: user.id, role: user.role}, SECRET_KEY!, {expiresIn: "1h"});

        res.status(200).json({ 
            token, 
            role: user.role,
            name: user.name
        });
    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ message: "Error❌! Failed to login"});
    }
}

