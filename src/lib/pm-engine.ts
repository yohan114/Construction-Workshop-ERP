/**
 * Preventive Maintenance Engine
 * Handles PM schedule calculations, job generation, and meter tracking
 */

import { db } from '@/lib/db';
import { JobType, JobPriority, JobStatus } from '@prisma/client';

// Types
export interface PMScheduleConfig {
  assetId: string;
  intervalType: 'HOURS' | 'DAYS' | 'KILOMETERS' | 'MILES';
  intervalValue: number;
  jobTitleTemplate: string;
  jobDescription?: string;
  estimatedDuration?: number;
  priority?: JobPriority;
}

export interface MeterReadingInput {
  assetId: string;
  companyId: string;
  reading: number;
  effectiveDate: Date;
  photoUrl?: string;
  notes?: string;
  jobId?: string;
  userId?: string;
}

export interface PMCheckResult {
  assetId: string;
  assetCode: string;
  assetDescription: string;
  scheduleId: string;
  isDue: boolean;
  isOverdue: boolean;
  currentMeter: number;
  nextDueMeter: number;
  daysOverdue?: number;
  hoursOverdue?: number;
}

/**
 * Create or update PM schedule for an asset
 */
export async function configurePMSchedule(
  companyId: string,
  config: PMScheduleConfig,
  userId?: string
) {
  // Check if schedule already exists
  const existing = await db.pMSchedule.findFirst({
    where: {
      companyId,
      assetId: config.assetId,
      isActive: true,
    },
  });

  // Get current asset meter
  const asset = await db.asset.findUnique({
    where: { id: config.assetId },
    select: { currentMeter: true },
  });

  const currentMeter = asset?.currentMeter || 0;
  const nextDueMeter = currentMeter + config.intervalValue;

  if (existing) {
    // Update existing schedule
    return db.pMSchedule.update({
      where: { id: existing.id },
      data: {
        intervalType: config.intervalType,
        intervalValue: config.intervalValue,
        jobTitleTemplate: config.jobTitleTemplate,
        jobDescription: config.jobDescription,
        estimatedDuration: config.estimatedDuration,
        priority: config.priority || JobPriority.MEDIUM,
        nextDueMeter,
        updatedBy: userId,
      },
    });
  }

  // Create new schedule
  return db.pMSchedule.create({
    data: {
      companyId,
      assetId: config.assetId,
      intervalType: config.intervalType,
      intervalValue: config.intervalValue,
      lastServiceMeter: currentMeter,
      nextDueMeter,
      jobTitleTemplate: config.jobTitleTemplate,
      jobDescription: config.jobDescription,
      estimatedDuration: config.estimatedDuration,
      priority: config.priority || JobPriority.MEDIUM,
      isActive: true,
      createdBy: userId,
    },
  });
}

/**
 * Record a meter reading with validation
 */
export async function recordMeterReading(
  input: MeterReadingInput,
  userId?: string
) {
  const { assetId, companyId, reading, effectiveDate, photoUrl, notes, jobId } = input;

  // Get asset and previous reading
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      currentMeter: true,
      meterType: true,
      meterBroken: true,
      code: true,
      description: true,
    },
  });

  if (!asset) {
    throw new Error('Asset not found');
  }

  const previousReading = asset.currentMeter || 0;
  const isRollback = reading < previousReading;
  const now = new Date();

  // Check for late entry
  const isLateEntry = effectiveDate < new Date(now.toDateString());

  // Create meter reading record
  const meterReading = await db.meterReading.create({
    data: {
      companyId,
      assetId,
      reading,
      readingDate: now,
      effectiveDate,
      isLateEntry,
      previousReading,
      isRollback,
      rollbackHandled: false,
      photoUrl,
      notes,
      jobId,
      createdBy: userId,
    },
  });

  // Update asset current meter
  await db.asset.update({
    where: { id: assetId },
    data: {
      currentMeter: reading,
      lastMeterUpdate: now,
      meterBroken: false,
    },
  });

  // Check PM schedules and generate jobs if due
  const generatedJobs = await checkAndGeneratePMJobs(companyId, assetId, userId);

  // Create alert for rollback
  if (isRollback) {
    await db.alert.create({
      data: {
        companyId,
        type: 'METER_ROLLBACK',
        severity: 'HIGH',
        title: `Meter Rollback Detected - ${asset.code}`,
        message: `Meter reading decreased from ${previousReading} to ${reading} on asset ${asset.description}`,
        referenceType: 'ASSET',
        referenceId: assetId,
      },
    });
  }

  return {
    meterReading,
    isRollback,
    generatedJobs,
  };
}

/**
 * Check if PM is due and generate job if needed
 */
