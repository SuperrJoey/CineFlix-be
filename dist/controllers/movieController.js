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
exports.updateMoviesMetadata = exports.addMovie = exports.getMovieById = exports.getMovies = void 0;
const db_1 = __importDefault(require("../config/db"));
const tmdbService = __importStar(require("../services/tmdbService"));
const getMovies = async (req, res) => {
    try {
        const db = await db_1.default;
        const [movies] = await db.execute("SELECT * FROM movies");
        res.json(movies);
    }
    catch (error) {
        console.error("Database error: ", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getMovies = getMovies;
const getMovieById = async (req, res) => {
    const { id } = req.params;
    try {
        const db = await db_1.default;
        const [rows] = await db.execute("SELECT * FROM movies WHERE MovieID = $1", [id]);
        if (rows.length === 0) {
            res.status(404).json({ message: "Movie not found" });
            return;
        }
        const movie = rows[0];
        res.json(movie);
    }
    catch (error) {
        console.error("Error fetching movie:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getMovieById = getMovieById;
const addMovie = async (req, res) => {
    const { title, genre, rating, duration } = req.body;
    if (!title || !genre || !rating || !duration) {
        res.status(400).json({ message: "All fields are required! " });
        return;
    }
    try {
        const db = await db_1.default;
        const [existingMovies] = await db.execute("SELECT * FROM movies WHERE Title = $1 AND duration = $2", [title, duration]);
        if (existingMovies.length > 0) {
            res.status(409).json({ message: "This movie already exists in the database" });
            return;
        }
        let posterUrl = null;
        let overview = null;
        try {
            const searchResults = await tmdbService.searchMovie(title);
            if (searchResults && searchResults.length > 0) {
                const posterPath = searchResults[0].poster_path;
                posterUrl = tmdbService.getFullPosterUrl(posterPath);
                overview = searchResults[0].overview;
            }
        }
        catch (error) {
            console.error("Error fetching TMDB data:", error);
        }
        await db.execute("INSERT INTO movies (Title, Genre, Rating, Duration, poster_url, overview) VALUES ($1, $2, $3, $4, $5, $6)", [title, genre, rating, duration, posterUrl, overview]);
        res.status(201).json({
            message: "Movie added successfully",
            movie: {
                Title: title,
                Genre: genre,
                Duration: duration,
                poster_url: posterUrl,
                overview,
            }
        });
    }
    catch (error) {
        console.error("Error adding movie: ", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.addMovie = addMovie;
const updateMoviesMetadata = async (req, res) => {
    try {
        const db = await db_1.default;
        const [movies] = await db.execute("SELECT * FROM movies WHERE poster_url IS NULL OR overview is NULL");
        let updatedCount = 0;
        for (const movie of movies) {
            try {
                const searchResults = await tmdbService.searchMovie(movie.title);
                if (searchResults && searchResults.length > 0) {
                    const posterPath = searchResults[0].poster_path;
                    const posterUrl = tmdbService.getFullPosterUrl(posterPath);
                    const overview = searchResults[0].overview;
                    await db.execute("UPDATE movies SET poster_url = $1, overview = $2 WHERE MovieID = $3", [posterUrl, overview, movie.movieid]);
                    updatedCount++;
                }
            }
            catch (error) {
                console.error(`Error updating metadata for movie ${movie.title}: `, error);
            }
        }
        res.json({ message: `Updated metadata for ${updatedCount} movies ` });
    }
    catch (error) {
        console.error("Error updating movie metadata:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateMoviesMetadata = updateMoviesMetadata;
