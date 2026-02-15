import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import crypto from 'crypto';

// GET - List item requests
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
    const mine = searchParams.get('mine');

    const where: Record<string, unknown> = {
      job: {
        companyId: payload.companyId,
      },
    };

    if (status) {
      where.status = status;
    }

    if (jobId) {
      where.jobId = jobId;
    }

    if (mine === 'true') {
      where.requestedById = payload.userId;
    }

    const requests = await db.itemRequest.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
            asset: {
              select: {
                code: true,
                description: true,
              },
            },
          },
        },
        lines: {
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
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new item request
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
    const { jobId, storeId, lines, localId } = body;

    if (!jobId || !storeId || !lines || lines.length === 0) {
      return NextResponse.json({ 
        error: 'Job, store, and at least one item are required' 
      }, { status: 400 });
    }

    // Verify job exists and belongs to company
    const job = await db.job.findFirst({
      where: {
        id: jobId,
        companyId: payload.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check job is in a state that allows requests
    if (!['ASSIGNED', 'IN_PROGRESS', 'PAUSED'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Cannot request items for job in current status' 
      }, { status: 400 });
    }

    // Verify store
    const store = await db.store.findFirst({
      where: {
        id: storeId,
        companyId: payload.companyId,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Create the request
    const itemRequest = await db.itemRequest.create({
      data: {
        jobId,
        storeId,
        requestedById: payload.userId,
        localId,
        syncStatus: 'SYNCED',
        createdBy: payload.userId,
        lines: {
          create: lines.map((line: { itemId: string; quantity: number }) => ({
            itemId: line.itemId,
            requestedQty: line.quantity,
          })),
        },
      },
      include: {
        lines: {
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
        },
        job: true,
        store: true,
      },
    });

    // Notify supervisors
    const supervisors = await db.user.findMany({
      where: {
        companyId: payload.companyId,
        role: { in: ['SUPERVISOR', 'ADMIN', 'MANAGER'] },
        status: 'ACTIVE',
      },
    });

    for (const supervisor of supervisors) {
      await db.notification.create({
        data: {
          userId: supervisor.id,
          title: 'New Item Request',
          message: `Item request for job "${job.title}" pending approval`,
          type: 'REQUEST_PENDING',
          referenceId: itemRequest.id,
        },
      });
    }

    return NextResponse.json({ request: itemRequest }, { status: 201 });
  } catch (error) {
    console.error('Create request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
