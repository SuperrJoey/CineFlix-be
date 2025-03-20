import express, { Request, Response } from "express";
import cors from "cors";
import dbPromise from "./config/db";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/users", async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [ rows ] = await db.execute(" SELECT * FROM users");
        res.json(rows);
    } catch (error) {
        console.error("Database error: ", error);
        res.status(500).json({ message: "Server error"});
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server Running on port ${PORT}`))

