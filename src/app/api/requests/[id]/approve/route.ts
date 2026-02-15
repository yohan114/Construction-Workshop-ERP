import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// POST - Approve or reject request
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

    // Only supervisors/admins/managers can approve
    if (!['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, approvedLines } = body;

    const itemRequest = await db.itemRequest.findFirst({
      where: {
        id,
        job: {
          companyId: payload.companyId,
        },
      },
      include: {
        lines: true,
        job: true,
      },
    });

    if (!itemRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (itemRequest.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Request already processed' 
      }, { status: 400 });
    }

    if (action === 'reject') {
      const updated = await db.itemRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          approvedById: payload.userId,
          approvedAt: new Date(),
          updatedBy: payload.userId,
        },
      });

      // Notify requester
      await db.notification.create({
        data: {
          userId: itemRequest.requestedById,
          title: 'Request Rejected',
          message: `Your item request for job "${itemRequest.job.title}" was rejected`,
          type: 'REQUEST_REJECTED',
          referenceId: itemRequest.id,
        },
      });

      return NextResponse.json({ request: updated });
    }

    if (action === 'approve') {
      // Update request status and line quantities
      const updatePromises = (approvedLines || []).map((line: { lineId: string; quantity: number }) =>
        db.itemRequestLine.update({
          where: { id: line.lineId },
          data: { approvedQty: line.quantity },
        })
      );

      await Promise.all(updatePromises);

      const updated = await db.itemRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: payload.userId,
          approvedAt: new Date(),
          updatedBy: payload.userId,
        },
        include: {
          lines: {
            include: {
              item: true,
            },
          },
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
            title: 'Items Ready for Issue',
            message: `Approved item request ready for issue`,
            type: 'REQUEST_APPROVED',
            referenceId: itemRequest.id,
          },
        });
      }

      // Notify requester
      await db.notification.create({
        data: {
          userId: itemRequest.requestedById,
          title: 'Request Approved',
          message: `Your item request for job "${itemRequest.job.title}" was approved`,
          type: 'REQUEST_APPROVED',
          referenceId: itemRequest.id,
        },
      });

      return NextResponse.json({ request: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Approve request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
