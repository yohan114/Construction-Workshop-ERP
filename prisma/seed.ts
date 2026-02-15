import { PrismaClient } from '@prisma/client';
import { generateSalt, hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  // Create default company
  const company = await prisma.company.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: {
      name: 'Default Company',
      code: 'DEFAULT',
      description: 'Default company for the system',
      status: 'ACTIVE',
    },
  });

  console.log('Created company:', company);

  // Create users with different roles
  const salt = generateSalt();
  const hash = hashPassword('admin123', salt);
  const pinSalt = generateSalt();
  const pinHash = hashPassword('1234', pinSalt);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      hash,
      salt,
      pin: pinHash,
      companyId: company.id,
    },
  });

  console.log('Created admin user:', adminUser);

  // Create Supervisor
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@example.com' },
    update: {},
    create: {
      email: 'supervisor@example.com',
      name: 'John Supervisor',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
      hash,
      salt,
      pin: pinHash,
      companyId: company.id,
    },
  });

  console.log('Created supervisor:', supervisor);

  // Create Technicians
  const technician1 = await prisma.user.upsert({
    where: { email: 'technician1@example.com' },
    update: {},
    create: {
      email: 'technician1@example.com',
      name: 'Mike Technician',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      hash,
      salt,
      pin: pinHash,
      companyId: company.id,
    },
  });

  const technician2 = await prisma.user.upsert({
    where: { email: 'technician2@example.com' },
    update: {},
    create: {
      email: 'technician2@example.com',
      name: 'Sarah Technician',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      hash,
      salt,
      pin: pinHash,
      companyId: company.id,
    },
  });

  console.log('Created technicians');

  // Create Storekeeper
  const storekeeper = await prisma.user.upsert({
    where: { email: 'storekeeper@example.com' },
    update: {},
    create: {
      email: 'storekeeper@example.com',
      name: 'David Storekeeper',
      role: 'STOREKEEPER',
      status: 'ACTIVE',
      hash,
      salt,
      pin: pinHash,
      companyId: company.id,
    },
  });

  console.log('Created storekeeper:', storekeeper);

  // Create Failure Types
  const failureTypes = [
    { code: 'MECH', name: 'Mechanical Failure', description: 'Mechanical component failure' },
    { code: 'ELEC', name: 'Electrical Failure', description: 'Electrical system failure' },
    { code: 'HYD', name: 'Hydraulic Failure', description: 'Hydraulic system failure' },
    { code: 'PNEU', name: 'Pneumatic Failure', description: 'Pneumatic system failure' },
    { code: 'CTL', name: 'Control System Failure', description: 'Control/PLC system failure' },
    { code: 'GEN', name: 'General Wear', description: 'General wear and tear' },
  ];

  for (const ft of failureTypes) {
    await prisma.failureType.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: ft.code,
        },
      },
      update: {},
      create: {
        ...ft,
        companyId: company.id,
      },
    });
  }

  console.log('Created failure types');

  // Create sample categories
  const assetCategories = [
    { name: 'IT Equipment', type: 'ASSET', description: 'Computers, servers, network equipment' },
    { name: 'Furniture', type: 'ASSET', description: 'Office furniture and fixtures' },
    { name: 'Vehicles', type: 'ASSET', description: 'Company vehicles' },
    { name: 'Machinery', type: 'ASSET', description: 'Manufacturing equipment' },
  ];

  const itemCategories = [
    { name: 'Office Supplies', type: 'ITEM', description: 'Pens, paper, staplers' },
    { name: 'Raw Materials', type: 'ITEM', description: 'Materials for production' },
    { name: 'Finished Goods', type: 'ITEM', description: 'Completed products' },
    { name: 'Spare Parts', type: 'ITEM', description: 'Replacement parts' },
  ];

  for (const category of [...assetCategories, ...itemCategories]) {
    await prisma.category.upsert({
      where: {
        companyId_name_type: {
          companyId: company.id,
          name: category.name,
          type: category.type,
        },
      },
      update: {},
      create: {
        ...category,
        companyId: company.id,
      },
    });
  }

  console.log('Created categories');

  // Create sample store
  const store = await prisma.store.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Main Warehouse',
      },
    },
    update: {},
    create: {
      name: 'Main Warehouse',
      code: 'WH001',
      location: 'Building A, Floor 1',
      status: 'ACTIVE',
      companyId: company.id,
    },
  });

  console.log('Created store:', store);

  // Create sample assets with QR codes
  const assets = [
    { code: 'AST001', description: 'Dell Laptop XPS 15', category: 'IT Equipment', location: 'Office A', value: 1500.00, qrCode: 'QR-AST001' },
    { code: 'AST002', description: 'HP Desktop Computer', category: 'IT Equipment', location: 'Office B', value: 800.00, qrCode: 'QR-AST002' },
    { code: 'AST003', description: 'Office Desk', category: 'Furniture', location: 'Office A', value: 350.00, qrCode: 'QR-AST003' },
    { code: 'AST004', description: 'Ergonomic Chair', category: 'Furniture', location: 'Office A', value: 450.00, qrCode: 'QR-AST004' },
    { code: 'AST005', description: 'CNC Machine A1', category: 'Machinery', location: 'Production Floor', value: 50000.00, qrCode: 'QR-AST005' },
    { code: 'AST006', description: 'Hydraulic Press H1', category: 'Machinery', location: 'Production Floor', value: 25000.00, qrCode: 'QR-AST006' },
    { code: 'AST007', description: 'Conveyor Belt C1', category: 'Machinery', location: 'Assembly Line', value: 15000.00, qrCode: 'QR-AST007' },
    { code: 'AST008', description: 'Forklift F1', category: 'Vehicles', location: 'Warehouse', value: 30000.00, qrCode: 'QR-AST008' },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: asset.code,
        },
      },
      update: {},
      create: {
        ...asset,
        status: 'ACTIVE',
        companyId: company.id,
        createdBy: adminUser.id,
      },
    });
  }

  console.log('Created sample assets');

  // Create sample items with barcodes and stock
  const items = [
    { code: 'ITM001', description: 'A4 Paper (500 sheets)', uom: 'Ream', category: 'Office Supplies', unitPrice: 5.99, minStock: 10, maxStock: 100, barcode: 'BC001', stockQty: 50 },
    { code: 'ITM002', description: 'Ballpoint Pen (Black)', uom: 'Box', category: 'Office Supplies', unitPrice: 3.49, minStock: 20, maxStock: 200, barcode: 'BC002', stockQty: 100 },
    { code: 'ITM003', description: 'Steel Rod 10mm', uom: 'Meter', category: 'Raw Materials', unitPrice: 2.50, minStock: 100, maxStock: 1000, barcode: 'BC003', stockQty: 500 },
    { code: 'ITM004', description: 'Widget Assembly A', uom: 'Piece', category: 'Finished Goods', unitPrice: 45.00, minStock: 50, maxStock: 500, barcode: 'BC004', stockQty: 200 },
    { code: 'ITM005', description: 'Bearing SKF 6205', uom: 'Piece', category: 'Spare Parts', unitPrice: 25.00, minStock: 10, maxStock: 50, barcode: 'BC005', stockQty: 30 },
    { code: 'ITM006', description: 'Hydraulic Hose 1/2"', uom: 'Meter', category: 'Spare Parts', unitPrice: 15.00, minStock: 20, maxStock: 100, barcode: 'BC006', stockQty: 50 },
    { code: 'ITM007', description: 'Motor 5HP', uom: 'Piece', category: 'Spare Parts', unitPrice: 350.00, minStock: 2, maxStock: 10, barcode: 'BC007', stockQty: 5 },
    { code: 'ITM008', description: 'Conveyor Belt Section', uom: 'Piece', category: 'Spare Parts', unitPrice: 200.00, minStock: 5, maxStock: 20, barcode: 'BC008', stockQty: 10 },
    { code: 'ITM009', description: 'Safety Gloves', uom: 'Pair', category: 'Office Supplies', unitPrice: 8.99, minStock: 50, maxStock: 200, barcode: 'BC009', stockQty: 150 },
    { code: 'ITM010', description: 'Lubricant Oil 5L', uom: 'Bottle', category: 'Spare Parts', unitPrice: 45.00, minStock: 10, maxStock: 50, barcode: 'BC010', stockQty: 25 },
  ];

  for (const item of items) {
    const createdItem = await prisma.item.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: item.code,
        },
      },
      update: {},
      create: {
        code: item.code,
        description: item.description,
        uom: item.uom,
        category: item.category,
        status: 'ACTIVE',
        valuationMethod: 'WEIGHTED_AVERAGE',
        unitPrice: item.unitPrice,
        minStock: item.minStock,
        maxStock: item.maxStock,
        barcode: item.barcode,
        companyId: company.id,
        createdBy: adminUser.id,
      },
    });

    // Create stock level
    await prisma.itemStock.upsert({
      where: {
        itemId_storeId: {
          itemId: createdItem.id,
          storeId: store.id,
        },
      },
      update: {
        quantity: item.stockQty,
      },
      create: {
        itemId: createdItem.id,
        storeId: store.id,
        quantity: item.stockQty,
      },
    });
  }

  console.log('Created sample items with stock levels');

  // Create sample jobs
  const cncMachine = await prisma.asset.findFirst({
    where: { code: 'AST005' },
  });

  const hydraulicPress = await prisma.asset.findFirst({
    where: { code: 'AST006' },
  });

  const mechanicalFailure = await prisma.failureType.findFirst({
    where: { code: 'MECH' },
  });

  const electricalFailure = await prisma.failureType.findFirst({
    where: { code: 'ELEC' },
  });

  if (cncMachine && mechanicalFailure) {
    await prisma.job.create({
      data: {
        companyId: company.id,
        assetId: cncMachine.id,
        failureTypeId: mechanicalFailure.id,
        createdById: supervisor.id,
        assignedToId: technician1.id,
        title: 'CNC Machine spindle vibration',
        description: 'Excessive vibration observed during operation. Needs immediate inspection.',
        status: 'ASSIGNED',
        priority: 'HIGH',
        type: 'BREAKDOWN',
        createdBy: supervisor.id,
      },
    });
  }

  if (hydraulicPress && electricalFailure) {
    await prisma.job.create({
      data: {
        companyId: company.id,
        assetId: hydraulicPress.id,
        failureTypeId: electricalFailure.id,
        createdById: supervisor.id,
        assignedToId: technician2.id,
        title: 'Hydraulic Press control panel issue',
        description: 'Control panel not responding. Possible PLC communication error.',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        type: 'BREAKDOWN',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Started 2 hours ago
        createdBy: supervisor.id,
      },
    });
  }

  console.log('Created sample jobs');

  console.log('\n=== Phase 2 Seed Complete ===');
  console.log('\n--- User Accounts ---');
  console.log('Admin: admin@example.com / admin123 (PIN: 1234)');
  console.log('Supervisor: supervisor@example.com / admin123 (PIN: 1234)');
  console.log('Technician 1: technician1@example.com / admin123 (PIN: 1234)');
  console.log('Technician 2: technician2@example.com / admin123 (PIN: 1234)');
  console.log('Storekeeper: storekeeper@example.com / admin123 (PIN: 1234)');
  console.log('\n--- Sample Data ---');
  console.log('8 Assets (with QR codes)');
  console.log('10 Items (with barcodes and stock)');
  console.log('6 Failure Types');
  console.log('2 Sample Jobs');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
