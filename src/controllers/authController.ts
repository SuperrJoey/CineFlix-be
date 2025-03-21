import { Request, Response } from "express";
import dbPromise from "../config/db";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

export const signup = async (req: Request, res: Response) => {
    const {username, password, role} = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: "Error❌! All fields are required"});
    console.log(username, password, role);

    try {
        const hashedPw = await bcrypt.hash(password, 8);
        const db = await dbPromise;
        await db.execute("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", [username, hashedPw, role]);

        res.status(201).json({ message: "User registered successfully!✅"});
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).json({ message: "Error❌! Failed to register user"});
    }

}

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password ) return res.status(400).json({ message: "Error❌! All fields are required"});

    console.log(username, password);

    try {
        const db = await dbPromise;
        const [ rows ]: any = await db.execute("SELECT * FROM users WHERE username = ?", [username]);

        if (rows.length === 0) return res.status(401).json({ message: "Invalid username or password"});

        const user = rows[0];
         
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(401).json({ message: "Invalid username or password"});

        const token = jwt.sign({ id: user.id, role: user.role}, SECRET_KEY, {expiresIn: "1h"});

        res.status(200).json({ token, role: user.role});

        
    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ message: "Error❌! Failed to login"});

    }
}

