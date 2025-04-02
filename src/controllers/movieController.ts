import { Request, Response} from "express";
import dbPromise from "../config/db";
import * as tmdbService from "../services/tmdbService";

export const getMovies = async (req: Request, res: Response) => {
    try {
        const db = await dbPromise;
        const [movies]: any = await db.execute("SELECT * FROM movies");
        
        const moviesWithPosters =  await Promise.all(
            movies.map(async (movie: any) => {
                try {
                    const searchResults = await tmdbService.searchMovie(movie.Title);
    
                    if (searchResults && searchResults.length > 0) {
                        const posterPath = searchResults[0].poster_path;
                        const overview = searchResults[0].overview;
                        return {
                            ...movie,
                            poster_url: tmdbService.getFullPosterUrl(posterPath),
                            overview
                        };
                    }
    
                    return {
                        ...movie,
                        poster_url: null,
                        overview: null
                    };
                } catch (error) {
                    console.error(`Error fetching poster for ${movie.title}:`, error);
                    return {
                        ...movie,
                        poster_url: null,
                        overview: null
                    };
                }
            })
        );

        res.json(moviesWithPosters);
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

        try {
            const searchResults = await tmdbService.searchMovie(movie.Title);

            if (searchResults && searchResults.length > 0) {
                const posterPath = searchResults[0].poster_path;
                movie.poster_url = tmdbService.getFullPosterUrl(posterPath);
                movie.overview = searchResults[0].overview;
            } else {
                movie.poster_url = null;
                movie.overview = null;
            }
        } catch (error) {
            console.error("Error fetching TMDB data:", error);
            movie.poster_url = null;
            movie.overview = null;
        }
        
        res.json(movie);
    } catch (error) {
        console.error("Error fetching movie:", error);
        res.status(500).json({ message: "Server error" });
    }
}