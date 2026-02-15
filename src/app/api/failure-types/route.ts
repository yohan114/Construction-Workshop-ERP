import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List failure types
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

    const failureTypes = await db.failureType.findMany({
      where: {
        companyId: payload.companyId,
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ failureTypes });
  } catch (error) {
    console.error('Get failure types error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
