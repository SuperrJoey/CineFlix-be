import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const tmdbAxios = axios.create({
    baseURL: BASE_URL,
    headers: {
        'accept' : 'application/json',
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`
    }
})

export const searchMovie = async (title: string) => {
    try {
        
        const response = await tmdbAxios.get('/search/movie', {
            params: {
                query: title,
                include_adult: false,
                language: 'en-US',
                page: 1
            }
        })
        //console.log(response.data);
        return response.data.results;
    } catch (error) {
        console.error('Error searching movie:', error);
        throw error;
    }
};

export const getMovieDetails = async (tmbdId: number) => {
    try {
        const response = await tmdbAxios.get(`/movie/${tmbdId}`);
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