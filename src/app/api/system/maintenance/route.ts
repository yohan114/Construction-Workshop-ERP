import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { getMaintenanceStatus, enableMaintenanceMode, disableMaintenanceMode } from '@/lib/maintenance';

/**
 * GET /api/system/maintenance
 * Get current maintenance mode status
 */
export async function GET(request: NextRequest) {
  const status = await getMaintenanceStatus();
  return NextResponse.json(status);
}

/**
 * POST /api/system/maintenance
 * Enable or disable maintenance mode (Admin only)
 */
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

    // Only admin can manage maintenance mode
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can manage maintenance mode' }, { status: 403 });
    }

    const body = await request.json();
    const { action, reason, estimatedMinutes } = body;

    if (action === 'enable') {
      if (!reason) {
        return NextResponse.json({ error: 'Reason is required when enabling maintenance mode' }, { status: 400 });
      }

      const status = await enableMaintenanceMode(reason, estimatedMinutes || 30, payload.userId);

      await db.auditLog.create({
        data: {
          userId: payload.userId,
          action: 'MAINTENANCE_ENABLE',
          entity: 'SystemConfig',
          newValue: JSON.stringify(status),
        },
      });

      return NextResponse.json(status);
    }

    if (action === 'disable') {
      await disableMaintenanceMode();

      await db.auditLog.create({
        data: {
          userId: payload.userId,
          action: 'MAINTENANCE_DISABLE',
          entity: 'SystemConfig',
        },
      });

      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing maintenance mode:', error);
    return NextResponse.json({ error: 'Failed to manage maintenance mode' }, { status: 500 });
  }
}
