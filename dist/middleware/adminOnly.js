"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = exports.adminOnly = void 0;
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({ message: "Access denied, Admin privileges required" });
        return;
    }
    next();
};
exports.adminOnly = adminOnly;
const hasPermission = (requiredRole, requiredAction) => {
    return (req, res, next) => {
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
};
exports.hasPermission = hasPermission;
