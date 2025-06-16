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
exports.createAuditLog = exports.getReportSummary = exports.getReportById = exports.getReports = void 0;
const reportService = __importStar(require("../services/reportService"));
const getReports = async (req, res) => {
    try {
        const { reportType, adminId, userId, startDate, endDate, limit = 100, offset = 0 } = req.query;
        const reportTypes = typeof reportType === 'string'
            ? reportType.split(',').map(type => type)
            : reportType;
        const reports = await reportService.getReports({
            reportType: reportTypes,
            adminId: adminId ? parseInt(adminId) : undefined,
            userId: userId ? parseInt(userId) : undefined,
            startDate: startDate,
            endDate: endDate,
        });
        res.status(200).json(reports);
    }
    catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getReports = getReports;
const getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await reportService.getReportById(parseInt(id));
        if (!report) {
            res.status(404).json({ message: "Report not found" });
            return;
        }
        res.status(200).json(report);
    }
    catch (error) {
        console.error("Error fetching report:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getReportById = getReportById;
const getReportSummary = async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        res.status(400).json({ message: "Start date and end date are required" });
        return;
    }
    try {
        const reports = await reportService.getReports({
            startDate: startDate,
            endDate: endDate,
        });
        const reportsByType = {};
        const adminActions = {};
        const userActions = {};
        reports.forEach((report) => {
            reportsByType[report.reportType] = (reportsByType[report.reportType] || 0) + 1;
            if (report.adminId && report.data.action) {
                adminActions[report.data.action] = (adminActions[report.data.action] || 0) + 1;
            }
            if (report.userId && report.data.action) {
                userActions[report.data.action] = (userActions[report.data.action] || 0) + 1;
            }
        });
        const adminActivity = {};
        reports.forEach((report) => {
            if (report.adminId && report.adminName) {
                adminActivity[report.adminName] = (adminActivity[report.adminName] || 0) + 1;
            }
        });
        const topAdmins = Object.entries(adminActivity)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        res.status(200).json({
            totalReports: reports.length,
            reportsByType,
            adminActions,
            userActions,
            topAdmins,
            period: {
                startDate,
                endDate
            }
        });
    }
    catch (error) {
        console.error("Error generating report summary:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getReportSummary = getReportSummary;
const createAuditLog = async (req, res) => {
    const { userId, reportType, data } = req.body;
    const adminId = req.user?.adminId;
    if (!adminId) {
        res.status(403).json({ message: "Admin privileges required" });
        return;
    }
    if (!reportType || !data) {
        res.status(400).json({ message: "Report type and data are required" });
        return;
    }
    try {
        const result = await reportService.createReport(adminId, userId || null, reportType, data);
        if (!result.success) {
            res.status(500).json({ message: "Failed to create audit log" });
            return;
        }
        res.status(201).json({
            message: "Audit log created successfully",
            reportId: result.reportId
        });
    }
    catch (error) {
        console.error("Error creating audit log:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.createAuditLog = createAuditLog;
