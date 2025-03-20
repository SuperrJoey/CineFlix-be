import { Request, Response} from "express";
import dbPromise from "../config/db";

export const getMovies = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [rows] = await db.execute("SELECT * FROM users");
        res.json(rows);
    } catch (error) {
        console.error("Database error: ", error);
        res.status(500).json({message: "Server error"});
    }
}