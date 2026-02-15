import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List returns
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
    const status = searchParams.get('status');
    const jobId = searchParams.get('jobId');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (status) {
      where.status = status;
    }

    if (jobId) {
      where.jobId = jobId;
    }

    const returns = await db.itemReturn.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            code: true,
            description: true,
            uom: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ returns });
  } catch (error) {
    console.error('Get returns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create return
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
    const { jobId, storeId, itemId, quantity, condition, notes, localId } = body;

    if (!jobId || !itemId || !quantity) {
      return NextResponse.json({ 
        error: 'Job, item, and quantity are required' 
      }, { status: 400 });
    }

    // Verify job exists
    const job = await db.job.findFirst({
      where: {
        id: jobId,
        companyId: payload.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const itemReturn = await db.itemReturn.create({
      data: {
        companyId: payload.companyId,
        jobId,
        storeId,
        itemId,
        quantity,
        condition: condition || 'GOOD',
        notes,
        returnedById: payload.userId,
        localId,
        syncStatus: 'SYNCED',
      },
      include: {
        item: true,
      },
    });

    // Notify storekeeper
    const storekeepers = await db.user.findMany({
      where: {
        companyId: payload.companyId,
        role: 'STOREKEEPER',
        status: 'ACTIVE',
      },
    });

    for (const storekeeper of storekeepers) {
      await db.notification.create({
        data: {
          userId: storekeeper.id,
          title: 'Item Return Pending',
          message: `Return of ${quantity} ${itemReturn.item.description} pending acceptance`,
          type: 'RETURN_PENDING',
          referenceId: itemReturn.id,
        },
      });
    }

    return NextResponse.json({ return: itemReturn }, { status: 201 });
  } catch (error) {
    console.error('Create return error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
