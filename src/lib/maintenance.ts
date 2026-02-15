/**
 * Maintenance Mode Service
 * Control system availability for maintenance windows
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const MAINTENANCE_MODE_KEY = 'maintenance_mode';

export interface MaintenanceStatus {
  enabled: boolean;
  reason?: string;
  startedAt?: Date;
  estimatedEnd?: Date;
  enabledBy?: string;
}

/**
 * Check if maintenance mode is enabled
 */
export async function isMaintenanceMode(): Promise<boolean> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: MAINTENANCE_MODE_KEY },
    });
    
    if (!config) return false;
    
    const data = JSON.parse(config.value);
    return data.enabled === true;
  } catch (error) {
    logger.error('SYSTEM', 'Failed to check maintenance mode', error as Error);
    return false;
  }
}

/**
 * Get maintenance mode status
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: MAINTENANCE_MODE_KEY },
    });
    
    if (!config) {
      return { enabled: false };
    }
    
    return JSON.parse(config.value);
  } catch (error) {
    logger.error('SYSTEM', 'Failed to get maintenance status', error as Error);
    return { enabled: false };
  }
}

/**
 * Enable maintenance mode
 */
export async function enableMaintenanceMode(
  reason: string,
  estimatedMinutes: number = 30,
  userId?: string
): Promise<MaintenanceStatus> {
  const status: MaintenanceStatus = {
    enabled: true,
    reason,
    startedAt: new Date(),
    estimatedEnd: new Date(Date.now() + estimatedMinutes * 60 * 1000),
    enabledBy: userId,
  };

  await db.systemConfig.upsert({
    where: { key: MAINTENANCE_MODE_KEY },
    create: {
      key: MAINTENANCE_MODE_KEY,
      value: JSON.stringify(status),
      description: 'System maintenance mode status',
    },
    update: {
      value: JSON.stringify(status),
    },
  });

  await logger.system.maintenanceMode(true, reason);

  return status;
}

/**
 * Disable maintenance mode
 */
export async function disableMaintenanceMode(): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: MAINTENANCE_MODE_KEY },
    create: {
      key: MAINTENANCE_MODE_KEY,
      value: JSON.stringify({ enabled: false }),
      description: 'System maintenance mode status',
    },
    update: {
      value: JSON.stringify({ enabled: false }),
    },
  });

  await logger.system.maintenanceMode(false);
}

/**
 * Get system configuration value
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key },
    });
    return config?.value || null;
  } catch {
    return null;
  }
}

/**
 * Set system configuration value
 */
export async function setSystemConfig(key: string, value: string, description?: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key },
    create: { key, value, description },
    update: { value },
  });
}
