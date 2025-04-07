import express from "express";
import cors from "cors";
import movieRoutes from "./routes/movieRoutes";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import showtimeRoutes from  "./routes/showtimeRoutes";
import seatRoutes from "./routes/seatRoutes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", movieRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/seats", seatRoutes);


const PORT = 5000;
app.listen(PORT, () => console.log("Server running!✅"))
