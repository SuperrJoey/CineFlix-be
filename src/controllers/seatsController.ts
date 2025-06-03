import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import { io } from "../index"; 

// In-memory store for temporary seat reservations
// Format: { [showtimeId]: { [seatId]: { socketId, timestamp } } }
const temporaryReservations: Record<string, Record<string, { socketId: string, timestamp: number }>> = {};

// Reservation timeout in milliseconds (5 minutes)
const RESERVATION_TIMEOUT = 5 * 60 * 1000;

// Clean up expired reservations every minute
setInterval(() => {
    const now = Date.now();
    
    Object.keys(temporaryReservations).forEach(showtimeId => {
        Object.keys(temporaryReservations[showtimeId]).forEach(seatId => {
            const reservation = temporaryReservations[showtimeId][seatId];
            if (now - reservation.timestamp > RESERVATION_TIMEOUT) {
                // Release expired reservation
                delete temporaryReservations[showtimeId][seatId];
                
                // Notify clients that seat is available again
                io.to(`showtime_${showtimeId}`).emit("seat_reservation_expired", {
                    seatId: parseInt(seatId),
                    socketId: reservation.socketId
                });
                
                console.log(`Released expired reservation for seat ${seatId} in showtime ${showtimeId}`);
            }
        });
    });
}, 60000);

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

        // Add temporary reservation status to the response
        const seatsWithReservations = seatRows.map((seat: any) => {
            const temporarilyReserved = temporaryReservations[showtimeId]?.[seat.SeatID];
            return {
                ...seat,
                temporarilyReserved: temporarilyReserved ? true : false
            };
        });

        res.status(200).json(seatsWithReservations);
    } catch (error) {
        console.error("Error fetching seats:", error);
        res.status(500).json({ message: "Server error" });
    } 
};

export const reserveSeat = async (req: Request, res: Response) => {
    const { showtimeId } = req.params;
    const { seatId, socketId, isReserving } = req.body;

    if (!seatId || !socketId) {
        res.status(400).json({ message: "Seat ID and Socket ID are required" });
        return;
    }

    try {
        // Initialize showtime reservations if not exist
        if (!temporaryReservations[showtimeId]) {
            temporaryReservations[showtimeId] = {};
        }

        if (isReserving) {
            // Check if seat is already reserved
            if (temporaryReservations[showtimeId][seatId]) {
                res.status(409).json({ 
                    message: "Seat is already reserved by another user",
                    reservedBy: temporaryReservations[showtimeId][seatId].socketId
                });
                return;
            }

            // Add new reservation
            temporaryReservations[showtimeId][seatId] = {
                socketId,
                timestamp: Date.now()
            };

            // Notify all clients about the reservation
            io.to(`showtime_${showtimeId}`).emit("seat_temporarily_reserved", {
                seatId: parseInt(seatId),
                socketId
            });

            res.status(200).json({ message: "Seat temporarily reserved" });
        } else {
            // Release reservation
            if (temporaryReservations[showtimeId][seatId]?.socketId === socketId) {
                delete temporaryReservations[showtimeId][seatId];
                
                // Notify all clients that reservation was released
                io.to(`showtime_${showtimeId}`).emit("seat_reservation_released", {
                    seatId: parseInt(seatId),
                    socketId
                });
                
                res.status(200).json({ message: "Seat reservation released" });
            } else {
                res.status(403).json({ message: "You can only release your own reservations" });
            }
        }
    } catch (error) {
        console.error("Error managing seat reservation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const bookSeats = async (req: AuthRequest, res: Response) => {
    const { showtimeId } = req.params;
    const { seatIds, socketId } = req.body;
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

        // Check if all seats are temporarily reserved by this user
        const invalidReservations = seatIds.filter(seatId => {
            const reservation = temporaryReservations[showtimeId]?.[seatId];
            return !reservation || reservation.socketId !== socketId;
        });

        if (invalidReservations.length > 0) {
            res.status(409).json({ 
                message: "Some seats are no longer available or were not reserved by you",
                invalidSeats: invalidReservations
            });
            return;
        }

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM Showtimes WHERE ShowtimeID = ? ",
            [showtimeId]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        // Check if seats are still available in the database
        for (const seatId of seatIds) {
            const [seatRows]: any = await db.execute(
                "SELECT * FROM Seats WHERE SeatID = ? AND ShowtimeID = ?",
                [seatId, showtimeId]
            );

            if (seatRows.length === 0) {
                res.status(404).json({ message: `Seat ID ${seatId} not found for this showtime `});
                return;
            }

            if (seatRows[0].AvailabilityStatus !== 'available') {
                res.status(409).json({ message: `SeatID ${seatId} is not available` });
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
                
                // Remove temporary reservation after successful booking
                if (temporaryReservations[showtimeId]?.[seatId]) {
                    delete temporaryReservations[showtimeId][seatId];
                }
            }

            await db.commit();

            // Notify all clients about the successful booking
            io.to(`showtime_${showtimeId}`).emit("seats_booked", {
                seatIds,
                socketId
            });

            const [movieDataRows]: any = await db.execute(`
                SELECT m.Title AS movieName, m.poster_url, s.StartTime, s.ScreenID, m.Duration
                FROM Showtimes s
                JOIN Movies m ON s.MovieID = m.MovieID
                WHERE s.ShowtimeID = ?
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
            "SELECT * FROM Bookings WHERE BookingID = ? AND UserID = ?",
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            res.status(404).json({ message: "You can only cancel your own bookings" });
            return;
        }

        const showtimeId = bookingRows[0].ShowtimeID;
        
        // Get seats associated with this booking
        const [seatRows]: any = await db.execute(
            "SELECT SeatID FROM Seats WHERE BookingID = ?",
            [bookingId]
        );
        
        const seatIds = seatRows.map((row: any) => row.SeatID);

        await db.beginTransaction();

        try {
            await db.execute(
                "UPDATE Bookings SET AvailabilityStatus = 'cancelled' WHERE BookingID = ?",
                [bookingId]
            );

            await db.execute(
                "UPDATE Seats SET AvailabilityStatus = 'available', BookingID = NULL WHERE BookingID = ?",
                [bookingId]
            );

            await db.commit();
            
            // Notify all clients about the cancelled booking
            io.to(`showtime_${showtimeId}`).emit("booking_cancelled", {
                seatIds
            });

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