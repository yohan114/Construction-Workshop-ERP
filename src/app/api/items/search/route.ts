import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Blind item search (for technicians - no stock/cost info)
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q');
    const barcode = searchParams.get('barcode');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      status: 'ACTIVE',
    };

    if (barcode) {
      where.barcode = barcode;
    } else if (search) {
      where.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // BLIND INVENTORY: Only return id, name, image - NO stock or cost
    const items = await db.item.findMany({
      where,
      select: {
        id: true,
        code: true,
        description: true,
        uom: true,
        category: true,
        barcode: true,
      },
      take: 20,
      orderBy: { description: 'asc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Blind item search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
