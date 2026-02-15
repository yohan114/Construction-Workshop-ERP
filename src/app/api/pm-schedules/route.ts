import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET /api/pm-schedules - List PM schedules
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
    const assetId = searchParams.get('assetId');
    const includeStatus = searchParams.get('includeStatus') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const where: any = {
      companyId: payload.companyId,
    };

    if (assetId) {
      where.assetId = assetId;
    }

    const schedules = await db.pMSchedule.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            code: true,
            description: true,
            currentMeter: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      schedules,
    });
  } catch (error) {
    console.error('Error fetching PM schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PM schedules' },
      { status: 500 }
    );
  }
}

// POST /api/pm-schedules - Create PM schedule
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

    // Only admin, manager, supervisor can create
    if (!['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      assetId,
      intervalType,
      intervalValue,
      jobTitleTemplate,
      jobDescription,
      estimatedDuration,
      priority,
    } = body;

    // Validate required fields
    if (!assetId || !intervalType || !intervalValue || !jobTitleTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, intervalType, intervalValue, jobTitleTemplate' },
        { status: 400 }
      );
    }

    // Get current asset meter
    const asset = await db.asset.findUnique({
      where: { id: assetId },
      select: { currentMeter: true },
    });

    const currentMeter = asset?.currentMeter || 0;
    const nextDueMeter = currentMeter + parseFloat(intervalValue);

    // Create PM schedule
    const schedule = await db.pMSchedule.create({
      data: {
        companyId: payload.companyId,
        assetId,
        intervalType: intervalType as any,
        intervalValue: parseFloat(intervalValue),
        lastServiceMeter: currentMeter,
        nextDueMeter,
        jobTitleTemplate,
        jobDescription,
        estimatedDuration: estimatedDuration ? parseFloat(estimatedDuration) : null,
        priority: priority || 'MEDIUM',
        isActive: true,
        createdBy: payload.userId,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'PMSchedule',
        entityId: schedule.id,
        newValue: JSON.stringify(schedule),
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error('Error creating PM schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create PM schedule' },
      { status: 500 }
    );
  }
}
