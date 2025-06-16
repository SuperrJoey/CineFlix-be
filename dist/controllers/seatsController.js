"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserBookings = exports.cancelBooking = exports.bookSeats = exports.reserveSeat = exports.getSeatsByShowtime = void 0;
const db_1 = __importDefault(require("../config/db"));
const index_1 = require("../index");
const reportService = __importStar(require("../services/reportService"));
const temporaryReservations = {};
const RESERVATION_TIMEOUT = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    Object.keys(temporaryReservations).forEach(showtimeId => {
        Object.keys(temporaryReservations[showtimeId]).forEach(seatId => {
            const reservation = temporaryReservations[showtimeId][seatId];
            if (now - reservation.timestamp > RESERVATION_TIMEOUT) {
                delete temporaryReservations[showtimeId][seatId];
                index_1.io.to(`showtime_${showtimeId}`).emit("seat_reservation_expired", {
                    seatId: parseInt(seatId),
                    socketId: reservation.socketId
                });
            }
        });
    });
}, 60000);
const getSeatsByShowtime = async (req, res) => {
    const { showtimeId } = req.params;
    try {
        const db = await db_1.default;
        const [showtimeRows] = await db.execute("SELECT * FROM showtimes WHERE showtimeid = $1", [showtimeId]);
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }
        const [seatRows] = await db.execute(`
            SELECT seatid, seatnumber, showtimeid, availabilitystatus, bookingid
            FROM seats
            WHERE showtimeid = $1
            ORDER BY seatnumber        
        `, [showtimeId]);
        const seatsWithReservations = seatRows.map((seat) => {
            const temporarilyReserved = temporaryReservations[showtimeId]?.[seat.seatid];
            return {
                ...seat,
                temporarilyReserved: temporarilyReserved ? true : false
            };
        });
        res.status(200).json(seatsWithReservations);
    }
    catch (error) {
        console.error("Error fetching seats:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getSeatsByShowtime = getSeatsByShowtime;
const reserveSeat = async (req, res) => {
    const { showtimeId } = req.params;
    const { seatId, socketId, isReserving } = req.body;
    if (!seatId || !socketId) {
        res.status(400).json({ message: "Seat ID and Socket ID are required" });
        return;
    }
    try {
        if (!temporaryReservations[showtimeId]) {
            temporaryReservations[showtimeId] = {};
        }
        if (isReserving) {
            if (temporaryReservations[showtimeId][seatId]) {
                res.status(409).json({
                    message: "Seat is already reserved by another user",
                    reservedBy: temporaryReservations[showtimeId][seatId].socketId
                });
                return;
            }
            temporaryReservations[showtimeId][seatId] = {
                socketId,
                timestamp: Date.now()
            };
            index_1.io.to(`showtime_${showtimeId}`).emit("seat_temporarily_reserved", {
                seatId: parseInt(seatId),
                socketId
            });
            res.status(200).json({ message: "Seat temporarily reserved" });
        }
        else {
            if (temporaryReservations[showtimeId][seatId]?.socketId === socketId) {
                delete temporaryReservations[showtimeId][seatId];
                index_1.io.to(`showtime_${showtimeId}`).emit("seat_reservation_released", {
                    seatId: parseInt(seatId),
                    socketId
                });
                res.status(200).json({ message: "Seat reservation released" });
            }
            else {
                res.status(403).json({ message: "You can only release your own reservations" });
            }
        }
    }
    catch (error) {
        console.error("Error managing seat reservation:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.reserveSeat = reserveSeat;
const bookSeats = async (req, res) => {
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
        const db = await db_1.default;
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
        const [showtimeRows] = await db.execute("SELECT * FROM showtimes WHERE showtimeid = $1", [showtimeId]);
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }
        for (const seatId of seatIds) {
            const [seatRows] = await db.execute("SELECT * FROM seats WHERE seatid = $1 AND showtimeid = $2", [seatId, showtimeId]);
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
            const [bookingResult] = await db.execute("INSERT INTO bookings (userid, showtimeid, bookingdate, availabilitystatus) VALUES ($1, $2, $3, 'confirmed') RETURNING bookingid", [userId, showtimeId, bookingDate]);
            const bookingId = bookingResult[0].bookingid;
            for (const seatId of seatIds) {
                await db.execute("UPDATE seats SET availabilitystatus = 'booked', bookingid = $1 WHERE seatid = $2", [bookingId, seatId]);
                if (temporaryReservations[showtimeId]?.[seatId]) {
                    delete temporaryReservations[showtimeId][seatId];
                }
            }
            await db.commit();
            await reportService.createReport(null, userId, reportService.ReportType.BOOKING, {
                action: "seats_booked",
                details: {
                    bookingId,
                    showtimeId,
                    seatIds,
                    totalSeats: seatIds.length,
                    bookingDate
                },
                ip: req.ip
            });
            index_1.io.to(`showtime_${showtimeId}`).emit("seats_booked", {
                seatIds: seatIds.map(id => parseInt(id)),
                bookingId,
                socketId
            });
            res.status(201).json({
                message: "Seats booked successfully",
                bookingId,
                seatIds
            });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error booking seats:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.bookSeats = bookSeats;
const cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "User must be logged in" });
        return;
    }
    try {
        const db = await db_1.default;
        const [bookingRows] = await db.execute("SELECT * FROM bookings WHERE bookingid = $1 AND userid = $2", [bookingId, userId]);
        if (bookingRows.length === 0) {
            res.status(404).json({ message: "Booking not found or doesn't belong to you" });
            return;
        }
        const booking = bookingRows[0];
        const showtimeId = booking.showtimeid;
        const [showtimeRows] = await db.execute("SELECT starttime FROM showtimes WHERE showtimeid = $1", [showtimeId]);
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
            const [seatRows] = await db.execute("SELECT seatid FROM seats WHERE bookingid = $1", [bookingId]);
            const seatIds = seatRows.map((seat) => seat.seatid);
            await db.execute("UPDATE seats SET availabilitystatus = 'available', bookingid = NULL WHERE bookingid = $1", [bookingId]);
            await db.execute("UPDATE bookings SET availabilitystatus = 'cancelled' WHERE bookingid = $1", [bookingId]);
            await db.commit();
            await reportService.createReport(null, userId, reportService.ReportType.BOOKING, {
                action: "booking_cancelled",
                details: {
                    bookingId,
                    showtimeId,
                    seatIds,
                    totalSeats: seatIds.length
                },
                ip: req.ip
            });
            index_1.io.to(`showtime_${showtimeId}`).emit("booking_cancelled", {
                seatIds,
                bookingId
            });
            res.status(200).json({
                message: "Booking cancelled successfully",
                bookingId,
                releasedSeats: seatIds
            });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.cancelBooking = cancelBooking;
const getUserBookings = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "User must be logged in" });
        return;
    }
    try {
        const db = await db_1.default;
        const [bookingRows] = await db.execute(`
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
        const formattedBookings = bookingRows.map((booking) => ({
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
            seatNumbers: booking.seat_numbers ? booking.seat_numbers.split(',').map((n) => parseInt(n)) : []
        }));
        res.status(200).json(formattedBookings);
    }
    catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getUserBookings = getUserBookings;
