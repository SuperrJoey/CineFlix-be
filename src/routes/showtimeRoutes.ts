import { Router} from "express";
import {
    getShowtimes,
    getShowtimeById,
    getShowtimesByMovie,
    addShowtime,
    updateShowtime,
    deleteShowtime
} from "../controllers/showtimesController"
import { authenticateToken } from "../middleware/auth";
import { adminOnly, hasPermission } from "../middleware/adminOnly";

const router = Router();

router.get("/", getShowtimes);
router.get("/:id", getShowtimeById);
router.get("/movie/:movieId", getShowtimesByMovie);

router.post(
    "/",
    authenticateToken,
    adminOnly,
    hasPermission("showtimes", "write"),
    addShowtime
)

router.put(
    "/:id",
    authenticateToken,
    adminOnly,
    hasPermission("showtimes", "write"),
    updateShowtime
);

router.delete(
    "/:id",
    authenticateToken,
    adminOnly,
    hasPermission("showtimes", "delete"),
    deleteShowtime
);

export default router;