import { RequestHandler } from "express";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

export const signup: RequestHandler = async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        res.status(400).json({ message: "Error❌! All fields are required" });
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

        await db.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hashedPw, role]);

        res.status(201).json({ message: `User (${role}) registered successfully!✅` });
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
         
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            res.status(401).json({ message: "Invalid username or password"});
            return;
        }

        const token = jwt.sign({ id: user.id, role: user.role}, SECRET_KEY!, {expiresIn: "1h"});

        res.status(200).json({ token, role: user.role});
    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ message: "Error❌! Failed to login"});
    }
}

