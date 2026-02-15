import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { creditMaterialCost } from '@/lib/costing';

// POST - Accept return (Storekeeper)
export async function POST(
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

    // Only storekeepers can accept returns
    if (!['ADMIN', 'MANAGER', 'STOREKEEPER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, storeId } = body;

    const itemReturn = await db.itemReturn.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
      include: {
        item: true,
      },
    });

    if (!itemReturn) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    if (itemReturn.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Return already processed' 
      }, { status: 400 });
    }

    if (action === 'accept') {
      // Get stock level
      const stockLevel = await db.itemStock.findFirst({
        where: {
          itemId: itemReturn.itemId,
          storeId: storeId || itemReturn.storeId,
        },
      });

      if (!stockLevel) {
        return NextResponse.json({ 
          error: 'Stock record not found' 
        }, { status: 400 });
      }

      // Get item cost
      const item = await db.item.findUnique({
        where: { id: itemReturn.itemId },
        select: { unitPrice: true, weightedAvgCost: true },
      });

      const unitCost = item?.weightedAvgCost || item?.unitPrice || 0;
      const totalCredit = itemReturn.quantity * unitCost;

      // Increment stock
      const newQuantity = stockLevel.quantity + itemReturn.quantity;
      await db.itemStock.update({
        where: { id: stockLevel.id },
        data: { quantity: newQuantity },
      });

      // Create stock ledger entry
      await db.stockLedger.create({
        data: {
          itemId: itemReturn.itemId,
          storeId: stockLevel.storeId,
          movementType: 'RETURN',
          quantity: itemReturn.quantity,
          balanceAfter: newQuantity,
          unitCost,
          totalValue: totalCredit,
          referenceType: 'RETURN',
          referenceId: itemReturn.id,
          userId: payload.userId,
        },
      });

      // Update return status with cost
      const updated = await db.itemReturn.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedById: payload.userId,
          acceptedAt: new Date(),
          storeId: stockLevel.storeId,
          unitCost,
          totalCredit,
        },
      });

      // Update request line if linked
      if (itemReturn.requestLineId) {
        const requestLine = await db.itemRequestLine.findUnique({
          where: { id: itemReturn.requestLineId },
        });
        if (requestLine) {
          await db.itemRequestLine.update({
            where: { id: itemReturn.requestLineId },
            data: {
              returnedQty: (requestLine.returnedQty || 0) + itemReturn.quantity,
            },
          });
        }
      }

      // Credit material cost to job
      if (unitCost > 0 && itemReturn.jobId) {
        await creditMaterialCost(
          itemReturn.jobId,
          itemReturn.itemId,
          itemReturn.quantity,
          unitCost,
          'RETURN',
          itemReturn.id,
          payload.userId
        );
      }

      return NextResponse.json({ return: updated });
    }

    if (action === 'reject') {
      const updated = await db.itemReturn.update({
        where: { id },
        data: {
          status: 'REJECTED',
          acceptedById: payload.userId,
          acceptedAt: new Date(),
        },
      });

      return NextResponse.json({ return: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Accept return error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
