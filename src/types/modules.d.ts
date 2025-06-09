// Type declarations for modules that might not be properly resolved

declare module 'stream/consumers' {
  export function json(stream: any): Promise<any>;
  export function text(stream: any): Promise<string>;
  export function buffer(stream: any): Promise<Buffer>;
  export function arrayBuffer(stream: any): Promise<ArrayBuffer>;
}

declare module 'pg' {
  export interface Client {
    connect(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    release?(): void;
  }
  
  export interface PoolClient extends Client {
    release(): void;
  }
  
  export interface Pool {
    connect(): Promise<PoolClient>;
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  export interface PoolConfig {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean | object;
    connectionString?: string;
    max?: number;
    min?: number;
    idle?: number;
    acquire?: number;
    evict?: number;
    handleDisconnects?: boolean;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    keepAlive?: boolean;
    keepAliveInitialDelayMillis?: number;
  }
  
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  export class Client {
    constructor(config?: PoolConfig);
    connect(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    release?(): void;
  }
}

declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secretOrPrivateKey: string, options?: any): string;
  export function verify(token: string, secretOrPublicKey: string): any;
}

declare module 'dotenv' {
  export function config(options?: any): any;
}

declare module 'axios' {
  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
  }
  
  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    headers?: any;
    params?: any;
    data?: any;
    baseURL?: string;
  }
  
  export interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  }
  
  export function get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  export function create(config?: AxiosRequestConfig): AxiosInstance;
  
  export default {
    get: get,
    post: post,
    create: create
  };
}

declare module 'cors' {
  import { RequestHandler } from 'express';
  
  interface CorsOptions {
    origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  }
  
  function cors(options?: CorsOptions): RequestHandler;
  export = cors;
}

declare module 'socket.io' {
  export interface Socket {
    id: string;
    join(room: string): void;
    emit(event: string, ...args: any[]): boolean;
    to(room: string): Socket;
    on(event: string, listener: (...args: any[]) => void): void;
  }
  
  export class Server {
    constructor(httpServer: any, options?: any);
    on(event: string, listener: (socket: Socket) => void): this;
    emit(event: string, ...args: any[]): boolean;
    to(room: string): Server;
  }
} 