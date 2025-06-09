import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { AuthRequest } from "../types/express";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ message: "Unauthorized access" });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY as string) as {
      id: number;
      role: string;
      adminId?: number;
      adminRole?: string;
      permissions?: Array<{ Role: string; AccessLevel: string }>;
    };

    req.user = {
      id: decoded.id,
      role: decoded.role,
      adminId: decoded.adminId,
      adminRole: decoded.adminRole,
      permissions: decoded.permissions
    };
    
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token" });
    return;
  }
};