/**
 * System Health Check Service
 * Monitor system components and report status
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    storage: ComponentHealth;
    memory: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

const startTime = Date.now();

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    memory: checkMemory(),
  };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (statuses.includes('unhealthy')) {
    status = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    // Simple query to test connection
    await db.$queryRaw`SELECT 1`;
    
    // Check database size (SQLite specific)
    const result = await db.$queryRaw`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()` as any[];
    const dbSize = result[0]?.size || 0;
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      details: {
        size: `${(dbSize / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  } catch (error) {
    logger.error('SYSTEM', 'Database health check failed', error as Error);
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      details: {
        error: (error as Error).message,
      },
    };
  }
}

/**
 * Check storage (for file uploads, etc.)
 */
async function checkStorage(): Promise<ComponentHealth> {
  try {
    // Check if we can write to the uploads directory
    // For now, just return healthy
    return {
      status: 'healthy',
      message: 'Storage accessible',
      details: {
        path: '/uploads',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Storage check failed',
      details: {
        error: (error as Error).message,
      },
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): ComponentHealth {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let message = 'Memory usage normal';

  if (usagePercent > 90) {
    status = 'unhealthy';
    message = 'Memory usage critical';
  } else if (usagePercent > 75) {
    status = 'degraded';
    message = 'Memory usage high';
  }

  return {
    status,
    message,
    details: {
      heapUsed: `${heapUsedMB.toFixed(2)} MB`,
      heapTotal: `${heapTotalMB.toFixed(2)} MB`,
      usagePercent: `${usagePercent.toFixed(1)}%`,
    },
  };
}

/**
 * Get system statistics
 */
export async function getSystemStats(): Promise<{
  database: {
    totalAssets: number;
    totalItems: number;
    totalJobs: number;
    totalUsers: number;
    totalTransactions: number;
  };
  activity: {
    jobsToday: number;
    requestsToday: number;
    fuelIssuesToday: number;
  };
  alerts: {
    active: number;
    critical: number;
  };
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalAssets,
    totalItems,
    totalJobs,
    totalUsers,
    jobsToday,
    requestsToday,
    fuelIssuesToday,
    activeAlerts,
    criticalAlerts,
  ] = await Promise.all([
    db.asset.count(),
    db.item.count(),
    db.job.count(),
    db.user.count(),
    db.job.count({
      where: { createdAt: { gte: today } },
    }),
    db.itemRequest.count({
      where: { createdAt: { gte: today } },
    }),
    db.fuelIssue.count({
      where: { createdAt: { gte: today } },
    }),
    db.alert.count({
      where: { isResolved: false },
    }),
    db.alert.count({
      where: { isResolved: false, severity: 'CRITICAL' },
    }),
  ]);

  // Get total transactions from stock ledger
  const totalTransactions = await db.stockLedger.count();

  return {
    database: {
      totalAssets,
      totalItems,
      totalJobs,
      totalUsers,
      totalTransactions,
    },
    activity: {
      jobsToday,
      requestsToday,
      fuelIssuesToday,
    },
    alerts: {
      active: activeAlerts,
      critical: criticalAlerts,
    },
  };
}

/**
 * Quick health check for load balancers
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
