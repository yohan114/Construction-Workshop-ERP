import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get single request
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

    const itemRequest = await db.itemRequest.findFirst({
      where: {
        id,
        job: {
          companyId: payload.companyId,
        },
      },
      include: {
        job: {
          include: {
            asset: true,
          },
        },
        lines: {
          include: {
            item: true,
          },
        },
        store: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!itemRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: itemRequest });
  } catch (error) {
    console.error('Get request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
