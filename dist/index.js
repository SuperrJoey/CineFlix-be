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
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const movieRoutes_1 = __importDefault(require("./routes/movieRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const showtimeRoutes_1 = __importDefault(require("./routes/showtimeRoutes"));
const seatRoutes_1 = __importDefault(require("./routes/seatRoutes"));
const staffRoutes_1 = __importDefault(require("./routes/staffRoutes"));
const reportsRoutes_1 = __importDefault(require("./routes/reportsRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const reportService = __importStar(require("./services/reportService"));
const app = (0, express_1.default)();
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://cine-flix-inky.vercel.app', 'https://cineflix-be.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000'];
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
exports.io = io;
io.on("connection", (socket) => {
    socket.on("join_showtime", (showtimeId) => {
        socket.join(`showtime_${showtimeId}`);
    });
    socket.on("select_seat", ({ showtimeId, seatId, isSelected }) => {
        socket.to(`showtime_${showtimeId}`).emit("seat_selection_updated", {
            seatId,
            isSelected,
            socketId: socket.id
        });
    });
    socket.on("disconnect", () => {
        io.emit("user_disconnected", socket.id);
    });
});
app.use("/api", movieRoutes_1.default);
app.use("/api/auth", authRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/showtimes", showtimeRoutes_1.default);
app.use("/api/seats", seatRoutes_1.default);
app.use("/api/staff", staffRoutes_1.default);
app.use("/api/reports", reportsRoutes_1.default);
app.use("/api/customers", customerRoutes_1.default);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}! ✅`);
    reportService.createReport(null, null, reportService.ReportType.SYSTEM, {
        action: "server_started",
        details: {
            port: PORT,
            timestamp: new Date().toISOString()
        }
    }).catch(err => {
        console.error("Failed to log server startup:", err);
    });
});
process.on('SIGINT', () => {
    process.exit(0);
});
