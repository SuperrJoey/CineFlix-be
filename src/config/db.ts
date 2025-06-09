import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Create a connection pool for better performance
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Increased timeout for Neon
    keepAlive: true, // Keep connections alive
    keepAliveInitialDelayMillis: 10000, // Start keepalive after 10 seconds
});

// Test the connection
pool.on('connect', () => {
    // Connection established
});

pool.on('error', (err: Error) => {
    console.error('Database connection error ❌', err);
    // Don't exit the process on connection errors, just log them
    console.error('Attempting to reconnect...');
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