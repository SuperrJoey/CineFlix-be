import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin" ) {
         res.status(403).json({ message: "Access denied, Admin privileges required" });
         return;
    }
    next();
};

export const hasPermission = (requiredRole: string, requiredAction: string) => {
    return (req: AuthRequest, res:Response, next: NextFunction) => {
        const permissions = req.user?.permissions || [];
        const hasAccess = permissions.some(p => {
            if (p.Role === requiredRole) {
                const actions = p.AccessLevel.split(',');
                return actions.includes(requiredAction);
            }
            return false;
        });

        if (!hasAccess) {
            return res.status(403).json({
                message: `Access denied, you need '${requiredAction}' permission for ${requiredRole}`
            });
        }
        next();
    };
}