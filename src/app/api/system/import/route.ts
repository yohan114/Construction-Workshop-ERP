import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  importAssets,
  importItems,
  importUsers,
  importOpeningStock,
  verifyImportTotals,
  cleanImportData,
  AssetImportData,
  ItemImportData,
  UserImportData,
  StockImportData,
} from '@/lib/migration';

/**
 * POST /api/system/import
 * Import bulk data (Admin only)
 */
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

    // Only admin can import data
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can import data' }, { status: 403 });
    }

    const body = await request.json();
    const { type, data, defaultPassword } = body;

    if (!type || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid request: type and data array required' }, { status: 400 });
    }

    // Clean the data
    const cleanedData = cleanImportData(data);

    let result;

    switch (type) {
      case 'assets':
        result = await importAssets(payload.companyId, cleanedData as AssetImportData[], payload.userId);
        break;
      case 'items':
        result = await importItems(payload.companyId, cleanedData as ItemImportData[], payload.userId);
        break;
      case 'users':
        result = await importUsers(payload.companyId, cleanedData as UserImportData[], defaultPassword || 'password123', payload.userId);
        break;
      case 'stock':
        result = await importOpeningStock(payload.companyId, cleanedData as StockImportData[], payload.userId);
        break;
      default:
        return NextResponse.json({ error: `Unknown import type: ${type}` }, { status: 400 });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'IMPORT',
        entity: type.toUpperCase(),
        newValue: JSON.stringify({ total: data.length, success: result.success, failed: result.failed }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json({ error: 'Failed to import data', details: (error as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/system/import
 * Verify import totals match source
 */
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

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can verify imports' }, { status: 403 });
    }

    const body = await request.json();
    const { expected } = body;

    const verification = await verifyImportTotals(payload.companyId, expected);

    return NextResponse.json(verification);
  } catch (error) {
    console.error('Error verifying import:', error);
    return NextResponse.json({ error: 'Failed to verify import' }, { status: 500 });
  }
}
