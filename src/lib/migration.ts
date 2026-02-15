/**
 * Data Migration Utilities
 * Scripts for importing data from external sources (Excel, CSV)
 */

import { db } from '@/lib/db';
import { hashPassword, generateSalt } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Types for import data
export interface AssetImportData {
  code: string;
  description: string;
  category?: string;
  location?: string;
  value?: number;
  purchaseDate?: string;
  meterType?: string;
  currentMeter?: number;
  qrCode?: string;
}

export interface ItemImportData {
  code: string;
  description: string;
  uom?: string;
  category?: string;
  unitPrice?: number;
  minStock?: number;
  maxStock?: number;
  barcode?: string;
}

export interface UserImportData {
  email: string;
  name: string;
  role: string;
  pin?: string;
  hourlyRate?: number;
}

export interface StockImportData {
  itemCode: string;
  storeCode: string;
  quantity: number;
  unitCost?: number;
}

export interface VendorImportData {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}

// Import result type
export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  warnings: Array<{ row: number; message: string }>;
}

/**
 * Import assets from array
 */
export async function importAssets(
  companyId: string,
  assets: AssetImportData[],
  userId?: string
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [] };

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      // Validate required fields
      if (!asset.code || !asset.description) {
        result.errors.push({
          row: i + 1,
          error: 'Missing required fields: code, description',
          data: asset,
        });
        result.failed++;
        continue;
      }

      // Check for duplicates
      const existing = await db.asset.findFirst({
        where: { companyId, code: asset.code },
      });

      if (existing) {
        result.warnings.push({
          row: i + 1,
          message: `Asset ${asset.code} already exists, skipping`,
        });
        continue;
      }

      // Create asset
      await db.asset.create({
        data: {
          companyId,
          code: asset.code.toUpperCase(),
          description: asset.description,
          category: asset.category,
          location: asset.location,
          value: asset.value,
          purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : null,
          meterType: asset.meterType,
          currentMeter: asset.currentMeter || 0,
          qrCode: asset.qrCode,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      result.success++;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: (error as Error).message,
        data: asset,
      });
      result.failed++;
    }
  }

  await logger.info('BUSINESS', `Imported ${result.success} assets`, {
    metadata: { companyId, success: result.success, failed: result.failed },
  });

  return result;
}

/**
 * Import items from array
 */
export async function importItems(
  companyId: string,
  items: ItemImportData[],
  userId?: string
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [] };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      // Validate required fields
      if (!item.code || !item.description) {
        result.errors.push({
          row: i + 1,
          error: 'Missing required fields: code, description',
          data: item,
        });
        result.failed++;
        continue;
      }

      // Check for duplicates
      const existing = await db.item.findFirst({
        where: { companyId, code: item.code },
      });

      if (existing) {
        result.warnings.push({
          row: i + 1,
          message: `Item ${item.code} already exists, skipping`,
        });
        continue;
      }

      // Create item
      await db.item.create({
        data: {
          companyId,
          code: item.code.toUpperCase(),
          description: item.description,
          uom: item.uom || 'EA',
          category: item.category,
          unitPrice: item.unitPrice,
          minStock: item.minStock,
          maxStock: item.maxStock,
          barcode: item.barcode,
          weightedAvgCost: item.unitPrice,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      result.success++;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: (error as Error).message,
        data: item,
      });
      result.failed++;
    }
  }

  await logger.info('BUSINESS', `Imported ${result.success} items`, {
    metadata: { companyId, success: result.success, failed: result.failed },
  });

  return result;
}

/**
 * Import users from array
 */
export async function importUsers(
  companyId: string,
  users: UserImportData[],
  defaultPassword: string = 'password123',
  userId?: string
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [] };

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      // Validate required fields
      if (!user.email || !user.name || !user.role) {
        result.errors.push({
          row: i + 1,
          error: 'Missing required fields: email, name, role',
          data: user,
        });
        result.failed++;
        continue;
      }

      // Check for duplicates
      const existing = await db.user.findUnique({
        where: { email: user.email.toLowerCase() },
      });

      if (existing) {
        result.warnings.push({
          row: i + 1,
          message: `User ${user.email} already exists, skipping`,
        });
        continue;
      }

      // Generate password hash
      const salt = generateSalt();
      const hash = hashPassword(defaultPassword, salt);

      // Create user
      await db.user.create({
        data: {
          companyId,
          email: user.email.toLowerCase(),
          name: user.name,
          role: user.role as any,
          hash,
          salt,
          pin: user.pin || '1234',
          hourlyRate: user.hourlyRate,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      result.success++;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: (error as Error).message,
        data: user,
      });
      result.failed++;
    }
  }

  await logger.info('BUSINESS', `Imported ${result.success} users`, {
    metadata: { companyId, success: result.success, failed: result.failed },
  });

  return result;
}

