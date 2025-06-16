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
exports.deleteShowtime = exports.updateShowtime = exports.addShowtime = exports.getShowtimesByMovie = exports.getShowtimeById = exports.getShowtimes = void 0;
const db_1 = __importDefault(require("../config/db"));
const reportService = __importStar(require("../services/reportService"));
const getShowtimes = async (req, res) => {
    try {
        const db = await db_1.default;
        const [showtimes] = await db.execute(`
            SELECT s.showtimeid, s.movieid, s.starttime, s.endtime,
                   m.title, m.genre, m.duration
            FROM showtimes s 
            JOIN movies m ON s.movieid = m.movieid
            ORDER BY s.starttime ASC
        `);
        res.status(200).json(showtimes);
    }
    catch (error) {
        console.error("Error fetching showtimes:", error);
        res.status(500).json({ message: "Server Error" });
    }
};
exports.getShowtimes = getShowtimes;
const getShowtimeById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        const [showtimeRows] = await db.execute(`
            SELECT s.showtimeid, s.movieid, s.starttime, s.endtime,
                   m.title, m.genre, m.duration
            FROM showtimes s 
            JOIN movies m ON s.movieid = m.movieid
            WHERE s.showtimeid = $1
        `, [id]);
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }
        const [seatRows] = await db.execute(`
            SELECT seatid, seatnumber, availabilitystatus 
            FROM seats
            WHERE showtimeid = $1
            ORDER BY seatnumber ASC
        `, [id]);
        const showtime = {
            ...showtimeRows[0],
            seats: seatRows
        };
        res.status(200).json(showtime);
    }
    catch (error) {
        console.error("Error fetching showtime details:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getShowtimeById = getShowtimeById;
const getShowtimesByMovie = async (req, res) => {
    const { movieId } = req.params;
    try {
        const db = await db_1.default;
        const [rows] = await db.execute(`
            SELECT 
                s.showtimeid, s.movieid, s.starttime, s.endtime,
                m.title, m.genre, m.duration,
                se.seatid, se.seatnumber, se.availabilitystatus
            FROM showtimes s
            JOIN movies m ON s.movieid = m.movieid
            LEFT JOIN seats se ON s.showtimeid = se.showtimeid
            WHERE m.movieid = $1
            ORDER BY s.starttime ASC, se.seatnumber ASC
        `, [movieId]);
        const showtimeMap = new Map();
        for (const row of rows) {
            const { showtimeid, movieid, starttime, endtime, title, genre, duration, seatid, seatnumber, availabilitystatus } = row;
            if (!showtimeMap.has(showtimeid)) {
                showtimeMap.set(showtimeid, {
                    showtimeid,
                    movieid,
                    starttime,
                    endtime,
                    title,
                    genre,
                    duration,
                    seats: []
                });
            }
            if (seatid) {
                showtimeMap.get(showtimeid).seats.push({
                    seatid,
                    seatnumber,
                    availabilitystatus
                });
            }
        }
        const showtimesWithSeats = Array.from(showtimeMap.values());
        res.status(200).json(showtimesWithSeats);
    }
    catch (error) {
        console.error("Error fetching movie showtimes:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getShowtimesByMovie = getShowtimesByMovie;
const addShowtime = async (req, res) => {
    const { movieId, startTime, totalSeats } = req.body;
    if (!movieId || !startTime || !totalSeats) {
        res.status(400).json({ message: "All fields required here" });
        return;
    }
    try {
        const db = await db_1.default;
        const [movieRows] = await db.execute("SELECT * FROM movies WHERE movieid = $1", [parseInt(movieId)]);
        if (movieRows.length === 0) {
            res.status(404).json({ message: "Movie not found" });
            return;
        }
        const duration = movieRows[0].duration;
        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(startTimeDate.getTime() + duration * 60000);
        const [conflictRows] = await db.execute(`
            SELECT s.* FROM showtimes s
            JOIN movies m ON s.movieid = m.movieid
            WHERE (s.starttime < $1 AND s.endtime > $2) OR
                  (s.starttime < $3 AND s.endtime > $4) OR
                  (s.starttime >= $5 AND s.starttime < $6)
        `, [endTimeDate, startTimeDate, endTimeDate, startTimeDate, startTimeDate, endTimeDate]);
        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime" });
            return;
        }
        await db.beginTransaction();
        try {
            const [showtimeResult] = await db.execute("INSERT INTO showtimes (movieid, starttime, endtime) VALUES ($1, $2, $3) RETURNING showtimeid", [parseInt(movieId), startTime, endTimeDate]);
            const showtimeId = showtimeResult[0].showtimeid;
            for (let i = 1; i <= totalSeats; i++) {
                await db.execute("INSERT INTO seats (showtimeid, seatnumber, availabilitystatus) VALUES ($1, $2, $3)", [showtimeId, i, "available"]);
            }
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, req.user?.id || null, reportService.ReportType.ADMIN_ACTION, {
                action: "showtime_added",
                details: { movieId, showtimeId, startTime, endTime: endTimeDate, totalSeats },
                ip: req.ip
            });
            res.status(201).json({
                message: "Showtime added successfully",
                showtimeId: showtimeId
            });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error adding showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.addShowtime = addShowtime;
const updateShowtime = async (req, res) => {
    const { id } = req.params;
    const { movieId, startTime } = req.body;
    if (!movieId || !startTime) {
        res.status(400).json({ message: "Movie ID and start time are required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [existingShowtime] = await db.execute("SELECT * FROM showtimes WHERE showtimeid = $1", [id]);
        if (existingShowtime.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }
        const [movieRows] = await db.execute("SELECT duration FROM movies WHERE movieid = $1", [parseInt(movieId)]);
        if (movieRows.length === 0) {
            res.status(404).json({ message: "Movie not found" });
            return;
        }
        const duration = movieRows[0].duration;
        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(startTimeDate.getTime() + duration * 60000);
        const [conflictRows] = await db.execute(`
            SELECT s.* FROM showtimes s
            WHERE s.showtimeid != $1 AND
                  ((s.starttime < $2 AND s.endtime > $3) OR
                   (s.starttime < $4 AND s.endtime > $5) OR
                   (s.starttime >= $6 AND s.starttime < $7))
        `, [id, endTimeDate, startTimeDate, endTimeDate, startTimeDate, startTimeDate, endTimeDate]);
        if (conflictRows.length > 0) {
            res.status(409).json({ message: "This timeslot conflicts with an existing showtime" });
            return;
        }
        await db.beginTransaction();
        try {
            await db.execute("UPDATE showtimes SET movieid = $1, starttime = $2, endtime = $3 WHERE showtimeid = $4", [parseInt(movieId), startTime, endTimeDate, id]);
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, req.user?.id || null, reportService.ReportType.ADMIN_ACTION, {
                action: "showtime_updated",
                details: { showtimeId: id, movieId, startTime, endTime: endTimeDate },
                ip: req.ip
            });
            res.status(200).json({ message: "Showtime updated successfully" });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error updating showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateShowtime = updateShowtime;
const deleteShowtime = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        const [showtimeRows] = await db.execute("SELECT * FROM showtimes WHERE showtimeid = $1", [id]);
        if (showtimeRows.length === 0) {
            res.status(404).json({ message: "Showtime not found" });
            return;
        }
        const [bookingRows] = await db.execute("SELECT * FROM bookings WHERE showtimeid = $1", [id]);
        if (bookingRows.length > 0) {
            res.status(400).json({ message: "Cannot delete showtime with existing bookings" });
            return;
        }
        await db.beginTransaction();
        try {
            await db.execute("DELETE FROM seats WHERE showtimeid = $1", [id]);
            await db.execute("DELETE FROM showtimes WHERE showtimeid = $1", [id]);
            await db.commit();
            await reportService.createReport(req.user?.adminId || null, req.user?.id || null, reportService.ReportType.ADMIN_ACTION, {
                action: "showtime_deleted",
                details: { showtimeId: id },
                ip: req.ip
            });
            res.status(200).json({ message: "Showtime deleted successfully" });
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error("Error deleting showtime:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteShowtime = deleteShowtime;
