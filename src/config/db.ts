import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Create a connection pool for better performance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database ✅');
});

pool.on('error', (err: Error) => {
    console.error('Database connection error ❌', err);
    process.exit(1);
});

// Helper function to execute queries with better error handling
export const query = async (text: string, params?: any[]): Promise<any> => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        client.release();
    }
};

// For compatibility with existing code that expects db.execute()
export const createDBConnection = () => {
    return {
        execute: async (text: string, params?: any[]) => {
            const result = await query(text, params);
            return [result.rows];
        },
        beginTransaction: async () => {
            return await query('BEGIN');
        },
        commit: async () => {
            return await query('COMMIT');
        },
        rollback: async () => {
            return await query('ROLLBACK');
        }
    };
};

const dbPromise = Promise.resolve(createDBConnection());

export default dbPromise;