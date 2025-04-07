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
        //CHECK FOR BOOKING ID

        await db.beginTransaction();

        try {
            const bookingDate = new Date().toISOString().split('T')[0];

            await db.execute(
                "INSERT INTO Bookings (UserID, ShowtimeID, BookingDate, AvailabilityStatus) VALUES (?, ?, ?, ?)",
                [userId, showtimeId, bookingDate, 'confirmed']
            );
        } catch (error) {

        }
    
    } catch (error) {

    }
}