import { Router } from "express";
import { addMovie, getMovieById, getMovies, updateMoviesMetadata } from "../controllers/movieController";
import { authenticateToken } from "../middleware/auth";
import { adminOnly, hasPermission } from "../middleware/adminOnly";

const router = Router();

router.get("/movies", getMovies);
router.get("/movies/:id", getMovieById);

router.post("/movies", authenticateToken, adminOnly, hasPermission("movies", "write"), addMovie);
router.post("/movies/update-metadata", authenticateToken, adminOnly, hasPermission("movies", "write"), updateMoviesMetadata)

export default router;

