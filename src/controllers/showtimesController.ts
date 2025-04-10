import {  Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";

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
  
      const [rows]: any = await db.execute(`
        SELECT 
          s.ShowtimeID, s.MovieID, s.screenID, s.StartTime, s.EndTime,
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
          EndTime,
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
            EndTime,
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
  

export const addShowtime  = async (req: AuthRequest, res: Response) => {
    const { movieId, screenId, startTime, endTime, totalSeats } = req.body;

    console.log("movie id: ", movieId);
    console.log("screen id: ", screenId);
    console.log("startime: ", startTime);
    console.log("endtime: ", endTime);
    console.log("total seats: ", totalSeats);


    if (!movieId || !screenId || !startTime || !endTime || !totalSeats) {
        res.status(400).json({ message: "All fields required here"});
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
                "INSERT INTO Showtimes (ShowtimeID, MovieID, screenID, StartTime, EndTime) VALUES (?, ?, ?, ?, ?)",
                [nextShowtimeID, movieId, screenId, startTime, endTime]
            );
        
        for (let i = 1; i <= totalSeats; i++) {
            await db.execute(
                "INSERT INTO Seats (ShowtimeID, screenID, SeatNumber, AvailabilityStatus) VALUES (?, ?, ?, ?)"
                , [nextShowtimeID, screenId, i, "available"]
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

export const updateShowtime = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { screenId, startTime, endTime } = req.body;

    if (!screenId || !startTime || !endTime ) {
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

        const [conflictRows]: any = await db.execute(`
            SELECT * FROM Showtimes 
            WHERE ScreenID = ? AND ShowtimeID != ? AND
                  ((StartTime BETWEEN ? AND ?) OR 
                   (EndTime BETWEEN ? AND ?) OR
                   (StartTime <= ? AND EndTime >= ?))
        `, [screenId, id, startTime, endTime, startTime, endTime, startTime, endTime]);
    
        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime on this screen"})
            return;
        }   

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE Showtimes SET screenid = ?, startTime = ?, EndTime = ? WHERE ShowtimeID = ?",
                [screenId, startTime, endTime, id]
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
        console.error("Error updating showtime: ", error);
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