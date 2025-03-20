import { Router } from "express";
import { getMovies } from "../controllers/movieController";

const router = Router();

router.get("/movies", getMovies);

export default router;
