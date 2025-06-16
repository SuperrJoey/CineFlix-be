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
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSystemEvent = exports.logUserAction = exports.logAdminAction = void 0;
const reportService = __importStar(require("../services/reportService"));
const logAdminAction = (actionType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        const adminId = req.user?.adminId;
        const userId = req.user?.id;
        const method = req.method;
        const path = req.path;
        const body = req.body;
        const params = req.params;
        const ip = req.ip;
        if (adminId) {
            res.send = function (body) {
                res.send = originalSend;
                const statusCode = res.statusCode;
                if (statusCode >= 200 && statusCode < 300) {
                    reportService.createReport(adminId, userId || null, reportService.ReportType.ADMIN_ACTION, {
                        action: actionType,
                        method,
                        path,
                        params,
                        requestBody: body,
                        statusCode,
                        ip,
                        timestamp: new Date().toISOString()
                    }).catch(err => {
                        console.error("Error logging admin action:", err);
                    });
                }
                return originalSend.call(this, body);
            };
        }
        next();
    };
};
exports.logAdminAction = logAdminAction;
const logUserAction = (actionType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        const userId = req.user?.id;
        const method = req.method;
        const path = req.path;
        const ip = req.ip;
        if (userId) {
            res.send = function (body) {
                res.send = originalSend;
                const statusCode = res.statusCode;
                if (statusCode >= 200 && statusCode < 300) {
                    reportService.createReport(null, userId, reportService.ReportType.USER_LOGIN, {
                        action: actionType,
                        method,
                        path,
                        statusCode,
                        ip,
                        timestamp: new Date().toISOString()
                    }).catch(err => {
                        console.error("Error logging user action:", err);
                    });
                }
                return originalSend.call(this, body);
            };
        }
        next();
    };
};
exports.logUserAction = logUserAction;
const logSystemEvent = (eventType, details) => {
    return async (req, res, next) => {
        reportService.createReport(null, null, reportService.ReportType.SYSTEM, {
            action: eventType,
            details,
            ip: req.ip,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        }).catch(err => {
            console.error("Error logging system event:", err);
        });
        next();
    };
};
exports.logSystemEvent = logSystemEvent;
