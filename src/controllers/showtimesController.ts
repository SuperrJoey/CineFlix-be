import {  Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";

export const getShowtimes = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [showtimes]: any = await db.execute(`
            SELECT s.ShowtimeID, s.MovieID, s.ScreenID, s.StartTime, s.EndTime,
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
            SELECT s.ShowtimeID, s.MovieID, s.ScreenID, s.StartTime, s.EndTime,
            m.Title, m.Genre, m.Duration
            FROM Showtimes s JOIN Movies m ON s.MovieID = m.MovieID
            WHERE s.ShowtimeID = ?`, [id]);
    
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        const [seatRows]: any = await db.execute(`
            SELECT SeatID, SeatNumber, ScreenID, AvailabilityStatus FROM Seats
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
            SELECT s.ShowtimeID, s.MovieID, s.ScreenID, s.StartTime, s.EndTime,
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