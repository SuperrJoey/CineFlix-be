import { Router } from "express";
import { getMovieById, getMovies } from "../controllers/movieController";

const router = Router();

router.get("/movies", getMovies);
router.get("/movies/:id", getMovieById);

export default router;
