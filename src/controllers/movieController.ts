import { Request, Response} from "express";
import dbPromise from "../config/db";
import * as tmdbService from "../services/tmdbService";

export const getMovies = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [movies]: any = await db.execute("SELECT * FROM movies");
        
        // const moviesWithPosters =  await Promise.all(
        //     movies.map(async (movie: any) => {
        //         try {
        //             const searchResults = await tmdbService.searchMovie(movie.Title);
    
        //             if (searchResults && searchResults.length > 0) {
        //                 const posterPath = searchResults[0].poster_path;
        //                 const overview = searchResults[0].overview;
        //                 return {
        //                     ...movie,
        //                     poster_url: tmdbService.getFullPosterUrl(posterPath),
        //                     overview
        //                 };
        //             }
    
        //             return {
        //                 ...movie,
        //                 poster_url: null,
        //                 overview: null
        //             };
        //         } catch (error) {
        //             console.error(`Error fetching poster for ${movie.title}:`, error);
        //             return {
        //                 ...movie,
        //                 poster_url: null,
        //                 overview: null
        //             };
        //         }
        //     })
        // );

        // res.json(moviesWithPosters);
        res.json(movies);
    } catch (error) {
        console.error("Database error: ", error);
        res.status(500).json({message: "Server error"});
    }
}

export const getMovieById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const db = await dbPromise;
        const [rows]: any = await db.execute("SELECT * FROM movies WHERE MovieID = ?", [id]);

        if (rows.length === 0) {
             res.status(404).json({ message: "Movie not found" });
            return;
            }

        const movie = rows[0]; 

        // try {
        //     const searchResults = await tmdbService.searchMovie(movie.Title);

        //     if (searchResults && searchResults.length > 0) {
        //         const posterPath = searchResults[0].poster_path;
        //         movie.poster_url = tmdbService.getFullPosterUrl(posterPath);
        //         movie.overview = searchResults[0].overview;
        //     } else {
        //         movie.poster_url = null;
        //         movie.overview = null;
        //     }
        // } catch (error) {
        //     console.error("Error fetching TMDB data:", error);
        //     movie.poster_url = null;
        //     movie.overview = null;
        // }
        
        res.json(movie);
    } catch (error) {
        console.error("Error fetching movie:", error);
        res.status(500).json({ message: "Server error" });
    }
}

export const addMovie = async (req: Request, res: Response) => {
    const { title, genre, rating , duration } = req.body;

    if (!title || !genre || !rating || !duration ) {
        res.status(400).json({ message: "All fields are required! "});
        return;
    }

    try {
        const db = await dbPromise;

        const [existingMovies]:any = await db.execute(
            "SELECT * FROM movies WHERE Title = ? AND duration = ?", 
            [title, duration]
        );

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
        } catch (error) {
            console.error("Error fetching TMDB data:", error);
        }

        await db.execute(
            "INSERT INTO movies (Title, Genre, Rating, Duration, poster_url, overview) VALUES (?, ?, ?, ?, ?, ?)", 
        [title, genre, rating, duration, posterUrl, overview]);

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
    } catch (error) {
        console.error("Error adding movie: ", error);
        res.status(500).json({message: "Server error" });
    }
}

export const updateMoviesMetadata = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [movies]: any = await db.execute("SELECT * FROM movies WHERE poster_url IS NULL OR overview is NULL");

        let updatedCount = 0;

        for (const movie of movies) {
            try {
                const searchResults = await tmdbService.searchMovie(movie.Title);

                if (searchResults && searchResults.length > 0) {
                    const posterPath = searchResults[0].poster_path;
                    const posterUrl = tmdbService.getFullPosterUrl(posterPath);
                    const overview = searchResults[0].overview;

                    await db.execute(
                        "UPDATE movies SET poster_url = ?, overview = ? WHERE MovieID = ?",
                        [posterUrl, overview, movie.MovieID]
                    );

                    updatedCount++;
                }
            } catch (error) {
                console.error(`Error updating metadata for movie ${movie.Title}: `, error);
            }
        }

        res.json({ message: `Updated metadata for ${updatedCount} movies `});
    } catch (error) {
        console.error("Error updating movie metadata:", error);
        res.status(500).json({ message: "Server error" });
    }
}