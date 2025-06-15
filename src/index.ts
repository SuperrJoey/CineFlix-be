// src/index.ts
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import movieRoutes from "./routes/movieRoutes";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import showtimeRoutes from "./routes/showtimeRoutes";
import seatRoutes from "./routes/seatRoutes";
import staffRoutes from "./routes/staffRoutes";
import reportRoutes from "./routes/reportsRoutes";
import customerRoutes from "./routes/customerRoutes";
import * as reportService from "./services/reportService";

const app = express();

// CORS configuration with environment-based origins
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? ['https://cine-flix-inky.vercel.app/', 'https://cineflix-be.onrender.com']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server with environment-based CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  // Handle joining a showtime room
  socket.on("join_showtime", (showtimeId) => {
    socket.join(`showtime_${showtimeId}`);
  });
  
  // Handle seat selection
  socket.on("select_seat", ({ showtimeId, seatId, isSelected }) => {
    // Broadcast to all other clients in the same showtime room
    socket.to(`showtime_${showtimeId}`).emit("seat_selection_updated", {
      seatId,
      isSelected,
      socketId: socket.id
    });
  });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    // When a user disconnects, we could potentially release their temporary seat selections
    io.emit("user_disconnected", socket.id);
  });
});

// Export io instance to be used in controllers
export { io };

// Temporarily commented out to allow server startup without database
// TODO: Uncomment when database is properly configured
/*
// Log application startup
reportService.createReport(
  null,
  null,
  reportService.ReportType.SYSTEM,
  {
    action: "system_startup",
    details: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  }
).catch(err => {
  console.error("Failed to log system startup:", err);
});
*/

app.use("/api", movieRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/customers", customerRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}! ✅`);
  
  // Temporarily commented out to allow server startup without database
  // TODO: Uncomment when database is properly configured
  
  // Log server startup
  reportService.createReport(
    null,
    null,
    reportService.ReportType.SYSTEM,
    {
      action: "server_started",
      details: {
        port: PORT,
        timestamp: new Date().toISOString()
      }
    }
  ).catch(err => {
    console.error("Failed to log server startup:", err);
  });
  
});

// Shutting down
process.on('SIGINT', () => {
  
  // Temporarily commented out to allow server startup without database
  // TODO: Uncomment when database is properly configured
  /*
  // Logging
  reportService.createReport(
    null,
    null,
    reportService.ReportType.SYSTEM,
    {
      action: "server_shutdown",
      details: {
        reason: "SIGINT",
        timestamp: new Date().toISOString()
      }
    }
  ).catch(err => {
    console.error("Failed to log server shutdown:", err);
  }).finally(() => {
    process.exit(0);
  });
  */
  process.exit(0);
});