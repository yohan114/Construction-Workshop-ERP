import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List alerts
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

    // Only managers/supervisors/admins can view alerts
    if (!['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const unresolved = searchParams.get('unresolved');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity;
    }

    if (unresolved === 'true') {
      where.isResolved = false;
    }

    const alerts = await db.alert.findMany({
      where,
      orderBy: [
        { isResolved: 'asc' },
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
