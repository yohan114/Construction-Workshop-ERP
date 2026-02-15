import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET - Get single store
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

    const store = await db.store.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error('Get store error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update store
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
    const { name, code, location, status } = body;

    const existingStore = await db.store.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!existingStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (name && name !== existingStore.name) {
      const duplicate = await db.store.findFirst({
        where: {
          companyId: payload.companyId,
          name,
        },
      });

      if (duplicate) {
        return NextResponse.json({ error: 'Store name already exists' }, { status: 400 });
      }
    }

    const store = await db.store.update({
      where: { id },
      data: {
        name: name || existingStore.name,
        code: code !== undefined ? code : existingStore.code,
        location: location !== undefined ? location : existingStore.location,
        status: status || existingStore.status,
        updatedBy: payload.userId,
      },
    });

    return NextResponse.json({ store });
  } catch (error) {
    console.error('Update store error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete store
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

    const store = await db.store.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    await db.store.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete store error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
