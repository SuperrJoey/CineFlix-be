import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
console.log("tmdb api key - ",TMDB_API_KEY);
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export const searchMovie = async (title: string) => {
    try {
        const response = await axios.get(`${BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: title
            }
        });
        console.log(response.data);
        return response.data.results;
    } catch (error) {
        console.error('Error searching movie:', error);
        throw error;
    }
};

export const getMovieDetails = async (tmbdId: number) => {
    try {
        const response = await axios.get(`${BASE_URL}/movie/${tmbdId}`, {
            params: {
                api_key : TMDB_API_KEY
            }
        });
        console.log(response);
        return response.data;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        throw error;
    }
};

export const getFullPosterUrl = (posterPath: string | null ) => {
    if (!posterPath) return null;
    return `${IMAGE_BASE_URL}${posterPath}`;
}