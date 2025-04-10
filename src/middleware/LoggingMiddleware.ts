import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import * as reportService from "../services/reportService";

export const logAdminAction = (actionType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    // Get information before processing
    const adminId = req.user?.adminId;
    const userId = req.user?.id;
    const method = req.method;
    const path = req.path;
    const body = req.body;
    const params = req.params;
    const ip = req.ip;

    if (adminId) {
        res.send = function(body) {
            res.send = originalSend;

            const statusCode = res.statusCode;

            if (statusCode >= 200 && statusCode < 300) {
                reportService.createReport(
                    adminId,
                    userId || null,
                    reportService.ReportType.ADMIN_ACTION,
                    {
                        action: actionType,
                        method,
                        path,
                        params,
                        requestBody: body,
                        statusCode,
                        ip,
                        timestamp: new Date().toISOString()
                    }
                ).catch(err => {
                    console.error("Error logging admin action:", err);
                });
            }

            return originalSend.call(this, body);
        };
    }
    next();
    };
};

export const logUserAction = (actionType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      // Store the original send function
      const originalSend = res.send;
      
      // Get information before processing
      const userId = req.user?.id;
      const method = req.method;
      const path = req.path;
      const ip = req.ip;
      
      // Only proceed if the request is made by a user
      if (userId) {
        // Override the send function to log after successful responses
        res.send = function(body) {
          // Restore original function
          res.send = originalSend;
          
          // Get the response status
          const statusCode = res.statusCode;
          
          // Only log successful operations (2xx status codes)
          if (statusCode >= 200 && statusCode < 300) {
            // Log the action
            reportService.createReport(
              null,
              userId,
              reportService.ReportType.USER_LOGIN,
              {
                action: actionType,
                method,
                path,
                statusCode,
                ip,
                timestamp: new Date().toISOString()
              }
            ).catch(err => {
              console.error("Error logging user action:", err);
            });
          }
          
          // Call the original function
          return originalSend.call(this, body);
        };
      }
      
      next();
    };
  };
  

  export const logSystemEvent = (eventType: string, details: object) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Log system event
      reportService.createReport(
        null,
        null,
        reportService.ReportType.SYSTEM,
        {
          action: eventType,
          details,
          ip: req.ip,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        }
      ).catch(err => {
        console.error("Error logging system event:", err);
      });
      
      next();
    };
  };