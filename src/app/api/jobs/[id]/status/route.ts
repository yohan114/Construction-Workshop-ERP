import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { calculateLaborCost, canCloseJob, createCostSnapshot } from '@/lib/costing';

// POST - Update job status with workflow
export async function POST(
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
    const { action, notes, safetyPhotoUrl } = body;

    const job = await db.job.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
      include: {
        asset: {
          select: {
            safetyCritical: true,
            category: true,
          },
        },
        failureType: {
          select: {
            safetyCritical: true,
          },
        },
        itemRequests: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Define valid status transitions
    const transitions: Record<string, string[]> = {
      'CREATED': ['ASSIGNED', 'CANCELLED'],
      'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['PAUSED', 'COMPLETED'],
      'PAUSED': ['IN_PROGRESS', 'CANCELLED'],
      'COMPLETED': ['CLOSED'],
    };

    const newStatusMap: Record<string, string> = {
      'assign': 'ASSIGNED',
      'start': 'IN_PROGRESS',
      'pause': 'PAUSED',
      'resume': 'IN_PROGRESS',
      'complete': 'COMPLETED',
      'close': 'CLOSED',
      'cancel': 'CANCELLED',
    };

    const newStatus = newStatusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check if transition is valid
    if (!transitions[job.status]?.includes(newStatus)) {
      return NextResponse.json({ 
        error: `Cannot ${action} from ${job.status} status` 
      }, { status: 400 });
    }

    // Check for pending item returns before completing
    if (action === 'complete') {
      const pendingReturns = job.itemRequests.some(req => 
        req.lines.some(line => 
          (line.issuedQty || 0) > (line.returnedQty || 0)
        )
      );
      
      if (pendingReturns) {
        return NextResponse.json({ 
          error: 'Cannot complete job with pending item returns. Please return all unused items first.' 
        }, { status: 400 });
      }

      // Check safety photo requirement
      const isSafetyCritical = 
        job.asset?.safetyCritical || 
        job.failureType?.safetyCritical ||
        job.safetyPhotoRequired;

      if (isSafetyCritical && !job.safetyPhotoUrl && !safetyPhotoUrl) {
        return NextResponse.json({ 
          error: 'Safety photo is required for this job. Please upload a photo before completing.',
          code: 'SAFETY_PHOTO_REQUIRED',
        }, { status: 400 });
      }
    }

    // Check for job closure requirements
    if (action === 'close') {
      const closeCheck = await canCloseJob(id);
      if (!closeCheck.canClose) {
        return NextResponse.json({ 
          error: closeCheck.reasons.join(' '),
          reasons: closeCheck.reasons,
        }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedBy: payload.userId,
    };

    // Add timestamps based on action
    switch (action) {
      case 'start':
        updateData.startedAt = new Date();
        break;
      case 'pause':
        updateData.pausedAt = new Date();
        break;
      case 'resume':
        // Calculate pause duration
        if (job.pausedAt) {
          const pauseDuration = Math.floor(
            (new Date().getTime() - job.pausedAt.getTime()) / 1000
          );
          updateData.totalPauseTime = (job.totalPauseTime || 0) + pauseDuration;
          updateData.pausedAt = null;
        }
        break;
      case 'complete':
        updateData.completedAt = new Date();
        if (notes) updateData.closureNotes = notes;
        if (safetyPhotoUrl) updateData.safetyPhotoUrl = safetyPhotoUrl;
        break;
      case 'close':
        updateData.closedAt = new Date();
        break;
    }

    const updatedJob = await db.job.update({
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

    // Calculate labor cost on completion
    if (action === 'complete') {
      await calculateLaborCost(id, payload.userId);
    }

    // Create immutable cost snapshot on closure
    if (action === 'close') {
      await createCostSnapshot(id, payload.userId);
    }

    // Create notifications
    if (action === 'complete') {
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
            title: 'Job Completed',
            message: `Job "${job.title}" has been completed`,
            type: 'JOB_COMPLETED',
            referenceId: job.id,
          },
        });
      }
    }

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error('Update job status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
