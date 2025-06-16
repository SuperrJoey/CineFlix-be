"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullPosterUrl = exports.getMovieDetails = exports.searchMovie = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const tmdbAxios = axios_1.default.create({
    baseURL: BASE_URL,
    headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`
    }
});
const searchMovie = async (title) => {
    try {
        const response = await tmdbAxios.get('/search/movie', {
            params: {
                query: title,
                include_adult: false,
                language: 'en-US',
                page: 1
            }
        });
        return response.data.results;
    }
    catch (error) {
        console.error('Error searching movie:', error);
        throw error;
    }
};
exports.searchMovie = searchMovie;
const getMovieDetails = async (tmbdId) => {
    try {
        const response = await tmdbAxios.get(`/movie/${tmbdId}`);
        return response.data;
    }
    catch (error) {
        console.error('Error fetching movie details:', error);
        throw error;
    }
};
exports.getMovieDetails = getMovieDetails;
const getFullPosterUrl = (posterPath) => {
    if (!posterPath)
        return null;
    return `${IMAGE_BASE_URL}${posterPath}`;
};
exports.getFullPosterUrl = getFullPosterUrl;
