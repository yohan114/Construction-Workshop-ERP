import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET /api/reports - Generate reports
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJWT(accessToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'executive';
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const assetId = searchParams.get('assetId');

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    switch (reportType) {
      case 'executive':
        return await generateExecutiveDashboard(payload.companyId, targetYear, targetMonth);

      case 'availability':
        return await generateAvailabilityReport(payload.companyId, targetYear, targetMonth);

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

async function generateExecutiveDashboard(companyId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Total maintenance spend
  const costLogs = await db.jobCostLog.findMany({
    where: { companyId, createdAt: { gte: startDate, lte: endDate } },
  });

  const totalSpend = costLogs.reduce((sum, log) => sum + log.amount, 0);
  const materialSpend = costLogs.filter((l) => l.costType === 'MATERIAL').reduce((sum, l) => sum + l.amount, 0);
  const laborSpend = costLogs.filter((l) => l.costType === 'LABOR').reduce((sum, l) => sum + l.amount, 0);
  const fuelSpend = costLogs.filter((l) => l.costType === 'FUEL').reduce((sum, l) => sum + l.amount, 0);
  const externalSpend = costLogs.filter((l) => l.costType === 'SERVICE').reduce((sum, l) => sum + l.amount, 0);

  // Job stats
  const totalJobs = await db.job.count({ where: { companyId, createdAt: { gte: startDate, lte: endDate } } });
  const completedJobs = await db.job.count({ where: { companyId, status: 'CLOSED', closedAt: { gte: startDate, lte: endDate } } });
  const preventiveJobs = await db.job.count({ where: { companyId, type: 'PREVENTIVE', createdAt: { gte: startDate, lte: endDate } } });
  const breakdownJobs = await db.job.count({ where: { companyId, type: 'BREAKDOWN', createdAt: { gte: startDate, lte: endDate } } });

  // Safety compliance
  const safetyCriticalJobs = await db.job.count({ where: { companyId, safetyCritical: true, createdAt: { gte: startDate, lte: endDate } } });
  const jobsWithSafetyPhotos = await db.job.count({ where: { companyId, safetyCritical: true, safetyPhotoUrl: { not: null }, createdAt: { gte: startDate, lte: endDate } } });
  const safetyCompliance = safetyCriticalJobs > 0 ? (jobsWithSafetyPhotos / safetyCriticalJobs) * 100 : 100;

  // Alerts
  const activeAlerts = await db.alert.count({ where: { companyId, isResolved: false } });
  const criticalAlerts = await db.alert.count({ where: { companyId, isResolved: false, severity: 'CRITICAL' } });

  // Assets
  const totalAssets = await db.asset.count({ where: { companyId } });
  const activeAssets = await db.asset.count({ where: { companyId, status: 'ACTIVE' } });

  return NextResponse.json({
    period: { year, month },
    fleetAvailability: {
      totalAssets,
      activeAssets,
      avgAvailability: 95, // Placeholder
    },
    maintenanceSpend: { total: totalSpend, material: materialSpend, labor: laborSpend, fuel: fuelSpend, external: externalSpend },
    jobs: { total: totalJobs, completed: completedJobs, preventive: preventiveJobs, breakdown: breakdownJobs },
    safety: { compliance: safetyCompliance, criticalJobs: safetyCriticalJobs, compliantJobs: jobsWithSafetyPhotos },
    alerts: { active: activeAlerts, critical: criticalAlerts },
  });
}

async function generateAvailabilityReport(companyId: string, year: number, month: number) {
  const assets = await db.asset.findMany({
    where: { companyId },
    select: { id: true, code: true, description: true, status: true },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCalendarHours = daysInMonth * 24;

  const availabilityData = await Promise.all(
    assets.map(async (asset) => {
      const downtimeLogs = await db.downtimeLog.findMany({
        where: {
          assetId: asset.id,
          startedAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
        },
      });

      let totalDowntimeMinutes = 0;
      for (const log of downtimeLogs) {
        totalDowntimeMinutes += log.durationMinutes || 0;
      }

      const downtimeHours = totalDowntimeMinutes / 60;
      const availableHours = totalCalendarHours - downtimeHours;
      const availabilityPercent = (availableHours / totalCalendarHours) * 100;

      return {
        assetId: asset.id,
        assetCode: asset.code,
        assetDescription: asset.description,
        status: asset.status,
        totalCalendarHours,
        availableHours,
        downtimeHours,
        availabilityPercent,
      };
    })
  );

  const trafficLight = {
    green: availabilityData.filter((a) => a.availabilityPercent >= 90),
    yellow: availabilityData.filter((a) => a.availabilityPercent >= 70 && a.availabilityPercent < 90),
    red: availabilityData.filter((a) => a.availabilityPercent < 70),
  };

  return NextResponse.json({
    period: { year, month },
    trafficLight,
    assets: availabilityData,
  });
}
