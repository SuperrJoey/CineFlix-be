import dbPromise from "../config/db";

export enum ReportType {
    USER_LOGIN = "user_login",
    ADMIN_ACTION = "admin_action",
    BOOKING = "booking",
    SYSTEM = "system",
    WORK_SCHEDULE = "work_schedule",
    AUDIT = "audit"
}

export interface ReportData {
    action?: string;
    details?: any;
    targetId?: number;
    targetType?: string;
    ip?: string;
    [key: string]: any;
}

//CREATING an audit log entry

export const createReport = async (
    adminId: number | null,
    userId: number | null,
    reportType: ReportType,
    reportData: ReportData
) => {
    try {
        const db = await dbPromise;
        const dataString = JSON.stringify(reportData);

        const [result]: any = await db.execute(
            "INSERT INTO Reports (AdminID, UserID, ReportType, ReportData, GeneratedDate) VALUES (?, ?, ?, ?, NOW())",
            [adminId, userId, reportType, dataString]
        );

        return {
            reportId: result.insertId,
            success: true
        };
    } catch (error) {
        console.error("Error creating report:", error);
        return {
            success: false,
            error
        };
    }
};

//filtering option

export const getReports = async (
    filters: {
        reportType?: ReportType | ReportType[];
        adminId?: number;
        userId?: number;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}
) => {
    try {
        const db = await dbPromise;
        let query = `
        SELECT r.ReportID, r.AdminID, r.UserID, r.ReportType, r.ReportData, r.GeneratedDate,
                 a.AdminRole, admin.Name as AdminName,
                 u.Username as UserUsername, u.Name as UserName
          FROM Reports r
          LEFT JOIN Admins a ON r.AdminID = a.AdminID
          LEFT JOIN Users admin ON a.UserID = admin.UserID
          LEFT JOIN Users u ON r.UserID = u.UserID
          WHERE 1=1
          `;

        const params: any[] = [];

        if (filters.reportType) {
            if (Array.isArray(filters.reportType)) {
                query += " AND r.ReportType IN (?" + ",?".repeat(filters.reportType.length - 1) + ")";
                params.push(...filters.reportType);
            } else {
                query += " AND r.ReportType = ?";
                params.push(filters.reportType);
            }
        }

        if (filters.adminId) {
            query += "AND r.AdminID = ?";
            params.push(filters.adminId);
        }
        if (filters.userId) {
            query += " AND r.UserID = ?";
            params.push(filters.userId);
        }
        
        if (filters.startDate) {
            query += " AND r.GeneratedDate >= ?";
            params.push(filters.startDate);
        }
        
        if (filters.endDate) {
            query += " AND r.GeneratedDate <= ?";
            params.push(filters.endDate);
        }
        
        query += " ORDER BY r.GeneratedDate DESC";

        const [rows]: any = await db.execute(query, params);

        return rows.map((row: any) => {
            if (!row.ReportData) {
                console.warn("Invalid ReportData found for reportId:", row.ReportID);
              }
            const reportData = row.ReportData ? JSON.parse(row.ReportData) : {};
            return {
            reportId: row.ReportID,
            adminId: row.AdminID,
            userId: row.UserID,
            adminName: row.AdminName,
            adminRole: row.AdminRole,
            userName: row.UserName,
            userUsername: row.UserUsername,
            reportType: row.ReportType,
            generatedDate: row.GeneratedDate,
            data: reportData
            };
        });
    } catch (error) {
        console.error("Error fetching reports:", error);
    }
}

export const getReportById = async (reportId: number) => {
    try {
        const db = await dbPromise;

        const [rows]: any = await db.execute(`
            SELECT r.ReportID, r.AdminID, r.UserID, r.ReportType, r.ReportData, r.GeneratedDate,
             a.AdminRole, admin.Name as AdminName,
             u.Username as UserUsername, u.Name as UserName
      FROM Reports r
      LEFT JOIN Admins a ON r.AdminID = a.AdminID
      LEFT JOIN Users admin ON a.UserID = admin.UserID
      LEFT JOIN Users u ON r.UserID = u.UserID
      WHERE r.ReportID = ?
    `, [reportId]);

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    const reportData = JSON.parse(row.ReportData);

    return {
      reportId: row.ReportID,
      adminId: row.AdminID,
      userId: row.UserID,
      adminName: row.AdminName,
      adminRole: row.AdminRole,
      userName: row.UserName,
      userUsername: row.UserUsername,
      reportType: row.ReportType,
      generatedDate: row.GeneratedDate,
      data: reportData
    };
  } catch (error) {
    console.error("Error fetching report:", error);
    throw error;
    }
}