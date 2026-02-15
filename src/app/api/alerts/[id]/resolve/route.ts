import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// POST - Resolve an alert
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

    // Only managers/supervisors/admins can resolve alerts
    if (!['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { resolutionNotes } = body;

    const alert = await db.alert.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updated = await db.alert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: payload.userId,
        resolutionNotes,
      },
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error('Resolve alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
