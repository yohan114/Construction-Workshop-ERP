import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get single job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJWT(accessToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const job = await db.job.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
      include: {
        asset: true,
        failureType: true,
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
            store: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update job
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJWT(accessToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { 
      title, 
      description, 
      priority, 
      assignedToId,
      closureNotes,
      afterPhotos,
    } = body;

    const existingJob = await db.job.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedBy: payload.userId,
    };

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId;
      if (assignedToId && existingJob.status === 'CREATED') {
        updateData.status = 'ASSIGNED';
      }
    }
    if (closureNotes !== undefined) updateData.closureNotes = closureNotes;
    if (afterPhotos) updateData.afterPhotos = JSON.stringify(afterPhotos);

    const job = await db.job.update({
      where: { id },
      data: updateData,
      include: {
        asset: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify if assigned
    if (assignedToId && assignedToId !== existingJob.assignedToId) {
      await db.notification.create({
        data: {
          userId: assignedToId,
          title: 'Job Assigned',
          message: `Job "${job.title}" has been assigned to you`,
          type: 'JOB_ASSIGNED',
          referenceId: job.id,
        },
      });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJWT(accessToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const job = await db.job.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Only allow deletion of CREATED or CANCELLED jobs
    if (!['CREATED', 'CANCELLED'].includes(job.status)) {
      return NextResponse.json({ 
        error: 'Cannot delete job in current status' 
      }, { status: 400 });
    }

    await db.job.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
