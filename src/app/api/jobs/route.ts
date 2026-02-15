import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List jobs with filters
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
    const assignedToMe = searchParams.get('mine');
    const priority = searchParams.get('priority');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (status) {
      where.status = status;
    }

    if (assignedToMe === 'true') {
      where.assignedToId = payload.userId;
    }

    if (priority) {
      where.priority = priority;
    }

    const jobs = await db.job.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            code: true,
            description: true,
            location: true,
          },
        },
        failureType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
          },
        },
        itemRequests: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new job
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
    const { 
      assetId, 
      failureTypeId, 
      title, 
      description, 
      priority, 
      type,
      assignedToId,
      beforePhotos,
      localId,
    } = body;

    if (!assetId || !title) {
      return NextResponse.json({ error: 'Asset and title are required' }, { status: 400 });
    }

    // Verify asset belongs to company
    const asset = await db.asset.findFirst({
      where: {
        id: assetId,
        companyId: payload.companyId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const job = await db.job.create({
      data: {
        companyId: payload.companyId,
        assetId,
        failureTypeId,
        createdById: payload.userId,
        assignedToId,
        title,
        description,
        priority: priority || 'MEDIUM',
        type: type || 'BREAKDOWN',
        status: assignedToId ? 'ASSIGNED' : 'CREATED',
        beforePhotos: beforePhotos ? JSON.stringify(beforePhotos) : null,
        localId,
        syncStatus: 'SYNCED',
        createdBy: payload.userId,
      },
      include: {
        asset: true,
        failureType: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create notification for supervisor if assigned
    if (assignedToId) {
      await db.notification.create({
        data: {
          userId: assignedToId,
          title: 'New Job Assigned',
          message: `Job "${title}" has been assigned to you`,
          type: 'JOB_ASSIGNED',
          referenceId: job.id,
        },
      });
    } else {
      // Notify supervisors of new unassigned job
      const supervisors = await db.user.findMany({
        where: {
          companyId: payload.companyId,
          role: 'SUPERVISOR',
          status: 'ACTIVE',
        },
      });

      for (const supervisor of supervisors) {
        await db.notification.create({
          data: {
            userId: supervisor.id,
            title: 'New Job Created',
            message: `New job "${title}" needs assignment`,
            type: 'JOB_CREATED',
            referenceId: job.id,
          },
        });
      }
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
