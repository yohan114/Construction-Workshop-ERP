import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET /api/period-locks - List period locks
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
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: any = { companyId: payload.companyId };

    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);

    const locks = await db.periodLock.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24,
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentLock = await db.periodLock.findUnique({
      where: {
        companyId_year_month: {
          companyId: payload.companyId,
          year: currentYear,
          month: currentMonth,
        },
      },
    });

    return NextResponse.json({
      locks,
      currentPeriod: {
        year: currentYear,
        month: currentMonth,
        isLocked: currentLock?.isLocked || false,
      },
    });
  } catch (error) {
    console.error('Error fetching period locks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch period locks' },
      { status: 500 }
    );
  }
}

// POST /api/period-locks - Lock/Unlock a period
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJWT(accessToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only admin and manager can lock periods
    if (!['ADMIN', 'MANAGER'].includes(payload.role)) {
      return NextResponse.json(
        { error: 'Only administrators and managers can lock periods' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { year, month, action } = body;

    if (!year || !month || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: year, month, action' },
        { status: 400 }
      );
    }

    if (action === 'lock') {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const costLogs = await db.jobCostLog.findMany({
        where: {
          companyId: payload.companyId,
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const totalMaterialCost = costLogs.filter((l) => l.costType === 'MATERIAL').reduce((sum, l) => sum + l.amount, 0);
      const totalLaborCost = costLogs.filter((l) => l.costType === 'LABOR').reduce((sum, l) => sum + l.amount, 0);
      const totalFuelCost = costLogs.filter((l) => l.costType === 'FUEL').reduce((sum, l) => sum + l.amount, 0);
      const totalExternalCost = costLogs.filter((l) => l.costType === 'SERVICE').reduce((sum, l) => sum + l.amount, 0);
      const totalCost = totalMaterialCost + totalLaborCost + totalFuelCost + totalExternalCost;

      const closedJobs = await db.job.count({
        where: {
          companyId: payload.companyId,
          closedAt: { gte: startDate, lte: endDate },
        },
      });

      const lock = await db.periodLock.upsert({
        where: {
          companyId_year_month: { companyId: payload.companyId, year, month },
        },
        update: {
          isLocked: true,
          lockedAt: new Date(),
          lockedById: payload.userId,
          totalMaterialCost, totalLaborCost, totalFuelCost, totalExternalCost, totalCost, jobsClosed: closedJobs,
        },
        create: {
          companyId: payload.companyId, year, month, isLocked: true, lockedAt: new Date(), lockedById: payload.userId,
          totalMaterialCost, totalLaborCost, totalFuelCost, totalExternalCost, totalCost, jobsClosed: closedJobs,
        },
      });

      await db.auditLog.create({
        data: { userId: payload.userId, action: 'LOCK', entity: 'PeriodLock', entityId: lock.id, newValue: JSON.stringify(lock) },
      });

      return NextResponse.json(lock);
    }

    if (action === 'unlock') {
      if (payload.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only administrators can unlock periods' }, { status: 403 });
      }

      const lock = await db.periodLock.update({
        where: { companyId_year_month: { companyId: payload.companyId, year, month } },
        data: { isLocked: false },
      });

      await db.auditLog.create({
        data: { userId: payload.userId, action: 'UNLOCK', entity: 'PeriodLock', entityId: lock.id },
      });

      return NextResponse.json(lock);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing period lock:', error);
    return NextResponse.json({ error: 'Failed to manage period lock' }, { status: 500 });
  }
}
