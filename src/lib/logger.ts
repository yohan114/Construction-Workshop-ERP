/**
 * Error Logging Service
 * Centralized logging with trace IDs for production debugging
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type LogCategory = 'API' | 'AUTH' | 'DATABASE' | 'BUSINESS' | 'SYSTEM' | 'SECURITY';

interface LogEntry {
  traceId: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  userId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// Generate unique trace ID
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${random}`.toUpperCase();
}

// Log to database
async function logToDatabase(entry: LogEntry): Promise<void> {
  try {
    await db.systemLog.create({
      data: {
        traceId: entry.traceId,
        level: entry.level,
        category: entry.category,
        message: entry.message,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        errorName: entry.error?.name,
        errorMessage: entry.error?.message,
        errorStack: entry.error?.stack,
        userId: entry.userId,
        companyId: entry.companyId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (dbError) {
    // Fallback to console if database logging fails
    console.error('Failed to log to database:', dbError);
    console.error('Original log entry:', entry);
  }
}

// Main logging function
export async function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  options: {
    metadata?: Record<string, any>;
    error?: Error;
    userId?: string;
    companyId?: string;
    ipAddress?: string;
    userAgent?: string;
    traceId?: string;
  } = {}
): Promise<string> {
  const traceId = options.traceId || generateTraceId();

  const entry: LogEntry = {
    traceId,
    level,
    category,
    message,
    metadata: options.metadata,
    error: options.error
      ? {
          name: options.error.name,
          message: options.error.message,
          stack: options.error.stack,
        }
      : undefined,
    userId: options.userId,
    companyId: options.companyId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    timestamp: new Date(),
  };

  // Always log to console for immediate visibility
  const logPrefix = `[${entry.timestamp.toISOString()}] [${traceId}] [${level}] [${category}]`;
  
  switch (level) {
    case 'CRITICAL':
    case 'ERROR':
      console.error(logPrefix, message, options.error || '', options.metadata || '');
      break;
    case 'WARN':
      console.warn(logPrefix, message, options.metadata || '');
      break;
    case 'DEBUG':
      if (process.env.NODE_ENV === 'development') {
        console.debug(logPrefix, message, options.metadata || '');
      }
      break;
    default:
      console.log(logPrefix, message, options.metadata || '');
  }

  // Log to database for ERROR and CRITICAL levels
  if (level === 'ERROR' || level === 'CRITICAL') {
    await logToDatabase(entry);
  }

  // Send alert for critical errors
  if (level === 'CRITICAL') {
    await sendCriticalAlert(entry);
  }

  return traceId;
}

// Convenience methods
export const logger = {
  debug: (category: LogCategory, message: string, metadata?: Record<string, any>) =>
    log('DEBUG', category, message, { metadata }),

  info: (category: LogCategory, message: string, metadata?: Record<string, any>) =>
    log('INFO', category, message, { metadata }),

  warn: (category: LogCategory, message: string, metadata?: Record<string, any>) =>
    log('WARN', category, message, { metadata }),

  error: (
    category: LogCategory,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ) => log('ERROR', category, message, { error, metadata }),

  critical: (
    category: LogCategory,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ) => log('CRITICAL', category, message, { error, metadata }),

  api: {
    request: (method: string, path: string, userId?: string, metadata?: Record<string, any>) =>
      log('INFO', 'API', `${method} ${path}`, { userId, metadata: { ...metadata, method, path } }),
    
    response: (method: string, path: string, statusCode: number, duration: number, traceId?: string) =>
      log('INFO', 'API', `${method} ${path} -> ${statusCode} (${duration}ms)`, { traceId, metadata: { method, path, statusCode, duration } }),
    
    error: (method: string, path: string, error: Error, traceId?: string) =>
      log('ERROR', 'API', `${method} ${path} failed`, { error, traceId }),
  },

  auth: {
    login: (userId: string, email: string, success: boolean, ipAddress?: string) =>
      log(success ? 'INFO' : 'WARN', 'AUTH', `Login ${success ? 'success' : 'failed'} for ${email}`, { userId, ipAddress }),

    logout: (userId: string, email: string) =>
      log('INFO', 'AUTH', `Logout for ${email}`, { userId }),

    tokenRefresh: (userId: string, success: boolean) =>
      log('INFO', 'AUTH', `Token refresh ${success ? 'success' : 'failed'}`, { userId }),

    unauthorized: (path: string, ipAddress?: string) =>
      log('WARN', 'SECURITY', `Unauthorized access attempt to ${path}`, { ipAddress }),
  },

  business: {
    jobCreated: (jobId: string, assetId: string, userId: string) =>
      log('INFO', 'BUSINESS', `Job created`, { userId, metadata: { jobId, assetId } }),

    jobStatusChanged: (jobId: string, fromStatus: string, toStatus: string, userId: string) =>
      log('INFO', 'BUSINESS', `Job status changed: ${fromStatus} -> ${toStatus}`, { userId, metadata: { jobId } }),

    stockIssued: (requestId: string, itemId: string, quantity: number, userId: string) =>
      log('INFO', 'BUSINESS', `Stock issued: ${quantity} units`, { userId, metadata: { requestId, itemId, quantity } }),

    lowStock: (itemId: string, itemName: string, currentQty: number, minQty: number) =>
      log('WARN', 'BUSINESS', `Low stock alert: ${itemName}`, { metadata: { itemId, currentQty, minQty } }),

    costOverrun: (jobId: string, budgeted: number, actual: number) =>
      log('WARN', 'BUSINESS', `Cost overrun detected`, { metadata: { jobId, budgeted, actual, variance: ((actual - budgeted) / budgeted * 100).toFixed(1) + '%' } }),
  },

  system: {
    startup: () =>
      log('INFO', 'SYSTEM', 'Application started'),

    shutdown: () =>
      log('INFO', 'SYSTEM', 'Application shutting down'),

    maintenanceMode: (enabled: boolean, reason?: string) =>
      log('INFO', 'SYSTEM', `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`, { metadata: { reason } }),

    backup: (success: boolean, size?: number) =>
      log(success ? 'INFO' : 'ERROR', 'SYSTEM', `Backup ${success ? 'completed' : 'failed'}`, { metadata: { size } }),

    healthCheck: (component: string, healthy: boolean, details?: any) =>
      log(healthy ? 'DEBUG' : 'WARN', 'SYSTEM', `Health check: ${component}`, { metadata: details }),
  },
};

// Send critical alert (email/SMS)
async function sendCriticalAlert(entry: LogEntry): Promise<void> {
  // In production, this would send an email or SMS to the IT team
  // For now, we'll just log it prominently
  console.error('🚨 CRITICAL ALERT 🚨');
  console.error(`Trace ID: ${entry.traceId}`);
  console.error(`Message: ${entry.message}`);
  if (entry.error) {
    console.error(`Error: ${entry.error.name}: ${entry.error.message}`);
  }

  // TODO: Implement email notification
  // if (process.env.CRITICAL_ALERT_EMAIL) {
  //   await sendEmail({
  //     to: process.env.CRITICAL_ALERT_EMAIL,
  //     subject: `[CRITICAL] ERP System Alert - ${entry.traceId}`,
  //     body: formatCriticalAlertEmail(entry),
  //   });
  // }
}

// Get logs for debugging
export async function getLogs(options: {
  traceId?: string;
  level?: LogLevel;
  category?: LogCategory;
  userId?: string;
  companyId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<any[]> {
  // This would query the SystemLog table
  // For now, return empty array
  return [];
}
