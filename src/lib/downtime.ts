/**
 * Downtime & Availability Tracking Engine
 * Calculates availability, tracks downtime events, and generates reports
 */

import { db } from '@/lib/db';
import { JobStatus, DowntimeCategory } from '@prisma/client';

// Types
export interface DowntimeStartInput {
  assetId: string;
  companyId: string;
  jobId?: string;
  category?: DowntimeCategory;
  subCategory?: string;
  notes?: string;
  opportunityCostPerHour?: number;
}

export interface DowntimeEndInput {
  downtimeLogId: string;
  notes?: string;
  resolvedBy?: string;
}

export interface AvailabilityResult {
  assetId: string;
  assetCode: string;
  assetDescription: string;
  year: number;
  month: number;
  totalCalendarHours: number;
  availableHours: number;
  downtimeHours: number;
  availabilityPercent: number;
  breakdownHours: number;
  maintenanceHours: number;
  waitingPartsHours: number;
  otherDowntimeHours: number;
  lostOpportunityCost: number;
}

/**
 * Start a downtime event
 */
export async function startDowntime(input: DowntimeStartInput) {
  const { assetId, companyId, jobId, category, subCategory, notes, opportunityCostPerHour } = input;

  // Check if there's already an active downtime for this asset
  const activeDowntime = await db.downtimeLog.findFirst({
    where: {
      assetId,
      endedAt: null,
    },
  });

  if (activeDowntime) {
    throw new Error('Asset already has an active downtime event');
  }

  // Create downtime log
  return db.downtimeLog.create({
    data: {
      companyId,
      assetId,
      jobId,
      startedAt: new Date(),
      category: category || DowntimeCategory.BREAKDOWN,
      subCategory,
      notes,
      opportunityCostPerHour,
    },
  });
}

/**
 * End a downtime event
 */
export async function endDowntime(input: DowntimeEndInput) {
  const { downtimeLogId, notes, resolvedBy } = input;

  const downtime = await db.downtimeLog.findUnique({
    where: { id: downtimeLogId },
    include: { asset: true },
  });

  if (!downtime) {
    throw new Error('Downtime log not found');
  }

  if (downtime.endedAt) {
    throw new Error('Downtime already ended');
  }

  const endedAt = new Date();
  const durationMs = endedAt.getTime() - downtime.startedAt.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));

  // Calculate lost opportunity cost
  const durationHours = durationMinutes / 60;
  const lostOpportunityCost = downtime.opportunityCostPerHour
    ? durationHours * downtime.opportunityCostPerHour
    : null;

  // Update downtime log
  return db.downtimeLog.update({
    where: { id: downtimeLogId },
    data: {
      endedAt,
      durationMinutes,
      lostOpportunityCost,
      resolvedBy,
      resolvedAt: endedAt,
      notes: notes ? `${downtime.notes || ''}\n${notes}`.trim() : downtime.notes,
    },
  });
}

/**
 * Start downtime when job status changes to breakdown
 */
export async function handleJobStatusChange(
  jobId: string,
  newStatus: JobStatus,
  previousStatus: JobStatus
) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { asset: true },
  });

  if (!job) return null;

  // Start downtime when job is created for breakdown
  if (newStatus === JobStatus.CREATED && job.type === 'BREAKDOWN') {
    return startDowntime({
      assetId: job.assetId,
      companyId: job.companyId,
      jobId,
      category: DowntimeCategory.BREAKDOWN,
      opportunityCostPerHour: job.asset.value ? job.asset.value * 0.01 : undefined,
    });
  }

  // End downtime when job is completed
  if (
    (newStatus === JobStatus.COMPLETED || newStatus === JobStatus.CLOSED) &&
    previousStatus !== JobStatus.COMPLETED &&
    previousStatus !== JobStatus.CLOSED
  ) {
    const activeDowntime = await db.downtimeLog.findFirst({
      where: {
        assetId: job.assetId,
        jobId,
        endedAt: null,
      },
    });

    if (activeDowntime) {
      return endDowntime({
        downtimeLogId: activeDowntime.id,
      });
    }
  }

  return null;
}

/**
 * Calculate availability for an asset in a given month
 */
