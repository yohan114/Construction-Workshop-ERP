import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get stock levels (for storekeepers/admins only)
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

    // Only storekeepers/admins/managers can see stock levels
    if (!['ADMIN', 'MANAGER', 'STOREKEEPER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const lowStock = searchParams.get('lowStock');

    const where: Record<string, unknown> = {
      item: {
        companyId: payload.companyId,
        status: 'ACTIVE',
      },
    };

    if (storeId) {
      where.storeId = storeId;
    }

    const stockLevels = await db.itemStock.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            code: true,
            description: true,
            uom: true,
            category: true,
            minStock: true,
            maxStock: true,
            unitPrice: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        item: {
          description: 'asc',
        },
      },
    });

    // Filter for low stock if requested
    let result = stockLevels;
    if (lowStock === 'true') {
      result = stockLevels.filter(s => 
        s.item.minStock && s.quantity < s.item.minStock
      );
    }

    return NextResponse.json({ stock: result });
  } catch (error) {
    console.error('Get stock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
