import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET /api/meter-readings - List meter readings
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
    const limit = parseInt(searchParams.get('limit') || '30');

    if (assetId) {
      const readings = await db.meterReading.findMany({
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
      return NextResponse.json({ readings });
    }

    // Get all recent readings
    const readings = await db.meterReading.findMany({
      where: { companyId: payload.companyId },
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

    return NextResponse.json({ readings });
  } catch (error) {
    console.error('Error fetching meter readings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meter readings' },
      { status: 500 }
    );
  }
}

// POST /api/meter-readings - Record a new meter reading
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
    const { assetId, reading, effectiveDate, photoUrl, notes, jobId } = body;

    // Validate required fields
    if (!assetId || reading === undefined || reading === null) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, reading' },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const previousReading = asset.currentMeter || 0;
    const isRollback = parseFloat(reading) < previousReading;
    const now = new Date();

    // Check for late entry
    const effective = effectiveDate ? new Date(effectiveDate) : new Date();
    const isLateEntry = effective < new Date(now.toDateString());

    // Create meter reading record
    const meterReading = await db.meterReading.create({
      data: {
        companyId: payload.companyId,
        assetId,
        reading: parseFloat(reading),
        readingDate: now,
        effectiveDate: effective,
        isLateEntry,
        previousReading,
        isRollback,
        rollbackHandled: false,
        photoUrl,
        notes,
        jobId,
        createdBy: payload.userId,
      },
    });

    // Update asset current meter
    await db.asset.update({
      where: { id: assetId },
      data: {
        currentMeter: parseFloat(reading),
        lastMeterUpdate: now,
        meterBroken: false,
      },
    });

    // Create alert for rollback
    if (isRollback) {
      await db.alert.create({
        data: {
          companyId: payload.companyId,
          type: 'METER_ROLLBACK',
          severity: 'HIGH',
          title: `Meter Rollback Detected - ${asset.code}`,
          message: `Meter reading decreased from ${previousReading} to ${reading} on asset ${asset.description}`,
          referenceType: 'ASSET',
          referenceId: assetId,
        },
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'MeterReading',
        entityId: meterReading.id,
        newValue: JSON.stringify(meterReading),
      },
    });

    return NextResponse.json(
      {
        meterReading,
        isRollback,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording meter reading:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record meter reading' },
      { status: 500 }
    );
  }
}