export async function checkAndGeneratePMJobs(
  companyId: string,
  assetId?: string,
  userId?: string
): Promise<string[]> {
  const whereClause: any = {
    companyId,
    isActive: true,
  };

  if (assetId) {
    whereClause.assetId = assetId;
  }

  const schedules = await db.pMSchedule.findMany({
    where: whereClause,
    include: {
      asset: {
        select: {
          id: true,
          code: true,
          description: true,
          currentMeter: true,
        },
      },
    },
  });

  const generatedJobIds: string[] = [];

  for (const schedule of schedules) {
    const currentMeter = schedule.asset.currentMeter || 0;
    const isDue = currentMeter >= schedule.nextDueMeter;

    if (!isDue) continue;

    // Check if there's already a pending PM job for this schedule
    const existingJob = await db.job.findFirst({
      where: {
        companyId,
        assetId: schedule.assetId,
        pmScheduleId: schedule.id,
        status: { in: [JobStatus.CREATED, JobStatus.ASSIGNED, JobStatus.IN_PROGRESS] },
        isVoid: false,
      },
    });

    if (existingJob) continue;

    // Generate PM job
    const jobTitle = schedule.jobTitleTemplate
      .replace('{asset_code}', schedule.asset.code)
      .replace('{asset_description}', schedule.asset.description);

    const job = await db.job.create({
      data: {
        companyId,
        assetId: schedule.assetId,
        pmScheduleId: schedule.id,
        title: jobTitle,
        description: schedule.jobDescription || `Preventive maintenance for ${schedule.asset.description}`,
        type: JobType.PREVENTIVE,
        priority: schedule.priority,
        status: JobStatus.CREATED,
        createdById: userId || 'system',
        createdBy: userId,
      },
    });

    generatedJobIds.push(job.id);

    // Update schedule's last service meter
    await db.pMSchedule.update({
      where: { id: schedule.id },
      data: {
        lastServiceMeter: currentMeter,
        lastServiceDate: new Date(),
        nextDueMeter: currentMeter + schedule.intervalValue,
      },
    });
  }

  return generatedJobIds;
}

/**
 * Get PM status for all assets
 */
export async function getPMStatus(companyId: string): Promise<PMCheckResult[]> {
  const schedules = await db.pMSchedule.findMany({
    where: {
      companyId,
      isActive: true,
    },
    include: {
      asset: {
        select: {
          id: true,
          code: true,
          description: true,
          currentMeter: true,
        },
      },
    },
  });

  return schedules.map((schedule) => {
    const currentMeter = schedule.asset.currentMeter || 0;
    const isDue = currentMeter >= schedule.nextDueMeter;
    const isOverdue = isDue && currentMeter > schedule.nextDueMeter + schedule.intervalValue * 0.1;

    const result: PMCheckResult = {
      assetId: schedule.asset.id,
      assetCode: schedule.asset.code,
      assetDescription: schedule.asset.description,
      scheduleId: schedule.id,
      isDue,
      isOverdue,
      currentMeter,
      nextDueMeter: schedule.nextDueMeter,
    };

    if (isOverdue) {
      const overAmount = currentMeter - schedule.nextDueMeter;
      if (schedule.intervalType === 'HOURS') {
        result.hoursOverdue = overAmount;
      } else {
        result.daysOverdue = overAmount;
      }
    }

    return result;
  });
}

/**
 * Get meter reading history for an asset
 */
export async function getMeterHistory(
  assetId: string,
  limit: number = 30
) {
  return db.meterReading.findMany({
    where: { assetId },
    orderBy: { readingDate: 'desc' },
    take: limit,
    include: {
      asset: {
        select: {
          code: true,
          description: true,
          meterType: true,
        },
      },
    },
  });
}

/**
 * Nightly PM Check (Cron Job Handler)
 * Call this at 02:00 AM to check all assets and generate PM jobs
 */
export async function runNightlyPMCheck(companyId?: string) {
  const companies = companyId
    ? [{ id: companyId }]
    : await db.company.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

  const results: { companyId: string; jobsGenerated: string[] }[] = [];

  for (const company of companies) {
    const jobsGenerated = await checkAndGeneratePMJobs(company.id, undefined, 'system');
    results.push({
      companyId: company.id,
      jobsGenerated,
    });
  }

  return results;
}

/**
 * Get PM Calendar Events
 */
export async function getPMCalendarEvents(
  companyId: string,
  startDate: Date,
  endDate: Date
) {
  // Get all PM jobs in the date range
  const pmJobs = await db.job.findMany({
    where: {
      companyId,
      type: JobType.PREVENTIVE,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
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

  // Get PM schedules with upcoming due dates
  const schedules = await db.pMSchedule.findMany({
    where: {
      companyId,
      isActive: true,
    },
    include: {
      asset: {
        select: {
          code: true,
          description: true,
          currentMeter: true,
        },
      },
    },
  });

  // Calculate expected due dates based on average usage
  const events = schedules.map((schedule) => {
    const currentMeter = schedule.asset.currentMeter || 0;
    const remainingUntilDue = schedule.nextDueMeter - currentMeter;

    // Estimate days until due (assuming 8 hours usage per day for hours-based)
    let estimatedDaysUntilDue = 0;
    if (remainingUntilDue > 0) {
      if (schedule.intervalType === 'HOURS') {
        estimatedDaysUntilDue = remainingUntilDue / 8; // 8 hours per day
      } else if (schedule.intervalType === 'DAYS') {
        estimatedDaysUntilDue = remainingUntilDue;
      } else {
        estimatedDaysUntilDue = remainingUntilDue / 100; // Assume 100 km/miles per day
      }
    }

    const estimatedDueDate = new Date();
    estimatedDueDate.setDate(estimatedDueDate.getDate() + estimatedDaysUntilDue);

    return {
      id: schedule.id,
      title: schedule.jobTitleTemplate.replace('{asset_code}', schedule.asset.code),
      assetCode: schedule.asset.code,
      assetDescription: schedule.asset.description,
      dueDate: estimatedDueDate,
      isDue: remainingUntilDue <= 0,
      isOverdue: remainingUntilDue < -schedule.intervalValue * 0.1,
      currentMeter,
      nextDueMeter: schedule.nextDueMeter,
      intervalType: schedule.intervalType,
      intervalValue: schedule.intervalValue,
    };
  });

  return {
    jobs: pmJobs,
    upcoming: events.filter((e) => e.dueDate <= endDate),
  };
}
