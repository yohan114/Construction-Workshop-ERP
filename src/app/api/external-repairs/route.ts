import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

// GET /api/external-repairs - List external repairs
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
    const assetId = searchParams.get('assetId');
    const status = searchParams.get('status');

    const where: any = { companyId: payload.companyId };
    if (assetId) where.assetId = assetId;
    if (status) where.status = status;

    const repairs = await db.externalRepair.findMany({
      where,
      include: {
        asset: { select: { code: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: repairs.length,
      pending: repairs.filter((r) => r.status === 'PENDING').length,
      inProgress: repairs.filter((r) => r.status === 'IN_PROGRESS').length,
      completed: repairs.filter((r) => r.status === 'COMPLETED').length,
      totalCost: repairs.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0),
      outForRepair: repairs.filter((r) => r.gatePassType === 'OUT' && !r.receivedAt).length,
    };

    return NextResponse.json({ repairs, stats });
  } catch (error) {
    console.error('Error fetching external repairs:', error);
    return NextResponse.json({ error: 'Failed to fetch external repairs' }, { status: 500 });
  }
}

// POST /api/external-repairs - Create external repair
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

    if (!['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { assetId, jobId, vendorName, vendorReference, vendorContact, estimatedCost, notes } = body;

    if (!assetId || !vendorName) {
      return NextResponse.json({ error: 'Missing required fields: assetId, vendorName' }, { status: 400 });
    }

    const gatePassNumber = `GP-${Date.now().toString(36).toUpperCase()}`;

    const repair = await db.externalRepair.create({
      data: {
        companyId: payload.companyId,
        assetId,
        jobId,
        vendorName,
        vendorReference,
        vendorContact,
        gatePassType: 'OUT',
        gatePassNumber,
        sentOutAt: new Date(),
        sentOutById: payload.userId,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        status: 'PENDING',
        completionNotes: notes,
        createdBy: payload.userId,
      },
      include: { asset: { select: { code: true, description: true } } },
    });

    await db.asset.update({ where: { id: assetId }, data: { status: 'MAINTENANCE' } });

    await db.auditLog.create({
      data: { userId: payload.userId, action: 'CREATE', entity: 'ExternalRepair', entityId: repair.id, newValue: JSON.stringify(repair) },
    });

    return NextResponse.json(repair, { status: 201 });
  } catch (error) {
    console.error('Error creating external repair:', error);
    return NextResponse.json({ error: 'Failed to create external repair' }, { status: 500 });
  }
}

// PUT /api/external-repairs - Update external repair
export async function PUT(request: NextRequest) {
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
    const { id, action, conditionNotes, invoiceNumber, invoiceDate, invoiceAmount, completionNotes } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields: id, action' }, { status: 400 });
    }

    const repair = await db.externalRepair.findUnique({ where: { id }, include: { asset: true } });
    if (!repair || repair.companyId !== payload.companyId) {
      return NextResponse.json({ error: 'Repair not found' }, { status: 404 });
    }

    let updatedRepair;

    if (action === 'receive') {
      updatedRepair = await db.externalRepair.update({
        where: { id },
        data: {
          gatePassType: 'IN',
          receivedAt: new Date(),
          receivedById: payload.userId,
          conditionNotes,
          status: 'COMPLETED',
          completionNotes,
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : null,
        },
        include: { asset: { select: { code: true, description: true } } },
      });

      await db.asset.update({ where: { id: repair.assetId }, data: { status: 'ACTIVE' } });

      if (repair.jobId && invoiceAmount) {
        await db.jobCostLog.create({
          data: {
            jobId: repair.jobId,
            companyId: payload.companyId,
            costType: 'SERVICE',
            description: `External repair - ${repair.vendorName}`,
            amount: parseFloat(invoiceAmount),
            referenceType: 'EXTERNAL_REPAIR',
            referenceId: repair.id,
            runningTotal: 0,
            createdBy: payload.userId,
          },
        });
      }
    } else if (action === 'invoice') {
      updatedRepair = await db.externalRepair.update({
        where: { id },
        data: {
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : null,
        },
        include: { asset: { select: { code: true, description: true } } },
      });
    } else if (action === 'pay') {
      updatedRepair = await db.externalRepair.update({
        where: { id },
        data: { isPaid: true, paidAt: new Date() },
        include: { asset: { select: { code: true, description: true } } },
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await db.auditLog.create({
      data: { userId: payload.userId, action: 'UPDATE', entity: 'ExternalRepair', entityId: repair.id, newValue: JSON.stringify(updatedRepair) },
    });

    return NextResponse.json(updatedRepair);
  } catch (error) {
    console.error('Error updating external repair:', error);
    return NextResponse.json({ error: 'Failed to update external repair' }, { status: 500 });
  }
}
