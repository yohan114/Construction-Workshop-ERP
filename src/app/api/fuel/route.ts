import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { addFuelCost } from '@/lib/costing';

// GET - List fuel issues
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
    const abnormal = searchParams.get('abnormal');

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
    };

    if (assetId) {
      where.assetId = assetId;
    }

    if (abnormal === 'true') {
      where.isAbnormal = true;
    }

    const fuelIssues = await db.fuelIssue.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            code: true,
            description: true,
            standardConsumptionRate: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ fuelIssues });
  } catch (error) {
    console.error('Get fuel issues error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create fuel issue with meter validation
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
    const {
      assetId,
      storeId,
      jobId,
      operatorId,
      meterReading,
      meterPhotoUrl,
      meterBroken,
      dashboardPhotoUrl,
      meterOverridePin,
      fuelType,
      quantityLiters,
      unitPrice,
    } = body;

    if (!assetId || !storeId || meterReading === undefined || !quantityLiters) {
      return NextResponse.json({ 
        error: 'Asset, store, meter reading, and quantity are required' 
      }, { status: 400 });
    }

    // Get asset with current meter reading
    const asset = await db.asset.findFirst({
      where: {
        id: assetId,
        companyId: payload.companyId,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Meter validation
    let meterValidated = true;
    let previousReading = asset.currentMeter;

    if (!meterBroken && previousReading !== null && previousReading !== undefined) {
      if (meterReading < previousReading) {
        // Meter rollback detected
        meterValidated = false;
        
        // Check for supervisor override
        if (!meterOverridePin) {
          // Create alert
          await db.alert.create({
            data: {
              companyId: payload.companyId,
              type: 'METER_ROLLBACK',
              severity: 'HIGH',
              title: 'Meter Rollback Detected',
              message: `Asset ${asset.code}: Meter reading ${meterReading} is less than previous ${previousReading}`,
              referenceType: 'ASSET',
              referenceId: assetId,
            },
          });
          
          return NextResponse.json({ 
            error: 'Meter reading is less than previous reading. Supervisor override required.',
            code: 'METER_ROLLBACK',
            previousReading,
          }, { status: 400 });
        }
        
        // TODO: Validate supervisor PIN
        meterValidated = true;
      }
    }

    // Calculate consumption rate
    let distanceHours = 0;
    let consumptionRate = 0;
    let variancePercent = 0;
    let isAbnormal = false;

    if (previousReading !== null && previousReading !== undefined && !meterBroken) {
      distanceHours = meterReading - previousReading;
      
      if (quantityLiters > 0 && distanceHours > 0) {
        consumptionRate = distanceHours / quantityLiters;
        
        // Check against standard rate
        if (asset.standardConsumptionRate && asset.standardConsumptionRate > 0) {
          variancePercent = Math.abs((consumptionRate - asset.standardConsumptionRate) / asset.standardConsumptionRate) * 100;
          
          // Alert if variance > 20%
          if (variancePercent > 20) {
            isAbnormal = true;
            
            await db.alert.create({
              data: {
                companyId: payload.companyId,
                type: 'ABNORMAL_CONSUMPTION',
                severity: 'MEDIUM',
                title: 'Abnormal Fuel Consumption',
                message: `Asset ${asset.code}: Consumption rate ${consumptionRate.toFixed(2)} varies ${variancePercent.toFixed(1)}% from standard`,
                referenceType: 'FUEL_ISSUE',
              },
            });
          }
        }
      } else if (quantityLiters > 0 && distanceHours === 0) {
        // Zero consumption - potential fraud
        isAbnormal = true;
        
        await db.alert.create({
          data: {
            companyId: payload.companyId,
            type: 'ZERO_CONSUMPTION',
            severity: 'HIGH',
            title: 'Zero Consumption Warning',
            message: `Asset ${asset.code}: ${quantityLiters}L issued with no distance/hours recorded`,
            referenceType: 'FUEL_ISSUE',
          },
        });
      }
    }

    // Calculate total cost
    const totalCost = unitPrice ? quantityLiters * unitPrice : null;

    // Create fuel issue
    const fuelIssue = await db.fuelIssue.create({
      data: {
        companyId: payload.companyId,
        assetId,
        storeId,
        jobId,
        issuedById: payload.userId,
        operatorId,
        meterReading,
        previousReading,
        meterValidated,
        meterPhotoUrl,
        meterBroken: meterBroken || false,
        dashboardPhotoUrl,
        fuelType: fuelType || 'DIESEL',
        quantityLiters,
        unitPrice,
        totalCost,
        distanceHours: distanceHours || null,
        consumptionRate: consumptionRate || null,
        standardRate: asset.standardConsumptionRate,
        variancePercent: variancePercent || null,
        isAbnormal,
        createdBy: payload.userId,
      },
    });

    // Update asset meter
    if (!meterBroken) {
      await db.asset.update({
        where: { id: assetId },
        data: {
          currentMeter: meterReading,
          lastMeterUpdate: new Date(),
        },
      });
    } else {
      // Create repair job for broken meter
      const existingJob = await db.job.findFirst({
        where: {
          assetId,
          title: { contains: 'Repair Meter' },
          status: { in: ['CREATED', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      });
      
      if (!existingJob) {
        await db.job.create({
          data: {
            companyId: payload.companyId,
            assetId,
            title: `Repair Meter for ${asset.code}`,
            description: 'Meter reported as broken. Requires inspection and repair.',
            type: 'CORRECTIVE',
            priority: 'HIGH',
            status: 'CREATED',
            createdById: payload.userId,
          },
        });
      }
    }

    // Add cost to job if linked
    if (jobId && unitPrice) {
      await addFuelCost(jobId, quantityLiters, unitPrice, fuelIssue.id, payload.userId);
    }

    return NextResponse.json({ fuelIssue }, { status: 201 });
  } catch (error) {
    console.error('Create fuel issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
