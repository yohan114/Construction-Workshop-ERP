import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - List all assets
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

    const assets = await db.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Get assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new asset
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
    const { code, description, category, status, location, value, purchaseDate } = body;

    if (!code || !description) {
      return NextResponse.json({ error: 'Code and description are required' }, { status: 400 });
    }

    // Check if asset code already exists
    const existing = await db.asset.findUnique({
      where: {
        companyId_code: {
          companyId: payload.companyId,
          code,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Asset code already exists' }, { status: 400 });
    }

    const asset = await db.asset.create({
      data: {
        code,
        description,
        category,
        status: status || 'ACTIVE',
        location,
        value: value ? parseFloat(value) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        companyId: payload.companyId,
        createdBy: payload.userId,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error('Create asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
