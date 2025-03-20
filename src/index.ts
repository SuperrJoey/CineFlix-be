import express from "express";
import cors from "cors";
import movieRoutes from "./routes/movieRoutes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", movieRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log("Server running!✅"))
