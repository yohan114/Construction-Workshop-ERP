import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List all stores
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
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const stores = await db.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Get stores error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new store
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
    const { name, code, location, status } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if store name already exists
    const existing = await db.store.findFirst({
      where: {
        companyId: payload.companyId,
        name,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Store name already exists' }, { status: 400 });
    }

    const store = await db.store.create({
      data: {
        name,
        code,
        location,
        status: status || 'ACTIVE',
        companyId: payload.companyId,
        createdBy: payload.userId,
      },
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    console.error('Create store error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
