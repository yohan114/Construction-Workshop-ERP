import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { getJobCostBreakdown, createCostSnapshot } from '@/lib/costing';

// GET - Get job cost breakdown
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
        costLogs: {
          orderBy: { createdAt: 'asc' },
        },
        costSnapshot: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const breakdown = await getJobCostBreakdown(id);

    // Calculate labor hours
    let laborHours = 0;
    if (job.startedAt) {
      const startTime = new Date(job.startedAt).getTime();
      const endTime = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
      const totalSeconds = (endTime - startTime) / 1000;
      laborHours = (totalSeconds - (job.totalPauseTime || 0)) / 3600;
    }

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
      },
      breakdown,
      laborHours,
      hourlyRate: job.assignedTo?.hourlyRate || 0,
      costLogs: job.costLogs,
      costSnapshot: job.costSnapshot,
    });
  } catch (error) {
    console.error('Get job cost error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
