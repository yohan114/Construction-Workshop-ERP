import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get single item
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

    const item = await db.item.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Get item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update item
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

    const existingItem = await db.item.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // If code is being changed, check for duplicates
    if (code && code !== existingItem.code) {
      const duplicate = await db.item.findUnique({
        where: {
          companyId_code: {
            companyId: payload.companyId,
            code,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json({ error: 'Item code already exists' }, { status: 400 });
      }
    }

    const item = await db.item.update({
      where: { id },
      data: {
        code: code || existingItem.code,
        description: description || existingItem.description,
        uom: uom !== undefined ? uom : existingItem.uom,
        category: category !== undefined ? category : existingItem.category,
        status: status || existingItem.status,
        valuationMethod: valuationMethod || existingItem.valuationMethod,
        unitPrice: unitPrice !== undefined ? (unitPrice ? parseFloat(unitPrice) : null) : existingItem.unitPrice,
        minStock: minStock !== undefined ? (minStock ? parseFloat(minStock) : null) : existingItem.minStock,
        maxStock: maxStock !== undefined ? (maxStock ? parseFloat(maxStock) : null) : existingItem.maxStock,
        updatedBy: payload.userId,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Update item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete item
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

    const item = await db.item.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await db.item.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
