// src/index.ts - Updated with report routes
import express from "express";
import cors from "cors";
import movieRoutes from "./routes/movieRoutes";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import showtimeRoutes from "./routes/showtimeRoutes";
import seatRoutes from "./routes/seatRoutes";
import staffRoutes from "./routes/staffRoutes";
import reportRoutes from "./routes/reportsRoutes";
import * as reportService from "./services/reportService";

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Server running!✅");
  
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

// shutting down
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  
  // loggin
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