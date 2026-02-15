import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List all items
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
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const items = await db.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Get items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new item
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

    const body = await request.json();
    const { 
      code, 
      description, 
      uom, 
      category, 
      status, 
      valuationMethod,
      unitPrice,
      minStock,
      maxStock
    } = body;

    if (!code || !description) {
      return NextResponse.json({ error: 'Code and description are required' }, { status: 400 });
    }

    // Check if item code already exists
    const existing = await db.item.findUnique({
      where: {
        companyId_code: {
          companyId: payload.companyId,
          code,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Item code already exists' }, { status: 400 });
    }

    const item = await db.item.create({
      data: {
        code,
        description,
        uom,
        category,
        status: status || 'ACTIVE',
        valuationMethod: valuationMethod || 'WEIGHTED_AVERAGE',
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        minStock: minStock ? parseFloat(minStock) : null,
        maxStock: maxStock ? parseFloat(maxStock) : null,
        companyId: payload.companyId,
        createdBy: payload.userId,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Create item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