/**
 * Import opening stock balances
 */
export async function importOpeningStock(
  companyId: string,
  stockData: StockImportData[],
  userId?: string
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [] };

  // Get all items and stores
  const items = await db.item.findMany({ where: { companyId } });
  const stores = await db.store.findMany({ where: { companyId } });

  const itemMap = new Map(items.map((i) => [i.code, i]));
  const storeMap = new Map(stores.map((s) => [s.code || s.name, s]));

  for (let i = 0; i < stockData.length; i++) {
    const stock = stockData[i];
    try {
      const item = itemMap.get(stock.itemCode);
      const store = storeMap.get(stock.storeCode);

      if (!item) {
        result.errors.push({
          row: i + 1,
          error: `Item not found: ${stock.itemCode}`,
          data: stock,
        });
        result.failed++;
        continue;
      }

      if (!store) {
        result.errors.push({
          row: i + 1,
          error: `Store not found: ${stock.storeCode}`,
          data: stock,
        });
        result.failed++;
        continue;
      }

      // Check if stock record exists
      const existing = await db.itemStock.findUnique({
        where: {
          itemId_storeId: {
            itemId: item.id,
            storeId: store.id,
          },
        },
      });

      if (existing) {
        // Update existing stock
        await db.itemStock.update({
          where: { id: existing.id },
          data: { quantity: stock.quantity },
        });
      } else {
        // Create new stock record
        await db.itemStock.create({
          data: {
            itemId: item.id,
            storeId: store.id,
            quantity: stock.quantity,
          },
        });
      }

      // Create stock ledger entry
      await db.stockLedger.create({
        data: {
          itemId: item.id,
          storeId: store.id,
          movementType: 'IN',
          quantity: stock.quantity,
          balanceAfter: stock.quantity,
          unitCost: stock.unitCost,
          totalValue: stock.unitCost ? stock.quantity * stock.unitCost : null,
          referenceType: 'OPENING_BALANCE',
          userId: userId || 'system',
        },
      });

      result.success++;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: (error as Error).message,
        data: stock,
      });
      result.failed++;
    }
  }

  await logger.info('BUSINESS', `Imported ${result.success} stock records`, {
    metadata: { companyId, success: result.success, failed: result.failed },
  });

  return result;
}

/**
 * Verify import totals match source
 */
export async function verifyImportTotals(
  companyId: string,
  expected: {
    totalAssets?: number;
    totalItems?: number;
    totalStockValue?: number;
  }
): Promise<{
  matched: boolean;
  actual: {
    totalAssets: number;
    totalItems: number;
    totalStockValue: number;
  };
  differences: string[];
}> {
  const differences: string[] = [];

  const [totalAssets, totalItems, stockRecords] = await Promise.all([
    db.asset.count({ where: { companyId } }),
    db.item.count({ where: { companyId } }),
    db.stockLedger.findMany({
      where: {
        item: { companyId },
        referenceType: 'OPENING_BALANCE',
      },
    }),
  ]);

  // Calculate actual stock value
  const totalStockValue = stockRecords.reduce(
    (sum, record) => sum + (record.totalValue || 0),
    0
  );

  if (expected.totalAssets && totalAssets !== expected.totalAssets) {
    differences.push(
      `Asset count: expected ${expected.totalAssets}, got ${totalAssets}`
    );
  }

  if (expected.totalItems && totalItems !== expected.totalItems) {
    differences.push(
      `Item count: expected ${expected.totalItems}, got ${totalItems}`
    );
  }

  if (expected.totalStockValue && Math.abs(totalStockValue - expected.totalStockValue) > 0.01) {
    differences.push(
      `Stock value: expected ${expected.totalStockValue}, got ${totalStockValue}`
    );
  }

  return {
    matched: differences.length === 0,
    actual: { totalAssets, totalItems, totalStockValue },
    differences,
  };
}

/**
 * Clean up data before import
 */
export function cleanImportData<T extends Record<string, any>>(data: T[]): T[] {
  return data
    .filter((row) => {
      // Remove empty rows
      const values = Object.values(row);
      return values.some((v) => v !== null && v !== undefined && v !== '');
    })
    .map((row) => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(row)) {
        // Trim strings
        if (typeof value === 'string') {
          cleaned[key] = value.trim();
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });
}
