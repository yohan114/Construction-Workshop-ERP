import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { runHealthChecks, quickHealthCheck } from '@/lib/health';
import { isMaintenanceMode } from '@/lib/maintenance';

/**
 * GET /api/system/health
 * Full health check for monitoring systems
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const quick = searchParams.get('quick') === 'true';

  // Quick check for load balancers
  if (quick) {
    const healthy = await quickHealthCheck();
    return NextResponse.json(
      { status: healthy ? 'ok' : 'error' },
      { status: healthy ? 200 : 503 }
    );
  }

  // Check maintenance mode
  const maintenanceMode = await isMaintenanceMode();

  // Run full health checks
  const health = await runHealthChecks();

  // Add maintenance mode to response
  const response = {
    ...health,
    maintenanceMode,
  };

  // Return 503 if unhealthy or in maintenance
  const statusCode = health.status === 'unhealthy' || maintenanceMode ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}
