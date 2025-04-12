import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import dbPromise from "../config/db";
import * as reportService from "../services/reportService";

export const getAllCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        const db = await dbPromise;

        const [customers]: any = await db.execute(`
            SELECT 
                u.UserID, u.username, u.name, u.role,
                COUNT(DISTINCT b.BookingID) as totalBookings
            FROM 
                users u
            LEFT JOIN 
                Bookings b ON u.UserID = b.UserID
            WHERE 
                u.role = 'user'
            GROUP BY 
                u.UserID
        `);

        res.status(200).json(customers); // <- don't `return` this
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Server error while fetching customers" });
    }
};

export const getCustomerById = async (req: AuthRequest, res: Response): Promise<void> => {
    const { customerId } = req.params;

    if (req.user?.role !== 'admin') {
        res.status(403).json({ message: "Access denied, admin privileges required" });
        return;
    }

    try {
        const db = await dbPromise;

        const [customerRows]: any = await db.execute(`
            SELECT UserID, username, name, role
            FROM users
            WHERE UserID = ? AND role = 'user'
        `, [customerId]);

        if (customerRows.length === 0) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }

        const customer = customerRows[0];

        const [bookingRows]: any = await db.execute(`
            SELECT 
                b.BookingID, b.ShowtimeID, b.BookingDate, b.AvailabilityStatus,
                m.Title as movieTitle, m.Genre, s.StartTime, s.ScreenID,
                COUNT(st.SeatID) as seatCount
            FROM 
                Bookings b
            JOIN 
                Showtimes s ON b.ShowtimeID = s.ShowtimeID
            JOIN 
                Movies m ON s.MovieID = m.MovieID
            LEFT JOIN 
                Seats st ON b.BookingID = st.BookingID
            WHERE 
                b.UserID = ?
            GROUP BY 
                b.BookingID
            ORDER BY 
                b.BookingDate DESC, s.StartTime DESC
        `, [customerId]);

        res.status(200).json({
            ...customer,
            bookings: bookingRows
        });
    } catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({ message: "Server error while fetching customer details" });
    }
};
