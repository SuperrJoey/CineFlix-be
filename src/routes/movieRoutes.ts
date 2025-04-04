import { Router } from "express";
import { addMovie, getMovieById, getMovies } from "../controllers/movieController";
import { authenticateToken } from "../middleware/auth";
import { adminOnly, hasPermission } from "../middleware/adminOnly";

const router = Router();

router.get("/movies", getMovies);
router.get("/movies/:id", getMovieById);

router.post("/movies", authenticateToken, adminOnly, hasPermission("movies", "write"), addMovie);

export default router;

