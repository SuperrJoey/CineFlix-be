import {  Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import { start } from "repl";

export const getShowtimes = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [showtimes]: any = await db.execute(`
            SELECT s.ShowtimeID, s.MovieID, s.screenID, s.StartTime, s.EndTime,
            m.Title, m.Genre, m.Duration
            FROM showtimes s JOIN Movies m ON s.MovieID = m.MovieID
            ORDER BY s.StartTime ASC`);
            
            res.status(200).json(showtimes);
        } catch (error) {
            console.error("Error fetching showtimes:", error);
            res.status(500).json({ message : "Server Error" });
        }
};

export const getShowtimeById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(`
            SELECT s.ShowtimeID, s.MovieID, s.screenID, s.StartTime, s.EndTime,
            m.Title, m.Genre, m.Duration
            FROM Showtimes s JOIN Movies m ON s.MovieID = m.MovieID
            WHERE s.ShowtimeID = ?`, [id]);
    
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        const [seatRows]: any = await db.execute(`
            SELECT SeatID, SeatNumber, screenID, AvailabilityStatus FROM Seats
            WHERE ShowtimeID = ?`, [id]);

        const showtime = {
            ...showtimeRows[0],
            seats: seatRows
        };

        res.status(200).json(showtime);
    } catch (error) {
        console.error("Error fetching showtime details:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getShowtimesByMovie = async (req: Request, res: Response) => {
    const { movieId } = req.params;

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(`
            SELECT s.ShowtimeID, s.MovieID, s.screenID, s.StartTime, s.EndTime,
            m.Title, m.Genre, m.Duration
            FROM Showtimes s
            JOIN Movies m ON s.MovieID = m.MovieID
            WHERE m.MovieID = ?
            ORDER BY s.StartTime ASC
            `, [movieId]);

            res.status(200).json(showtimeRows);
    } catch (error) {
        console.error("Error fetching movie showtimes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const addShowtime  = async (req: AuthRequest, res: Response) => {
    const { movieId, screenId, startTime, endTime, totalSeats } = req.body;

    if (!movieId || screenId || !startTime || !endTime || !totalSeats) {
        res.status(400).json({ message: "All fields required"});
        return;
    }

    try {
        const db = await dbPromise;

        const [movieRows]: any= await db.execute(
            "SELECT * FROM Movies WHERE MovieID = ?",
            [movieId]
        );

        if (movieRows.length === 0) {
            res.status(404).json({ message: "Not Found" });
            return;
        }


        const [conflictRows]: any = await db.execute(`
            SELECT * FROM Showtimes
            WHERE screenID = ? AND
                ((StartTime BETWEEN ? AND ?) OR
                (EndTime BETWEEN ? AND ?) OR
                (StartTime <= ? AND EndTime >= ?))
            `, [screenId, startTime, endTime, startTime, endTime, startTime, endTime]);
    
        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime on this screen" });
            return;
        }

        const [maxIdRows]: any = await db.execute("SELECT MAX(ShowtimeID) as maxId FROM Showtimes" );
        const nextShowtimeID = (maxIdRows[0].maxId || 0) + 1;

        await db.beginTransaction();

        try {
            await db.execute(
                "INSERT INTO Showtimes (ShowtimeID, MovieID, screenID, StartTime, EndTime) VALUES (? , ?, ?, ?)",
                [nextShowtimeID, movieId, screenId, startTime, endTime]
            );
        
        for (let i = 0; i <= totalSeats; i++) {
            await db.execute(
                "INSERT INTO Seats (SeatID, ShowtimeID, screenID, SeatNumber, AvailabilityStatus)"
                , [null, nextShowtimeID, screenId, i, "available"]
            );
        }

        await db.commit();

        res.status(201).json({
            message: "Showtime added successfully",
            showtimeId: nextShowtimeID
        });
        
        } catch (error) {
            await db.rollback();
            throw error;
            }
        } catch (error) {
            console.error("Error adding showtime:", error);
            res.status(500).json({ message: "Server Error" });
    }
}