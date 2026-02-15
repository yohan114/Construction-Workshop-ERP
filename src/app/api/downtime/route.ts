import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { DowntimeCategory } from '@prisma/client';

// GET /api/downtime - Get downtime data
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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const assetId = searchParams.get('assetId');

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    // If assetId provided, calculate availability for that asset
    if (assetId) {
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      const totalCalendarHours = daysInMonth * 24;

      const downtimeLogs = await db.downtimeLog.findMany({
        where: {
          assetId,
          startedAt: {
            gte: new Date(targetYear, targetMonth - 1, 1),
            lt: new Date(targetYear, targetMonth, 1),
          },
        },
      });

      let totalDowntimeMinutes = 0;
      for (const log of downtimeLogs) {
        totalDowntimeMinutes += log.durationMinutes || 0;
      }

      const downtimeHours = totalDowntimeMinutes / 60;
      const availableHours = totalCalendarHours - downtimeHours;
      const availabilityPercent = (availableHours / totalCalendarHours) * 100;

      return NextResponse.json({
        availability: {
          assetId,
          year: targetYear,
          month: targetMonth,
          totalCalendarHours,
          availableHours,
          downtimeHours,
          availabilityPercent,
        },
      });
    }

    // Get active downtimes
    const activeDowntimes = await db.downtimeLog.findMany({
      where: {
        companyId: payload.companyId,
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

    // Calculate duration for active downtimes
    const activeWithDuration = activeDowntimes.map((d) => ({
      ...d,
      durationMinutes: d.endedAt
        ? Math.round((d.endedAt.getTime() - d.startedAt.getTime()) / (1000 * 60))
        : Math.round((new Date().getTime() - d.startedAt.getTime()) / (1000 * 60)),
    }));

    return NextResponse.json({
      dashboard: {
        activeDowntimes: activeWithDuration,
      },
    });
  } catch (error) {
    console.error('Error fetching downtime data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downtime data' },
      { status: 500 }
    );
  }
}

// POST /api/downtime - Start/End downtime event
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

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'start') {
      const { assetId, jobId, category, subCategory, notes, opportunityCostPerHour } = data;

      if (!assetId) {
        return NextResponse.json(
          { error: 'Missing required field: assetId' },
          { status: 400 }
        );
      }

      // Check if there's already an active downtime
      const activeDowntime = await db.downtimeLog.findFirst({
        where: { assetId, endedAt: null },
      });

      if (activeDowntime) {
        return NextResponse.json(
          { error: 'Asset already has an active downtime event' },
          { status: 400 }
        );
      }

      const downtime = await db.downtimeLog.create({
        data: {
          companyId: payload.companyId,
          assetId,
          jobId,
          startedAt: new Date(),
          category: category as DowntimeCategory || 'BREAKDOWN',
          subCategory,
          notes,
          opportunityCostPerHour: opportunityCostPerHour ? parseFloat(opportunityCostPerHour) : null,
        },
      });

      return NextResponse.json(downtime, { status: 201 });
    }

    if (action === 'end') {
      const { downtimeLogId, notes } = data;

      if (!downtimeLogId) {
        return NextResponse.json(
          { error: 'Missing required field: downtimeLogId' },
          { status: 400 }
        );
      }

      const downtime = await db.downtimeLog.findUnique({
        where: { id: downtimeLogId },
      });

      if (!downtime || downtime.companyId !== payload.companyId) {
        return NextResponse.json({ error: 'Downtime log not found' }, { status: 404 });
      }

      if (downtime.endedAt) {
        return NextResponse.json({ error: 'Downtime already ended' }, { status: 400 });
      }

      const endedAt = new Date();
      const durationMs = endedAt.getTime() - downtime.startedAt.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      const updated = await db.downtimeLog.update({
        where: { id: downtimeLogId },
        data: {
          endedAt,
          durationMinutes,
          notes: notes ? `${downtime.notes || ''}\n${notes}`.trim() : downtime.notes,
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing downtime:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to manage downtime' },
      { status: 500 }
    );
  }
}
