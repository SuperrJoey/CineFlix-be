import { Request } from 'express';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        role: string;
        adminId?: number;
        adminRole?: string;
        permissions?: Array<{
            Role: string;
            AccessLevel: string;
        }>;
    };
}

// Re-export Express types for consistency
export { Request, Response, NextFunction, Router } from 'express'; 