"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportById = exports.getReports = exports.createReport = exports.ReportType = void 0;
const db_1 = __importDefault(require("../config/db"));
var ReportType;
(function (ReportType) {
    ReportType["USER_LOGIN"] = "user_login";
    ReportType["ADMIN_ACTION"] = "admin_action";
    ReportType["BOOKING"] = "booking";
    ReportType["SYSTEM"] = "system";
    ReportType["WORK_SCHEDULE"] = "work_schedule";
    ReportType["AUDIT"] = "audit";
})(ReportType || (exports.ReportType = ReportType = {}));
const createReport = async (adminId, userId, reportType, reportData) => {
    try {
        const db = await db_1.default;
        const dataString = JSON.stringify(reportData);
        const [result] = await db.execute(`INSERT INTO Reports (AdminID, UserID, ReportType, ReportData, GeneratedDate)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT DO NOTHING
             RETURNING ReportID as reportid`, [
            adminId,
            userId,
            reportType,
            dataString
        ]);
        if (!result || result.length === 0) {
            return {
                success: true,
                message: "Report already exists"
            };
        }
        return {
            reportId: result[0].reportid,
            success: true
        };
    }
    catch (error) {
        console.error("Error creating report:", error);
        return {
            success: false,
            error
        };
    }
};
exports.createReport = createReport;
const getReports = async (filters = {}) => {
    try {
        const db = await db_1.default;
        const reportType = Array.isArray(filters.reportType)
            ? filters.reportType.join(',')
            : filters.reportType ?? null;
        const params = [
            reportType,
            filters.adminId ?? null,
            filters.userId ?? null,
            filters.startDate ?? null,
            filters.endDate ?? null,
            filters.limit ?? 100,
            filters.offset ?? 0
        ];
        const [rows] = await db.execute("SELECT * FROM GetReports($1, $2, $3, $4, $5, $6, $7)", params);
        return rows.map((row) => {
            if (!row.reportdata) {
                console.warn("Invalid ReportData found for reportId:", row.reportid);
            }
            const reportData = row.reportdata || {};
            return {
                reportId: row.reportid,
                adminId: row.adminid,
                userId: row.userid,
                adminName: row.adminname,
                adminRole: row.adminrole,
                userName: row.username,
                userUsername: row.userusername,
                reportType: row.reporttype,
                generatedDate: row.generateddate,
                data: reportData
            };
        });
    }
    catch (error) {
        console.error("Error fetching reports:", error);
        throw error;
    }
};
exports.getReports = getReports;
const getReportById = async (reportId) => {
    try {
        const db = await db_1.default;
        const [rows] = await db.execute(`
            SELECT r.ReportID, r.AdminID, r.UserID, r.ReportType, r.ReportData, r.GeneratedDate,
             a.AdminRole, admin.Name as AdminName,
             u.Username as UserUsername, u.Name as UserName
      FROM Reports r
      LEFT JOIN Admins a ON r.AdminID = a.AdminID
      LEFT JOIN Users admin ON a.UserID = admin.UserID
      LEFT JOIN Users u ON r.UserID = u.UserID
      WHERE r.ReportID = $1
    `, [reportId]);
        if (rows.length === 0) {
            return null;
        }
        const row = rows[0];
        const reportData = typeof row.reportdata === 'string' ? JSON.parse(row.reportdata) : row.reportdata;
        return {
            reportId: row.reportid,
            adminId: row.adminid,
            userId: row.userid,
            adminName: row.adminname,
            adminRole: row.adminrole,
            userName: row.username,
            userUsername: row.userusername,
            reportType: row.reporttype,
            generatedDate: row.generateddate,
            data: reportData
        };
    }
    catch (error) {
        console.error("Error fetching report:", error);
        throw error;
    }
};
exports.getReportById = getReportById;
