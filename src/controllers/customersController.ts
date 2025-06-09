import { Request, Response } from "express";
import { AuthRequest } from "../types/express";
import dbPromise from "../config/db";
import * as reportService from "../services/reportService";

export const getAllCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        const db = await dbPromise;

        const [customers]: any = await db.execute(`
            SELECT 
                u.userid, u.username, u.name, u.role,
                COUNT(DISTINCT b.bookingid) as totalbookings
            FROM 
                users u
            LEFT JOIN 
                bookings b ON u.userid = b.userid
            WHERE 
                u.role = 'user'
            GROUP BY 
                u.userid, u.username, u.name, u.role
            ORDER BY u.name
        `);

        res.status(200).json(customers);
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
            SELECT userid, username, name, role
            FROM users
            WHERE userid = $1 AND role = 'user'
        `, [customerId]);

        if (customerRows.length === 0) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }

        const customer = customerRows[0];

        const [bookingRows]: any = await db.execute(`
            SELECT 
                b.bookingid, b.showtimeid, b.bookingdate, b.availabilitystatus,
                m.title as movietitle, m.genre, s.starttime,
                COUNT(st.seatid) as seatcount
            FROM 
                bookings b
            JOIN 
                showtimes s ON b.showtimeid = s.showtimeid
            JOIN 
                movies m ON s.movieid = m.movieid
            LEFT JOIN 
                seats st ON b.bookingid = st.bookingid
            WHERE 
                b.userid = $1
            GROUP BY 
                b.bookingid, b.showtimeid, b.bookingdate, b.availabilitystatus,
                m.title, m.genre, s.starttime
            ORDER BY 
                b.bookingdate DESC, s.starttime DESC
        `, [customerId]);

        // Create audit report for customer data access
        await reportService.createReport(
            req.user?.adminId || null,
            parseInt(customerId),
            reportService.ReportType.ADMIN_ACTION,
            {
                action: "customer_data_accessed",
                details: { customerId, accessedBy: req.user?.id },
                ip: req.ip
            }
        );

        res.status(200).json({
            ...customer,
            bookings: bookingRows
        });
    } catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({ message: "Server error while fetching customer details" });
    }
};
