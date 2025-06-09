// Global type definitions for Node.js environment
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    TMDB_ACCESS_TOKEN: string;
    FRONTEND_URL?: string;
  }
}

// Node.js globals
declare var process: NodeJS.Process;
declare var console: Console;
declare var Buffer: BufferConstructor;
declare var global: typeof globalThis;
declare var setInterval: typeof globalThis.setInterval;
declare var clearInterval: typeof globalThis.clearInterval;
declare var setTimeout: typeof globalThis.setTimeout;
declare var clearTimeout: typeof globalThis.clearTimeout;

// Console interface for better compatibility
interface Console {
  log(...data: any[]): void;
  error(...data: any[]): void;
  warn(...data: any[]): void;
  info(...data: any[]): void;
  debug(...data: any[]): void;
} 