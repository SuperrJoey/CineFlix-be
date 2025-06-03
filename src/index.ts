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
app.use(cors({
  origin: "http://localhost:5173", // Your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  
  // Handle joining a showtime room
  socket.on("join_showtime", (showtimeId) => {
    socket.join(`showtime_${showtimeId}`);
    console.log(`User ${socket.id} joined showtime ${showtimeId}`);
  });
  
  // Handle seat selection
  socket.on("select_seat", ({ showtimeId, seatId, isSelected }) => {
    console.log(`User ${socket.id} ${isSelected ? 'selected' : 'deselected'} seat ${seatId} in showtime ${showtimeId}`);
    // Broadcast to all other clients in the same showtime room
    socket.to(`showtime_${showtimeId}`).emit("seat_selection_updated", {
      seatId,
      isSelected,
      socketId: socket.id
    });
  });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // When a user disconnects, we could potentially release their temporary seat selections
    io.emit("user_disconnected", socket.id);
  });
});

// Export io instance to be used in controllers
export { io };

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

app.use("/api", movieRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/customers", customerRoutes);

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}! ✅`);
  
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
  console.log('Server shutting down...');
  
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
});