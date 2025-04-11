import {  Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";

export const getShowtimes = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [showtimes]: any = await db.execute(`
            SELECT s.ShowtimeID, s.MovieID, s.screenID, s.StartTime,
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
            SELECT s.ShowtimeID, s.MovieID, s.screenID, s.StartTime,
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
  
      const [rows]: any = await db.execute(`
        SELECT 
          s.ShowtimeID, s.MovieID, s.screenID, s.StartTime,
          m.Title, m.Genre, m.Duration,
          se.SeatID, se.SeatNumber, se.AvailabilityStatus, se.screenID AS seatScreenID
        FROM Showtimes s
        JOIN Movies m ON s.MovieID = m.MovieID
        LEFT JOIN Seats se ON s.ShowtimeID = se.ShowtimeID
        WHERE m.MovieID = ?
        ORDER BY s.StartTime ASC, se.SeatNumber ASC
      `, [movieId]);
  
      // Group seats under their respective showtimes
      const showtimeMap = new Map();
  
      for (const row of rows) {
        const {
          ShowtimeID,
          MovieID,
          screenID,
          StartTime,
          Title,
          Genre,
          Duration,
          SeatID,
          SeatNumber,
          AvailabilityStatus,
          seatScreenID
        } = row;
  
        if (!showtimeMap.has(ShowtimeID)) {
          showtimeMap.set(ShowtimeID, {
            ShowtimeID,
            MovieID,
            screenID,
            StartTime,
            Title,
            Genre,
            Duration,
            seats: []
          });
        }
  
        if (SeatID) {
          showtimeMap.get(ShowtimeID).seats.push({
            SeatID,
            SeatNumber,
            screenID: seatScreenID,
            AvailabilityStatus
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
    const { movieId, screenId, startTime, totalSeats } = req.body;

    console.log("Incoming request data:", req.body);

    if (!movieId || !screenId || !startTime || !totalSeats) {
        console.log("Validation failed: All fields are required.");
        res.status(400).json({ message: "All fields required here" });
        return;
    }

    try {
        const db = await dbPromise;

        const [movieRows]: any = await db.execute(
            "SELECT * FROM Movies WHERE MovieID = ?",
            [parseInt(movieId)]
        );

        console.log("Movie query result:", movieRows);

        if (movieRows.length === 0) {
            console.log("Movie not found for ID:", movieId);
            res.status(404).json({ message: "Movie not found" });
            return;
        }

        // Check for conflicts based on start time and movie duration
        const [movieDuration]: any = await db.execute(
            "SELECT Duration FROM Movies WHERE MovieID = ?",
            [parseInt(movieId)]
        );
        
        console.log("Movie duration:", movieDuration);

        const duration = movieDuration[0].Duration;
        const endTime = new Date(new Date(startTime).getTime() + duration * 60000);

        const [conflictRows]: any = await db.execute(`
            SELECT s.* FROM Showtimes s
            JOIN Movies m ON s.MovieID = m.MovieID
            WHERE s.screenID = ? AND
                ((s.StartTime BETWEEN ? AND ?) OR
                (DATE_ADD(s.StartTime, INTERVAL m.Duration MINUTE) BETWEEN ? AND ?))
        `, [screenId, startTime, endTime, startTime, endTime]);
    
        console.log("Conflict check result:", conflictRows);

        if (conflictRows.length > 0) {
            console.log("Conflict detected for screen ID:", screenId);
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime on this screen" });
            return;
        }

        const [maxIdRows]: any = await db.execute("SELECT MAX(ShowtimeID) as maxId FROM Showtimes" );
        const nextShowtimeID = (maxIdRows[0].maxId || 0) + 1;

        await db.beginTransaction();

        try {
            await db.execute(
                "INSERT INTO Showtimes (ShowtimeID, MovieID, screenID, StartTime, endTime) VALUES (?, ?, ?, ?, endTime)",
                [nextShowtimeID, parseInt(movieId), screenId, startTime]
            );
        
            for (let i = 1; i <= totalSeats; i++) {
                await db.execute(
                    "INSERT INTO Seats (ShowtimeID, screenID, SeatNumber, AvailabilityStatus) VALUES (?, ?, ?, ?)",
                    [nextShowtimeID, screenId, i, "available"]
                );
            }

            await db.commit();

            console.log("Showtime added successfully with ID:", nextShowtimeID);
            res.status(201).json({
                message: "Showtime added successfully",
                showtimeId: nextShowtimeID
            });
        } catch (error) {
            await db.rollback();
            console.error("Error during database transaction:", error);
            throw error;
        }
    } catch (error) {
        console.error("Error adding showtime:", error);
        res.status(500).json({ message: "Server Error" });
    }
}

export const updateShowtime = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { screenId, startTime } = req.body;

    if (!screenId || !startTime) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }

    try {
        const db = await dbPromise

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM Showtimes WHERE ShowtimeID = ?",
            [id]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found!" });
            return;
        }

        // Get movie duration for conflict check
        const [movieDuration]: any = await db.execute(
            "SELECT Duration FROM Movies m JOIN Showtimes s ON m.MovieID = s.MovieID WHERE s.ShowtimeID = ?",
            [id]
        );
        
        const duration = movieDuration[0].Duration;
        const endTime = new Date(new Date(startTime).getTime() + duration * 60000);

        const [conflictRows]: any = await db.execute(`
            SELECT * FROM Showtimes 
            WHERE ScreenID = ? AND ShowtimeID != ? AND
                  ((StartTime BETWEEN ? AND ?) OR 
                   (DATE_ADD(StartTime, INTERVAL Duration MINUTE) BETWEEN ? AND ?))
        `, [screenId, id, startTime, endTime, startTime, endTime]);
    
        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime on this screen"})
            return;
        }   

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE Showtimes SET screenid = ?, startTime = ? WHERE ShowtimeID = ?",
                [screenId, startTime, id]
            );

            await db.execute(
                "UPDATE Seats SET ScreenID = ? WHERE ShowtimeID = ?",
                [screenId, id]
            );

            await db.commit();
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

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM Showtimes WHERE ShowtimeID = ?",
            [id]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        const [bookingRows]: any = await db.execute(
            "SELECT * FROM Bookings WHERE ShowtimeID = ?",
            [id]
        );

        if (bookingRows.length > 0){
            res.status(409).json({ message: "cannot delete showtime with existing bookings" });
            return;
        }

        await db.beginTransaction();

        try {
            await db.execute("DELETE FROM Seats WHERE ShowtimeID = ?", [id]);

            await db.execute("DELETE FROM Showtimes WHERE ShowtimeID = ?", [id]);

            await db.commit();

            res.status(200).json({ message: "Showtime deleted successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error deleting showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
}