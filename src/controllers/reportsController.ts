import { Request, Response } from "express";
import { AuthRequest } from "../types/express";
import * as reportService from "../services/reportService";
import { json } from "stream/consumers";



export const getReports = async (req: AuthRequest, res: Response) => {
    try {
        const { reportType, adminId, userId, startDate, endDate, limit = 100, offset = 0 } = req.query;

        const reportTypes = typeof reportType === 'string' 
            ? reportType.split(',').map(type => type as reportService.ReportType) 
            : (reportType as reportService.ReportType[]);

        const reports = await reportService.getReports({
            reportType: reportTypes,
            adminId: adminId ? parseInt(adminId as string) : undefined,
            userId: userId ? parseInt(userId as string) : undefined,
            startDate: startDate as string,
            endDate: endDate as string,
        });

        res.status(200).json(reports);
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getReportById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const report = await reportService.getReportById(parseInt(id));

        if (!report) {
            res.status(404).json({ message: "Report not found" });
            return;
        }

        res.status(200).json(report);
    } catch (error) {
        console.error("Error fetching report:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getReportSummary = async (req:AuthRequest, res: Response) => {
    const { startDate, endDate} = req.query;

    if (!startDate || !endDate) {
        res.status(400).json({ message: "Start date and end date are required" });
        return;
    }

    try {
        const reports = await reportService.getReports({
            startDate: startDate as string,
            endDate: endDate as string,
        });
        const reportsByType: Record<string, number> = {};
        const adminActions: Record<string, number> = {};
        const userActions: Record<string, number> = {};

        reports.forEach((report: any) => {
            reportsByType[report.reportType] = (reportsByType[report.reportType] || 0) + 1;

            //count admin actions
            if (report.adminId && report.data.action) {
                adminActions[report.data.action] = (adminActions[report.data.action] || 0) + 1;
            }

            //count users actions
            if (report.userId && report.data.action) {
                userActions[report.data.action] = (userActions[report.data.action] || 0) + 1;
              }
        });

            //get top admins by activity
        const adminActivity: Record<string, number> = {};
        reports.forEach((report: any) => {
            if (report.adminId && report.adminName) {
                adminActivity[report.adminName] = (adminActivity[report.adminName] || 0) + 1;
            }
        });

        const topAdmins = Object.entries(adminActivity)
            .sort((a, b) => b[1] - a[1])
            .slice(0,5)
            .map(([name, count]) => ({name, count}));

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

    } catch (error) {
        console.error("Error generating report summary:", error);
    res.status(500).json({ message: "Server error" });
    }
}

export const createAuditLog = async (req: AuthRequest, res: Response) => {
    const { userId, reportType, data} = req.body;
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
        const result = await reportService.createReport(
            adminId,
            userId || null,
            reportType as reportService.ReportType,
            data
        );

        if (!result.success) {
            res.status(500).json({ message: "Failed to create audit log" });
            return;
        }

        res.status(201).json({
            message: "Audit log created successfully",
            reportId: result.reportId
        });
    } catch (error) {
        console.error("Error creating audit log:", error);
        res.status(500).json({ message: "Server error" });
    }
};