import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { addMaterialCost } from '@/lib/costing';
import crypto from 'crypto';

// POST - Issue items (Storekeeper)
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

    // Only storekeepers can issue
    if (!['ADMIN', 'MANAGER', 'STOREKEEPER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, issuedLines, receivedById } = body;

    const itemRequest = await db.itemRequest.findFirst({
      where: {
        id,
        job: {
          companyId: payload.companyId,
        },
      },
      include: {
        lines: {
          include: {
            item: {
              include: {
                stockLevels: {
                  where: {
                    storeId: id,
                  },
                },
              },
            },
          },
        },
        store: true,
        job: true,
      },
    });

    if (!itemRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (action === 'prepare') {
      // Generate QR code for technician to scan
      const qrCode = crypto.randomBytes(16).toString('hex');
      const qrExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const updated = await db.itemRequest.update({
        where: { id },
        data: {
          qrCode,
          qrExpiresAt,
          issuedById: payload.userId,
        },
      });

      return NextResponse.json({ 
        request: updated,
        qrCode,
        qrExpiresAt,
      });
    }

    if (action === 'issue') {
      if (itemRequest.status !== 'APPROVED') {
        return NextResponse.json({ 
          error: 'Request must be approved first' 
        }, { status: 400 });
      }

      // Verify QR code if provided
      if (itemRequest.qrCode && !receivedById) {
        return NextResponse.json({ 
          error: 'QR code confirmation required' 
        }, { status: 400 });
      }

      // Process each line with stock decrement and cost capture
      for (const line of issuedLines || itemRequest.lines) {
        const stockLevel = await db.itemStock.findFirst({
          where: {
            itemId: line.itemId,
            storeId: itemRequest.storeId,
          },
        });

        if (!stockLevel) {
          return NextResponse.json({ 
            error: `No stock found for item` 
          }, { status: 400 });
        }

        const issueQty = line.issuedQty || line.approvedQty;

        if (stockLevel.quantity < issueQty) {
          return NextResponse.json({ 
            error: `Insufficient stock. Available: ${stockLevel.quantity}` 
          }, { status: 400 });
        }

        // Get item with current cost
        const item = await db.item.findUnique({
          where: { id: line.itemId },
          select: { 
            unitPrice: true, 
            weightedAvgCost: true,
            description: true,
          },
        });

        // Capture unit cost at transaction time
        const unitCost = item?.weightedAvgCost || item?.unitPrice || 0;
        const totalCost = issueQty * unitCost;

        // Decrement stock
        const newQuantity = stockLevel.quantity - issueQty;
        await db.itemStock.update({
          where: { id: stockLevel.id },
          data: { quantity: newQuantity },
        });

        // Create stock ledger entry with cost
        await db.stockLedger.create({
          data: {
            itemId: line.itemId,
            storeId: itemRequest.storeId,
            movementType: 'OUT',
            quantity: issueQty,
            balanceAfter: newQuantity,
            unitCost,
            totalValue: totalCost,
            referenceType: 'REQUEST',
            referenceId: itemRequest.id,
            userId: payload.userId,
          },
        });

        // Update request line with cost
        await db.itemRequestLine.update({
          where: { id: line.id },
          data: { 
            issuedQty: issueQty,
            unitCost,
            totalCost,
          },
        });

        // Add material cost to job
        if (unitCost > 0 && itemRequest.jobId) {
          await addMaterialCost(
            itemRequest.jobId,
            line.itemId,
            issueQty,
            unitCost,
            'ISSUE',
            itemRequest.id,
            payload.userId
          );
        }
      }

      const updated = await db.itemRequest.update({
        where: { id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          issuedById: payload.userId,
          receivedById,
          receivedAt: new Date(),
          updatedBy: payload.userId,
        },
        include: {
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      // Notify requester
      await db.notification.create({
        data: {
          userId: itemRequest.requestedById,
          title: 'Items Issued',
          message: `Items for job "${itemRequest.job.title}" have been issued`,
          type: 'ITEMS_ISSUED',
          referenceId: itemRequest.id,
        },
      });

      return NextResponse.json({ request: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Issue items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
