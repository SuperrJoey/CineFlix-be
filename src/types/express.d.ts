import express from 'express';

declare global {
  namespace Express {
    interface Request {
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
  }
}

export interface AuthRequest extends express.Request {
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