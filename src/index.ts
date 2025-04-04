import express from "express";
import cors from "cors";
import movieRoutes from "./routes/movieRoutes";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", movieRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);


const PORT = 5000;
app.listen(PORT, () => console.log("Server running!✅"))
