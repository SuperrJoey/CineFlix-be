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
exports.getCustomerById = exports.getAllCustomers = void 0;
const db_1 = __importDefault(require("../config/db"));
const reportService = __importStar(require("../services/reportService"));
const getAllCustomers = async (req, res) => {
    try {
        const db = await db_1.default;
        const [customers] = await db.execute(`
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
    }
    catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Server error while fetching customers" });
    }
};
exports.getAllCustomers = getAllCustomers;
const getCustomerById = async (req, res) => {
    const { customerId } = req.params;
    if (req.user?.role !== 'admin') {
        res.status(403).json({ message: "Access denied, admin privileges required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [customerRows] = await db.execute(`
            SELECT userid, username, name, role
            FROM users
            WHERE userid = $1 AND role = 'user'
        `, [customerId]);
        if (customerRows.length === 0) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const customer = customerRows[0];
        const [bookingRows] = await db.execute(`
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
        await reportService.createReport(req.user?.adminId || null, parseInt(customerId), reportService.ReportType.ADMIN_ACTION, {
            action: "customer_data_accessed",
            details: { customerId, accessedBy: req.user?.id },
            ip: req.ip
        });
        res.status(200).json({
            ...customer,
            bookings: bookingRows
        });
    }
    catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({ message: "Server error while fetching customer details" });
    }
};
exports.getCustomerById = getCustomerById;
