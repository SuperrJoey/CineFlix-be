import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { decode } from "punycode";

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    adminId?: number,
    adminRole?: string;
    permissions?: Array<{
      Role: string;
      AccessLevel: string;
    }>;
  }
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log("Incoming Headers:", req.headers);
  console.log("Authorization Header:", authHeader);
  console.log("Extracted Token:", token);
  
  if (!token)  {res.status(401).json({ message: "Unauthorized access" });
                return;}
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY as string) as {
      id: number;
      role: string;
      adminId?: number;
      adminRole?: string;
      permissions?: Array<{ Role: string; AccessLevel: string }>;
    };
    
    console.log("Decoded JWT:", decoded);

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