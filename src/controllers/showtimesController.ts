import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import * as reportService from "../services/reportService";

export const getShowtimes = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [showtimes]: any = await db.execute(`
            SELECT s.showtimeid, s.movieid, s.starttime, s.endtime,
                   m.title, m.genre, m.duration
            FROM showtimes s 
            JOIN movies m ON s.movieid = m.movieid
            ORDER BY s.starttime ASC
        `);
            
        res.status(200).json(showtimes);
    } catch (error) {
        console.error("Error fetching showtimes:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getShowtimeById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(`
            SELECT s.showtimeid, s.movieid, s.starttime, s.endtime,
                   m.title, m.genre, m.duration
            FROM showtimes s 
            JOIN movies m ON s.movieid = m.movieid
            WHERE s.showtimeid = $1
        `, [id]);
    
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        const [seatRows]: any = await db.execute(`
            SELECT seatid, seatnumber, availabilitystatus 
            FROM seats
            WHERE showtimeid = $1
            ORDER BY seatnumber ASC
        `, [id]);

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
  
        const [rows]: any = await db.execute(`
            SELECT 
                s.showtimeid, s.movieid, s.starttime, s.endtime,
                m.title, m.genre, m.duration,
                se.seatid, se.seatnumber, se.availabilitystatus
            FROM showtimes s
            JOIN movies m ON s.movieid = m.movieid
            LEFT JOIN seats se ON s.showtimeid = se.showtimeid
            WHERE m.movieid = $1
            ORDER BY s.starttime ASC, se.seatnumber ASC
        `, [movieId]);
  
        // Group seats under their respective showtimes
        const showtimeMap = new Map();
  
        for (const row of rows) {
            const {
                showtimeid,
                movieid,
                starttime,
                endtime,
                title,
                genre,
                duration,
                seatid,
                seatnumber,
                availabilitystatus
            } = row;
  
            if (!showtimeMap.has(showtimeid)) {
                showtimeMap.set(showtimeid, {
                    showtimeid,
                    movieid,
                    starttime,
                    endtime,
                    title,
                    genre,
                    duration,
                    seats: []
                });
            }
  
            if (seatid) {
                showtimeMap.get(showtimeid).seats.push({
                    seatid,
                    seatnumber,
                    availabilitystatus
                });
            }
        }
  
        const showtimesWithSeats = Array.from(showtimeMap.values());
  
        res.status(200).json(showtimesWithSeats);
    } catch (error) {
        console.error("Error fetching movie showtimes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const addShowtime = async (req: AuthRequest, res: Response) => {
    const { movieId, startTime, totalSeats } = req.body;

    if (!movieId || !startTime || !totalSeats) {
        res.status(400).json({ message: "All fields required here" });
        return;
    }

    try {
        const db = await dbPromise;

        const [movieRows]: any = await db.execute(
            "SELECT * FROM movies WHERE movieid = $1",
            [parseInt(movieId)]
        );

        if (movieRows.length === 0) {
            res.status(404).json({ message: "Movie not found" });
            return;
        }

        // Calculate end time based on movie duration
        const duration = movieRows[0].duration;
        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(startTimeDate.getTime() + duration * 60000);

        // Check for conflicts
        const [conflictRows]: any = await db.execute(`
            SELECT s.* FROM showtimes s
            JOIN movies m ON s.movieid = m.movieid
            WHERE (s.starttime < $1 AND s.endtime > $2) OR
                  (s.starttime < $3 AND s.endtime > $4) OR
                  (s.starttime >= $5 AND s.starttime < $6)
        `, [endTimeDate, startTimeDate, endTimeDate, startTimeDate, startTimeDate, endTimeDate]);

        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime" });
            return;
        }

        await db.beginTransaction();

        try {
            const [showtimeResult]: any = await db.execute(
                "INSERT INTO showtimes (movieid, starttime, endtime) VALUES ($1, $2, $3) RETURNING showtimeid",
                [parseInt(movieId), startTime, endTimeDate]
            );

            const showtimeId = showtimeResult[0].showtimeid;
        
            // Create seats for the showtime
            for (let i = 1; i <= totalSeats; i++) {
                await db.execute(
                    "INSERT INTO seats (showtimeid, seatnumber, availabilitystatus) VALUES ($1, $2, $3)",
                    [showtimeId, i, "available"]
                );
            }

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                req.user?.id || null,
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "showtime_added",
                    details: { movieId, showtimeId, startTime, endTime: endTimeDate, totalSeats },
                    ip: req.ip
                }
            );

            res.status(201).json({
                message: "Showtime added successfully",
                showtimeId: showtimeId
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error adding showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateShowtime = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { movieId, startTime } = req.body;

    if (!movieId || !startTime) {
        res.status(400).json({ message: "Movie ID and start time are required" });
        return;
    }

    try {
        const db = await dbPromise;

        // Check if showtime exists
        const [existingShowtime]: any = await db.execute(
            "SELECT * FROM showtimes WHERE showtimeid = $1",
            [id]
        );

        if (existingShowtime.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        // Get movie duration to calculate end time
        const [movieRows]: any = await db.execute(
            "SELECT duration FROM movies WHERE movieid = $1",
            [parseInt(movieId)]
        );

        if (movieRows.length === 0) {
            res.status(404).json({ message: "Movie not found" });
            return;
        }

        const duration = movieRows[0].duration;
        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(startTimeDate.getTime() + duration * 60000);

        // Check for conflicts (excluding current showtime)
        const [conflictRows]: any = await db.execute(`
            SELECT s.* FROM showtimes s
            WHERE s.showtimeid != $1 AND
                  ((s.starttime < $2 AND s.endtime > $3) OR
                   (s.starttime < $4 AND s.endtime > $5) OR
                   (s.starttime >= $6 AND s.starttime < $7))
        `, [id, endTimeDate, startTimeDate, endTimeDate, startTimeDate, startTimeDate, endTimeDate]);

        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime" });
            return;
        }

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE showtimes SET movieid = $1, starttime = $2, endtime = $3 WHERE showtimeid = $4",
                [parseInt(movieId), startTime, endTimeDate, id]
            );

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                req.user?.id || null,
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "showtime_updated",
                    details: { showtimeId: id, movieId, startTime, endTime: endTimeDate },
                    ip: req.ip
                }
            );

            res.status(200).json({ message: "Showtime updated successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error updating showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteShowtime = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;

        // Check if showtime exists
        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM showtimes WHERE showtimeid = $1",
            [id]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        // Check if there are any bookings for this showtime
        const [bookingRows]: any = await db.execute(
            "SELECT * FROM bookings WHERE showtimeid = $1",
            [id]
        );

        if (bookingRows.length > 0) {
            res.status(400).json({ message: "Cannot delete showtime with existing bookings" });
            return;
        }

        await db.beginTransaction();

        try {
            // Delete associated seats first (due to foreign key constraints)
            await db.execute("DELETE FROM seats WHERE showtimeid = $1", [id]);
            
            // Delete the showtime
            await db.execute("DELETE FROM showtimes WHERE showtimeid = $1", [id]);

            await db.commit();

            // Create audit report
            await reportService.createReport(
                req.user?.adminId || null,
                req.user?.id || null,
                reportService.ReportType.ADMIN_ACTION,
                {
                    action: "showtime_deleted",
                    details: { showtimeId: id },
                    ip: req.ip
                }
            );

            res.status(200).json({ message: "Showtime deleted successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error deleting showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};