export async function calculateAssetAvailability(
  assetId: string,
  year: number,
  month: number
): Promise<AvailabilityResult> {
  // Get asset info
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      downtimeLogs: {
        where: {
          startedAt: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
      },
    },
  });

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Calculate total calendar hours for the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCalendarHours = daysInMonth * 24;

  // Calculate downtime by category
  let totalDowntimeMinutes = 0;
  const categoryMinutes: Record<string, number> = {
    BREAKDOWN: 0,
    WAITING_PARTS: 0,
    WAITING_LABOR: 0,
    SUPPLY_CHAIN_DELAY: 0,
    SCHEDULED_MAINTENANCE: 0,
    WEATHER: 0,
    OPERATOR_UNAVAILABLE: 0,
    OTHER: 0,
  };

  let lostOpportunityCost = 0;

  for (const downtime of asset.downtimeLogs) {
    const durationMinutes = downtime.durationMinutes || calculateDurationMinutes(downtime);
    totalDowntimeMinutes += durationMinutes;
    categoryMinutes[downtime.category] = (categoryMinutes[downtime.category] || 0) + durationMinutes;

    if (downtime.lostOpportunityCost) {
      lostOpportunityCost += downtime.lostOpportunityCost;
    }
  }

  const downtimeHours = totalDowntimeMinutes / 60;
  const availableHours = totalCalendarHours - downtimeHours;
  const availabilityPercent = (availableHours / totalCalendarHours) * 100;

  const result: AvailabilityResult = {
    assetId: asset.id,
    assetCode: asset.code,
    assetDescription: asset.description,
    year,
    month,
    totalCalendarHours,
    availableHours,
    downtimeHours,
    availabilityPercent,
    breakdownHours: categoryMinutes[BREAKDOWN] / 60,
    maintenanceHours: categoryMinutes[SCHEDULED_MAINTENANCE] / 60,
    waitingPartsHours: categoryMinutes[WAITING_PARTS] / 60,
    otherDowntimeHours:
      (categoryMinutes[WAITING_LABOR] +
        categoryMinutes[SUPPLY_CHAIN_DELAY] +
        categoryMinutes[WEATHER] +
        categoryMinutes[OPERATOR_UNAVAILABLE] +
        categoryMinutes[OTHER]) /
      60,
    lostOpportunityCost,
  };

  // Store the result in AssetAvailability table
  await db.assetAvailability.upsert({
    where: {
      companyId_assetId_year_month: {
        companyId: asset.companyId,
        assetId: asset.id,
        year,
        month,
      },
    },
    update: {
      totalCalendarHours: result.totalCalendarHours,
      availableHours: result.availableHours,
      downtimeHours: result.downtimeHours,
      availabilityPercent: result.availabilityPercent,
      breakdownHours: result.breakdownHours,
      maintenanceHours: result.maintenanceHours,
      waitingPartsHours: result.waitingPartsHours,
      otherDowntimeHours: result.otherDowntimeHours,
      opportunityCostPerHour: asset.value ? asset.value * 0.01 : null,
      lostOpportunityCost: result.lostOpportunityCost,
    },
    create: {
      companyId: asset.companyId,
      assetId: asset.id,
      year,
      month,
      totalCalendarHours: result.totalCalendarHours,
      availableHours: result.availableHours,
      downtimeHours: result.downtimeHours,
      availabilityPercent: result.availabilityPercent,
      breakdownHours: result.breakdownHours,
      maintenanceHours: result.maintenanceHours,
      waitingPartsHours: result.waitingPartsHours,
      otherDowntimeHours: result.otherDowntimeHours,
      opportunityCostPerHour: asset.value ? asset.value * 0.01 : null,
      lostOpportunityCost: result.lostOpportunityCost,
    },
  });

  return result;
}

/**
 * Calculate duration in minutes (for ongoing downtimes)
 */
function calculateDurationMinutes(downtime: { startedAt: Date; endedAt: Date | null }): number {
  const endTime = downtime.endedAt || new Date();
  return Math.round((endTime.getTime() - downtime.startedAt.getTime()) / (1000 * 60));
}

/**
 * Get availability dashboard data
 */
