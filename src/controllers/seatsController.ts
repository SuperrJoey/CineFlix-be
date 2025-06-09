import { Request, Response } from "express";
import { AuthRequest } from "../types/express";
import dbPromise from "../config/db";
import { io } from "../index";
import * as reportService from "../services/reportService";

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
                
                // Released expired reservation
            }
        });
    });
}, 60000);

export const getSeatsByShowtime = async (req: Request, res: Response) => {
    const { showtimeId } = req.params;

    try {
        const db = await dbPromise;

        const [showtimeRows]: any = await db.execute(
            "SELECT * FROM showtimes WHERE showtimeid = $1",
            [showtimeId]
        );
    
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        const [seatRows]: any = await db.execute(`
            SELECT seatid, seatnumber, showtimeid, availabilitystatus, bookingid
            FROM seats
            WHERE showtimeid = $1
            ORDER BY seatnumber        
        `, [showtimeId]);

        // Add temporary reservation status to the response
        const seatsWithReservations = seatRows.map((seat: any) => {
            const temporarilyReserved = temporaryReservations[showtimeId]?.[seat.seatid];
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
            "SELECT * FROM showtimes WHERE showtimeid = $1",
            [showtimeId]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        // Check if seats are still available in the database
        for (const seatId of seatIds) {
            const [seatRows]: any = await db.execute(
                "SELECT * FROM seats WHERE seatid = $1 AND showtimeid = $2",
                [seatId, showtimeId]
            );

            if (seatRows.length === 0) {
                res.status(404).json({ message: `Seat ID ${seatId} not found for this showtime` });
                return;
            }

            if (seatRows[0].availabilitystatus !== 'available') {
                res.status(409).json({ message: `Seat ID ${seatId} is not available` });
                return;
            }
        }

        await db.beginTransaction();

        try {
            const bookingDate = new Date().toISOString().split('T')[0];

            const [bookingResult]: any = await db.execute(
                "INSERT INTO bookings (userid, showtimeid, bookingdate, availabilitystatus) VALUES ($1, $2, $3, 'confirmed') RETURNING bookingid",
                [userId, showtimeId, bookingDate]
            );

            const bookingId = bookingResult[0].bookingid;

            // Update all selected seats
            for (const seatId of seatIds) {
                await db.execute(
                    "UPDATE seats SET availabilitystatus = 'booked', bookingid = $1 WHERE seatid = $2",
                    [bookingId, seatId]
                );

                // Remove temporary reservation
                if (temporaryReservations[showtimeId]?.[seatId]) {
                    delete temporaryReservations[showtimeId][seatId];
                }
            }

            await db.commit();

            // Create audit report
            await reportService.createReport(
                null,
                userId,
                reportService.ReportType.BOOKING,
                {
                    action: "seats_booked",
                    details: { 
                        bookingId, 
                        showtimeId, 
                        seatIds, 
                        totalSeats: seatIds.length,
                        bookingDate 
                    },
                    ip: req.ip
                }
            );

            // Notify all clients about the seat bookings
            io.to(`showtime_${showtimeId}`).emit("seats_booked", {
                seatIds: seatIds.map(id => parseInt(id)),
                bookingId,
                socketId
            });

            res.status(201).json({
                message: "Seats booked successfully",
                bookingId,
                seatIds
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
        res.status(401).json({ message: "User must be logged in" });
        return;
    }

    try {
        const db = await dbPromise;

        // Check if booking exists and belongs to the user
        const [bookingRows]: any = await db.execute(
            "SELECT * FROM bookings WHERE bookingid = $1 AND userid = $2",
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            res.status(404).json({ message: "Booking not found or doesn't belong to you" });
            return;
        }

        const booking = bookingRows[0];
        const showtimeId = booking.showtimeid;

        // Check if showtime has already started (prevent cancellation)
        const [showtimeRows]: any = await db.execute(
            "SELECT starttime FROM showtimes WHERE showtimeid = $1",
            [showtimeId]
        );

        if (showtimeRows.length > 0) {
            const showtimeStart = new Date(showtimeRows[0].starttime);
            const now = new Date();
            
            if (now >= showtimeStart) {
                res.status(400).json({ message: "Cannot cancel booking after showtime has started" });
                return;
            }
        }

        await db.beginTransaction();

        try {
            // Get all seats for this booking
            const [seatRows]: any = await db.execute(
                "SELECT seatid FROM seats WHERE bookingid = $1",
                [bookingId]
            );

            const seatIds = seatRows.map((seat: any) => seat.seatid);

            // Update seats to be available again
            await db.execute(
                "UPDATE seats SET availabilitystatus = 'available', bookingid = NULL WHERE bookingid = $1",
                [bookingId]
            );

            // Update booking status
            await db.execute(
                "UPDATE bookings SET availabilitystatus = 'cancelled' WHERE bookingid = $1",
                [bookingId]
            );

            await db.commit();

            // Create audit report
            await reportService.createReport(
                null,
                userId,
                reportService.ReportType.BOOKING,
                {
                    action: "booking_cancelled",
                    details: { 
                        bookingId, 
                        showtimeId, 
                        seatIds, 
                        totalSeats: seatIds.length 
                    },
                    ip: req.ip
                }
            );

            // Notify all clients about the cancellation
            io.to(`showtime_${showtimeId}`).emit("booking_cancelled", {
                seatIds,
                bookingId
            });

            res.status(200).json({
                message: "Booking cancelled successfully",
                bookingId,
                releasedSeats: seatIds
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getUserBookings = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ message: "User must be logged in" });
        return;
    }

    try {
        const db = await dbPromise;

        const [bookingRows]: any = await db.execute(`
            SELECT 
                b.bookingid, 
                b.showtimeid, 
                b.bookingdate, 
                b.availabilitystatus as booking_status,
                s.starttime,
                s.endtime,
                m.title as movie_title,
                m.genre,
                m.duration,
                STRING_AGG(se.seatnumber::text, ',' ORDER BY se.seatnumber) as seat_numbers
            FROM bookings b
            JOIN showtimes s ON b.showtimeid = s.showtimeid
            JOIN movies m ON s.movieid = m.movieid
            LEFT JOIN seats se ON b.bookingid = se.bookingid
            WHERE b.userid = $1
            GROUP BY b.bookingid, b.showtimeid, b.bookingdate, b.availabilitystatus,
                     s.starttime, s.endtime, m.title, m.genre, m.duration
            ORDER BY b.bookingdate DESC, s.starttime DESC
        `, [userId]);

        // Format the response
        const formattedBookings = bookingRows.map((booking: any) => ({
            bookingId: booking.bookingid,
            showtimeId: booking.showtimeid,
            bookingDate: booking.bookingdate,
            bookingStatus: booking.booking_status,
            showtime: {
                startTime: booking.starttime,
                endTime: booking.endtime
            },
            movie: {
                title: booking.movie_title,
                genre: booking.genre,
                duration: booking.duration
            },
            seatNumbers: booking.seat_numbers ? booking.seat_numbers.split(',').map((n: string) => parseInt(n)) : []
        }));

        res.status(200).json(formattedBookings);
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};