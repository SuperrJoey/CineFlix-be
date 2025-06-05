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

        // Using direct INSERT instead of function call
        const [result]: any = await db.execute(
            `INSERT INTO Reports (AdminID, UserID, ReportType, ReportData, GeneratedDate)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT DO NOTHING
             RETURNING ReportID as reportid`,
            [
                adminId,
                userId,
                reportType,
                dataString
            ]
        );
        
        // If no row was inserted (due to conflict), return success anyway
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
            filters.endDate ?? null,
            filters.limit ?? 100,
            filters.offset ?? 0
        ];

        //CALLING PostgreSQL function HERE
        const [rows]: any = await db.execute("SELECT * FROM GetReports($1, $2, $3, $4, $5, $6, $7)", params);

        return rows.map((row: any) => {
            if (!row.reportdata) {
                console.warn("Invalid ReportData found for reportId:", row.reportid);
            }
            // PostgreSQL returns JSONB as object, no need to parse
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
      WHERE r.ReportID = $1
    `, [reportId]);

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    // PostgreSQL returns JSONB as object, no need to parse if it's already JSONB
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
  } catch (error) {
    console.error("Error fetching report:", error);
    throw error;
    }
}

