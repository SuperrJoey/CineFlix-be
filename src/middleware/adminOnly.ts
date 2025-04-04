import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
   console.log("User in request: ", req.user);
   console.log("Role check: ", !req.user || req.user.role !== "admin");
   console.log("Role value: ", req.user?.role);
   console.log("Role type: ", typeof req.user?.role);

    if (!req.user || req.user.role !== "admin" ) {
         res.status(403).json({ message: "Access denied, Admin privileges required" });
         return;
    }
    next();
};

export const hasPermission = (requiredRole: string, requiredAction: string) => {
    return (req: AuthRequest, res:Response, next: NextFunction) => {
        console.log("In hasPermission middleware");
        console.log("Required role:", requiredRole);
        console.log("Required action:", requiredAction);
        console.log("User permissions:", req.user?.permissions);
        const permissions = req.user?.permissions || [];
        const hasAccess = permissions.some(p => {
            console.log("Checking permission:", p);
            console.log("Role match:", p.Role === requiredRole);
            if (p.Role === requiredRole) {
                const actions = p.AccessLevel.split(',').map(action => action.trim());
                console.log("Actions:", actions);
                console.log("Action match:", actions.includes(requiredAction));
                return actions.includes(requiredAction);
            }
            return false;
        });
        console.log("Has access:", hasAccess);

        if (!hasAccess) {
             res.status(403).json({
                message: `Access denied, you need '${requiredAction}' permission for ${requiredRole}`
            });
            return;
        }
        next();
    };
}