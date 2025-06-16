"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDBConnection = exports.query = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});
pool.on('connect', () => {
});
pool.on('error', (err) => {
    console.error('Database connection error ❌', err);
    console.error('Attempting to reconnect...');
});
const query = async (text, params) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    }
    catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.query = query;
const createDBConnection = () => {
    return {
        execute: async (text, params) => {
            const result = await (0, exports.query)(text, params);
            return [result.rows];
        },
        beginTransaction: async () => {
            return await (0, exports.query)('BEGIN');
        },
        commit: async () => {
            return await (0, exports.query)('COMMIT');
        },
        rollback: async () => {
            return await (0, exports.query)('ROLLBACK');
        }
    };
};
exports.createDBConnection = createDBConnection;
const dbPromise = Promise.resolve((0, exports.createDBConnection)());
exports.default = dbPromise;
