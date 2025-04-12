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

        //CALLING PLSQL HERE
        const [result]: any = await db.execute("CALL CreateReport(?, ?, ?, ?)", [
            adminId,
            userId,
            reportType,
            dataString
        ]);
        

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
    } = {}
) => {
    try {
        const db = await dbPromise;

        // Normalize reportType to a string or null
        const reportType = Array.isArray(filters.reportType)
            ? filters.reportType.join(',')
            : filters.reportType ?? null;

        // Ensure all params are defined or set to null
        const params = [
            reportType,
            filters.adminId ?? null,
            filters.userId ?? null,
            filters.startDate ?? null,
            filters.endDate ?? null
        ];

        //CALLING PLSQL HERE
        const [rows]: any = await db.execute("CALL GetReports(?, ?, ?, ?, ?)", params);

        const resultRows = rows?.[0] ?? [];

        return resultRows.map((row: any) => {
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
        throw error; // Optional: allow upper layers to catch it
    }
};


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

