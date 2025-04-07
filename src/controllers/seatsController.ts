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
            "SELCT * FROM Showtimes WHERE ShowtimeID = ? ",
            [showtimeId]
        );

        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }

        for (const SeatId of seatIds) {
            const [seatRows]: any = await db.execute(
                "SELCT * FROM Seats WHERE SeatID = ? AND ShowtimeID = ?",
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
        const [maxBookingIdRows]: any = await db.execute(
            "SELECT MAX(BookingID) as maxId FROM Bookings"
        );
        const nextBookingId = (maxBookingIdRows[0].maxId || 0) + 1;

        await db.beginTransaction();

        try {
            const bookingDate = new Date().toISOString().split('T')[0];

            await db.execute(
                "INSERT INTO Bookings (BookingID, UserID, ShowtimeID, BookingDate, AvailabilityStatus) VALUES (?, ?, ?, ?)",
                [nextBookingId, userId, showtimeId, bookingDate, 'confirmed']
            );

            for (const seatId of seatIds) {
                await db.execute(
                    "UPDATE Seats SET AvailabilityStatus = 'booked', BookingID = ? WHERE SeatID = ?",
                    [nextBookingId, seatId]
                );
            }

            await db.commit();

            res.status(201).json({
                message: "Seats booked successfully",
                bookingId: nextBookingId,
                seatIds: seatIds
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
                "UPDATE Bookings SET AvailabilityStatus = 'cancelled' WHERE BookingID  ?",
                [bookingId]
            );

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
}