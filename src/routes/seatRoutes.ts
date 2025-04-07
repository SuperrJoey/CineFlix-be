import { Router } from "express";
import { 
    getSeatsByShowtime,
    bookSeats,
    cancelBooking,
    getUserBookings
 } from "../controllers/seatsController";
 import { authenticateToken } from "../middleware/auth";

 const router = Router();

 router.get("/showtime/:showtimeId", getSeatsByShowtime);

 router.post("/showtime/:showtimeId/book", authenticateToken, bookSeats);
 router.put("/booking/:bookingId/cancel", authenticateToken, cancelBooking);
 router.get("/bookings", authenticateToken, getUserBookings);

 export default router;