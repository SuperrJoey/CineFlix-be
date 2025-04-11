import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";

export const getSeatsByShowtime = async (req: Request, res: Response) => {
    const { showtimeId } = req.params;

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM Showtimes WHERE ShowtimeID = ?",
            [showtimeId]
        );
    
    if (showtimeRows.length === 0) {
        res.status(404).json({ message: "Showtime not found" });
        return;
    }

    const [seatRows]: any = await db.execute(`
        SELECT SeatID, SeatNumber, screenID, ShowtimeID, AvailabilityStatus, BookingID
        FROM Seats
        WHERE ShowtimeID = ?
        ORDER BY SeatNumber        
        `, [showtimeId]);

        res.status(200).json(seatRows);
    } catch (error) {
        console.error("Error fetching seats:", error);
        res.status(500).json({ message: "Server error" });
    } 
};

export const bookSeats = async (req: AuthRequest, res: Response) => {
    const { showtimeId } = req.params;
    const { seatIds } = req.body;
    const userId = req.user?.id;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({ message: "Seat IDs are required" });
        return;
    }

    if (!userId) {
        res.status(401).json({ message: "User must be logged in to book seats" });
        return;
    }

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM Showtimes WHERE ShowtimeID = ? ",
            [showtimeId]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        for (const SeatId of seatIds) {
            const [seatRows]: any = await db.execute(
                "SELECT * FROM Seats WHERE SeatID = ? AND ShowtimeID = ?",
                [SeatId, showtimeId]
            );

            if (seatRows.length === 0) {
                res.status(404).json({ message: `Seat ID ${SeatId} not found for this showtime `});
                return;
            }

            if (seatRows[0].AvailabilityStatus !== 'available') {
                res.status(409).json({ message: `SeatID ${SeatId} is not available` });
                return;
            }
        }

        await db.beginTransaction();

        try {
            const bookingDate = new Date().toISOString().split('T')[0];

            const [bookingResult]: any = await db.execute(
                "INSERT INTO Bookings (UserID, ShowtimeID, BookingDate, AvailabilityStatus) VALUES (?, ?, ?, ?)",
                [userId, showtimeId, bookingDate, 'confirmed']
            );

            const bookingId = bookingResult.insertId;
            for (const seatId of seatIds) {
                await db.execute(
                    "UPDATE Seats SET AvailabilityStatus = 'booked', BookingID = ? WHERE SeatID = ?",
                    [bookingId, seatId]
                );
            }

            await db.commit();

            const [movieDataRows]: any = await db.execute(`
                SELECT m.Title AS movieName, m.poster_url, s.StartTime, s.ScreenID, m.Duration
                FROM Showtimes s
                JOIN Movies m ON s.MovieID = m.MovieID
                WHERE s.ShowtimeID = 4
              `, [showtimeId]);

              if (!movieDataRows || movieDataRows.length === 0) {
                res.status(500).json({ message: "Failed to retrieve showtime metadata" });
                return;
              }

            console.log("movie data: ", movieDataRows[0]);

              const { movieName, poster_url , StartTime, ScreenID, Duration } = movieDataRows[0];
              
              const showtimeDate = new Date(StartTime).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });

              const showtimeTime = new Date(StartTime).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });              

            res.status(201).json({
                message: "Seats booked successfully",
                bookingId: bookingId,
                seatIds,
                movieName,
                poster_url,
                showtimeDate,
                showtimeTime,
                screen: ScreenID,
                Duration
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error booking seats:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const cancelBooking = async (req: AuthRequest, res: Response) => {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ message: "User must be logged in to cancel booking" });
        return;
    }

    try {
        const db = await dbPromise;

        const [bookingRows]: any = await db.execute(
            "SELECT * FROM Bookings WHERE BookingID = ?",
            [bookingId]
        );

        if (bookingRows.length === 0) {
            res.status(404).json({ message: "You can only cancel your own bookings" });
            return;
        }

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE Bookings SET AvailabilityStatus = 'cancelled' WHERE BookingID = ?",
                [bookingId]
            );

            await db.execute(
                "UPDATE Seats SET AvailabilityStatus = 'available', BookingID = NULL WHERE BookingID = ?",
                [bookingId]
            )

            await db.commit();

            res.status(200).json({ message: "Booking cancelled successfully" });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ message: "Server error"});
    }
};

export const getUserBookings = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ message: "User must be logged in to view bookings" });
        return;
    }

    try {
        const db = await dbPromise;

        const [bookingRows]: any = await db.execute(`
            SELECT b.BookingID, b.ShowtimeID, b.BookingDate, b.AvailabilityStatus,
                   s.StartTime, s.EndTime, s.ScreenID,
                   m.MovieID, m.Title, m.Genre, m.Duration
            FROM Bookings b
            JOIN Showtimes s ON b.ShowtimeID = s.ShowtimeID
            JOIN Movies m ON s.MovieID = m.MovieID
            WHERE b.UserID = ?
            ORDER BY b.BookingDate DESC, s.StartTime ASC
        `, [userId]);  

        const bookingWithSeats = await Promise.all(bookingRows.map(async (booking: any) => {
            const [seatRows]: any = await db.execute(
                "SELECT SeatID, SeatNumber, ScreenID FROM Seats WHERE BookingID = ?",
                [booking.BookingID]
            );

            return {
                ...booking,
                seats: seatRows
            };
        }));

        res.status(200).json(bookingWithSeats);

    } catch (error) {
        console.error("Error fetching user bookings: ", error);
        res.status(500).json({ message: "Server Error" });
    }
};