import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get single asset
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

    const asset = await db.asset.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Get asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update asset
export async function PUT(
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
    const body = await request.json();
    const { code, description, category, status, location, value, purchaseDate } = body;

    const existingAsset = await db.asset.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // If code is being changed, check for duplicates
    if (code && code !== existingAsset.code) {
      const duplicate = await db.asset.findUnique({
        where: {
          companyId_code: {
            companyId: payload.companyId,
            code,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json({ error: 'Asset code already exists' }, { status: 400 });
      }
    }

    const asset = await db.asset.update({
      where: { id },
      data: {
        code: code || existingAsset.code,
        description: description || existingAsset.description,
        category: category !== undefined ? category : existingAsset.category,
        status: status || existingAsset.status,
        location: location !== undefined ? location : existingAsset.location,
        value: value !== undefined ? (value ? parseFloat(value) : null) : existingAsset.value,
        purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : existingAsset.purchaseDate,
        updatedBy: payload.userId,
      },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Update asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete asset
export async function DELETE(
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

    const asset = await db.asset.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    await db.asset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
