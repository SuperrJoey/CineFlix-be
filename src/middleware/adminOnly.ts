import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

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
                const actions = p.AccessLevel.split(',').map(action => action.trim());
                return actions.includes(requiredAction);
            }
            return false;
        });

        if (!hasAccess) {
             res.status(403).json({
                message: `Access denied, you need '${requiredAction}' permission for ${requiredRole}`
            });
            return;
        }
        next();
    };
}