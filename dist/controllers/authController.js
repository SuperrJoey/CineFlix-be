"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.signup = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const reportService = __importStar(require("../services/reportService"));
dotenv_1.default.config();
const SECRET_KEY = process.env.JWT_SECRET;
const signup = async (req, res) => {
    const { username, name, password, role, adminRole } = req.body;
    if (!username || !password || !role || !name) {
        res.status(400).json({ message: "Error❌! All fields are required" });
        return;
    }
    if (!["user", "admin"].includes(role)) {
        res.status(400).json({ message: "Error❌! Invalid role. Must be either 'user' or 'admin'" });
        return;
    }
    if (role === "admin" && !adminRole) {
        res.status(400).json({ message: "Error! Admin Role is required for admin users" });
        return;
    }
    try {
        const hashedPw = await bcrypt_1.default.hash(password, 8);
        const db = await db_1.default;
        const [existingUsers] = await db.execute("SELECT * FROM users WHERE username = $1", [username]);
        if (existingUsers.length > 0) {
            res.status(400).json({ message: "Username already exists❌" });
            return;
        }
        await db.beginTransaction();
        try {
            const [userResult] = await db.execute("INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING UserID", [username, hashedPw, name, role]);
            const userId = userResult[0].userid;
            if (role === "admin") {
                await db.execute("INSERT INTO admins(UserID, AdminRole, LastLogin) VALUES ($1, $2, NOW())", [userId, adminRole]);
                const [adminResult] = await db.execute("SELECT AdminID FROM admins WHERE UserID = $1", [userId]);
                const adminID = adminResult[0].adminid;
                await db.execute("INSERT INTO permissions (AdminID, Role, AccessLevel) VALUES ($1, $2, $3)", [adminID, "movies", "read, write, delete"]);
                await reportService.createReport(null, userId, reportService.ReportType.AUDIT, {
                    action: "admin_created",
                    adminRole,
                    ip: req.ip,
                    details: { username, name, role }
                });
            }
            else {
                await reportService.createReport(null, userId, reportService.ReportType.AUDIT, {
                    action: "user_created",
                    ip: req.ip,
                    details: { username, name, role }
                });
            }
            res.status(201).json({
                message: `User (${role}) registered successfully!✅`,
                role: role
            });
            await db.commit();
        }
        catch (error) {
            await db.rollback();
            throw error;
        }
    }
    catch (err) {
        console.error("Error registering user:", err);
        res.status(500).json({ message: "Error❌! Failed to register user" });
    }
};
exports.signup = signup;
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: "Error❌! All fields are required" });
        return;
    }
    try {
        const db = await db_1.default;
        const [rows] = await db.execute("SELECT u.*, a.AdminID, a.AdminRole FROM users u LEFT JOIN admins a ON u.UserID = a.UserID WHERE u.username = $1", [username]);
        if (rows.length === 0) {
            await reportService.createReport(null, null, reportService.ReportType.USER_LOGIN, {
                action: "login_failed",
                reason: "invalid_username",
                username,
                ip: req.ip
            });
            res.status(401).json({ message: "Invalid username or password" });
            return;
        }
        const user = rows[0];
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            await reportService.createReport(null, user.userid, reportService.ReportType.USER_LOGIN, {
                action: "login_failed",
                reason: "invalid_password",
                username,
                ip: req.ip
            });
            res.status(401).json({ message: "Invalid username or password" });
            return;
        }
        if (user.adminid) {
            await db.execute("UPDATE admins SET LastLogin = NOW() WHERE AdminID = $1", [user.adminid]);
        }
        let permissions = [];
        if (user.adminid) {
            const [permRows] = await db.execute("SELECT Role, AccessLevel FROM permissions WHERE AdminID = $1", [user.adminid]);
            if (permRows.length === 0) {
                const defaultPermissions = [
                    { role: 'movies', access: 'read, write, delete' },
                    { role: 'staff', access: 'read, write, delete' },
                    { role: 'customers', access: 'read, write, delete' },
                    { role: 'reports', access: 'read, write, delete' },
                    { role: 'bookings', access: 'read, write, delete' }
                ];
                for (const perm of defaultPermissions) {
                    await db.execute("INSERT INTO permissions (AdminID, Role, AccessLevel) VALUES ($1, $2, $3)", [user.adminid, perm.role, perm.access]);
                }
                const [newPermRows] = await db.execute("SELECT Role, AccessLevel FROM permissions WHERE AdminID = $1", [user.adminid]);
                permissions = newPermRows;
            }
            else {
                permissions = permRows;
            }
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.userid,
            role: user.role,
            adminId: user.adminid,
            adminRole: user.adminrole,
            permissions
        }, SECRET_KEY, { expiresIn: "1h" });
        await reportService.createReport(user.adminid || null, user.userid, reportService.ReportType.USER_LOGIN, {
            action: "login_success",
            username,
            role: user.role,
            isAdmin: !!user.adminid,
            ip: req.ip
        });
        res.status(200).json({
            token,
            role: user.role,
            name: user.name,
            isAdmin: !!user.adminid,
            adminRole: user.adminrole || null,
            permissions
        });
    }
    catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ message: "Error❌! Failed to login" });
    }
};
exports.login = login;
