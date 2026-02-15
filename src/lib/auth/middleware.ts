import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// Paths that don't require authentication
const publicPaths = ['/login', '/api/auth/login', '/api/auth/refresh'];

// Role-based path restrictions
const roleRestrictions: Record<string, string[]> = {
  '/api/admin': ['ADMIN'],
  '/admin': ['ADMIN', 'MANAGER'],
};

export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: { userId: string; email: string; role: string; companyId: string }) => Promise<NextResponse>
): Promise<NextResponse> {
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const payload = verifyJWT(accessToken);

  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return handler(request, payload);
}

export function checkRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

// Helper to extract user from request
export async function getUserFromRequest(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    return null;
  }

  return verifyJWT(accessToken);
}