export async function getAvailabilityDashboard(
  companyId: string,
  year?: number,
  month?: number
) {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;

  // Get all assets with their availability
  const availabilities = await db.assetAvailability.findMany({
    where: {
      companyId,
      year: targetYear,
      month: targetMonth,
    },
    include: {
      asset: {
        select: {
          code: true,
          description: true,
          status: true,
        },
      },
    },
  });

  // Get assets without availability records (assume 100% available)
  const allAssets = await db.asset.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      code: true,
      description: true,
      status: true,
    },
  });

  const assetsWithoutRecords = allAssets.filter(
    (a) => !availabilities.find((av) => av.assetId === a.id)
  );

  // Create traffic light view
  const trafficLight = {
    green: [] as any[], // >90% available
    yellow: [] as any[], // 70-90% available
    red: [] as any[], // <70% available
  };

  // Add recorded availabilities
  for (const av of availabilities) {
    const item = {
      assetId: av.assetId,
      assetCode: av.asset.code,
      assetDescription: av.asset.description,
      availabilityPercent: av.availabilityPercent,
      downtimeHours: av.downtimeHours,
      lostOpportunityCost: av.lostOpportunityCost,
    };

    if (av.availabilityPercent >= 90) {
      trafficLight.green.push(item);
    } else if (av.availabilityPercent >= 70) {
      trafficLight.yellow.push(item);
    } else {
      trafficLight.red.push(item);
    }
  }

  // Add assets without records as 100% available
  for (const asset of assetsWithoutRecords) {
    trafficLight.green.push({
      assetId: asset.id,
      assetCode: asset.code,
      assetDescription: asset.description,
      availabilityPercent: 100,
      downtimeHours: 0,
      lostOpportunityCost: 0,
    });
  }

  // Get active downtimes
  const activeDowntimes = await db.downtimeLog.findMany({
    where: {
      companyId,
      endedAt: null,
    },
    include: {
      asset: {
        select: {
          code: true,
          description: true,
        },
      },
    },
  });

  // Calculate fleet totals
  const totalAssets = allAssets.length;
  const totalDowntimeHours = availabilities.reduce((sum, av) => sum + av.downtimeHours, 0);
  const totalLostOpportunityCost = availabilities.reduce((sum, av) => sum + av.lostOpportunityCost, 0);
  const avgAvailability =
    availabilities.length > 0
      ? availabilities.reduce((sum, av) => sum + av.availabilityPercent, 0) / availabilities.length
      : 100;

  return {
    year: targetYear,
    month: targetMonth,
    fleetStats: {
      totalAssets,
      avgAvailability,
      totalDowntimeHours,
      totalLostOpportunityCost,
    },
    trafficLight,
    activeDowntimes: activeDowntimes.map((d) => ({
      id: d.id,
      assetId: d.assetId,
      assetCode: d.asset.code,
      assetDescription: d.asset.description,
      category: d.category,
      startedAt: d.startedAt,
      durationMinutes: calculateDurationMinutes(d),
      notes: d.notes,
    })),
  };
}

/**
 * Get downtime pareto analysis
 */
export async function getDowntimePareto(companyId: string, year?: number, month?: number) {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;

  // Get all downtime logs for the period
  const downtimes = await db.downtimeLog.findMany({
    where: {
      companyId,
      startedAt: {
        gte: new Date(targetYear, targetMonth - 1, 1),
        lt: new Date(targetYear, targetMonth, 1),
      },
      endedAt: { not: null },
    },
    include: {
      asset: {
        select: {
          code: true,
          description: true,
        },
      },
    },
  });

  // Aggregate by category
  const categoryTotals: Record<string, { minutes: number; count: number; assets: string[] }> = {};

  for (const d of downtimes) {
    if (!categoryTotals[d.category]) {
      categoryTotals[d.category] = { minutes: 0, count: 0, assets: [] };
    }
    categoryTotals[d.category].minutes += d.durationMinutes || 0;
    categoryTotals[d.category].count += 1;
    if (!categoryTotals[d.category].assets.includes(d.asset.code)) {
      categoryTotals[d.category].assets.push(d.asset.code);
    }
  }

  // Convert to array and sort by duration
  const paretoData = Object.entries(categoryTotals)
    .map(([category, data]) => ({
      category,
      hours: Math.round((data.minutes / 60) * 100) / 100,
      count: data.count,
      assets: data.assets,
    }))
    .sort((a, b) => b.hours - a.hours);

  // Calculate cumulative percentage
  const totalHours = paretoData.reduce((sum, item) => sum + item.hours, 0);
  let cumulative = 0;
  for (const item of paretoData) {
    cumulative += item.hours;
    (item as any).cumulativePercent = Math.round((cumulative / totalHours) * 100);
  }

  return {
    paretoData,
    totalHours,
    totalEvents: downtimes.length,
  };
}
