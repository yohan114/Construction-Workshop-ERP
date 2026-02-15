// Job Costing Engine
// Handles automatic cost calculation for jobs

import { db } from '@/lib/db';
import crypto from 'crypto';

export interface CostBreakdown {
  materialCost: number;
  laborCost: number;
  fuelCost: number;
  serviceCost: number;
  otherCost: number;
  totalCost: number;
}

// Add material cost when items are issued
export async function addMaterialCost(
  jobId: string,
  itemId: string,
  quantity: number,
  unitCost: number,
  referenceType: string,
  referenceId: string,
  userId: string
): Promise<void> {
  const amount = quantity * unitCost;
  
  // Get current running total
  const lastLog = await db.jobCostLog.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });
  
  const runningTotal = (lastLog?.runningTotal || 0) + amount;
  
  // Get item for description
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { description: true },
  });
  
  // Create cost log entry
  await db.jobCostLog.create({
    data: {
      jobId,
      companyId: (await db.job.findUnique({ where: { id: jobId } }))!.companyId,
      costType: 'MATERIAL',
      description: `Material: ${item?.description || 'Unknown'} (${quantity} @ ${unitCost})`,
      amount,
      referenceType,
      referenceId,
      itemId,
      quantity,
      unitCost,
      runningTotal,
      createdBy: userId,
    },
  });
  
  // Update job running totals
  await updateJobRunningTotals(jobId);
}

// Credit material cost when items are returned
export async function creditMaterialCost(
  jobId: string,
  itemId: string,
  quantity: number,
  unitCost: number,
  referenceType: string,
  referenceId: string,
  userId: string
): Promise<void> {
  const amount = -1 * quantity * unitCost; // Negative for credit
  
  // Get current running total
  const lastLog = await db.jobCostLog.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });
  
  const runningTotal = (lastLog?.runningTotal || 0) + amount;
  
  // Get item for description
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { description: true },
  });
  
  // Create cost log entry
  await db.jobCostLog.create({
    data: {
      jobId,
      companyId: (await db.job.findUnique({ where: { id: jobId } }))!.companyId,
      costType: 'MATERIAL',
      description: `Return: ${item?.description || 'Unknown'} (${quantity} @ ${unitCost})`,
      amount,
      referenceType,
      referenceId,
      itemId,
      quantity,
      unitCost,
      runningTotal,
      createdBy: userId,
    },
  });
  
  // Update job running totals
  await updateJobRunningTotals(jobId);
}

// Calculate and add labor cost on job completion
export async function calculateLaborCost(jobId: string, userId: string): Promise<number> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      assignedTo: {
        select: { hourlyRate: true },
      },
    },
  });
  
  if (!job || !job.assignedTo || !job.startedAt) {
    return 0;
  }
  
  const hourlyRate = job.assignedTo.hourlyRate || 0;
  if (hourlyRate === 0) return 0;
  
  // Calculate total hours worked
  const startTime = new Date(job.startedAt).getTime();
  const endTime = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const totalSeconds = (endTime - startTime) / 1000;
  const totalHours = (totalSeconds - (job.totalPauseTime || 0)) / 3600;
  
  const laborCost = totalHours * hourlyRate;
  
  if (laborCost > 0) {
    // Get current running total
    const lastLog = await db.jobCostLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
    
    const runningTotal = (lastLog?.runningTotal || 0) + laborCost;
    
    await db.jobCostLog.create({
      data: {
        jobId,
        companyId: job.companyId,
        costType: 'LABOR',
        description: `Labor: ${totalHours.toFixed(2)} hours @ $${hourlyRate}/hr`,
        amount: laborCost,
        referenceType: 'LABOR',
        runningTotal,
        createdBy: userId,
      },
    });
    
    await updateJobRunningTotals(jobId);
  }
  
  return laborCost;
}

// Add fuel cost
export async function addFuelCost(
  jobId: string,
  liters: number,
  unitPrice: number,
  referenceId: string,
  userId: string
): Promise<void> {
  const amount = liters * unitPrice;
  
  const lastLog = await db.jobCostLog.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  });
  
  const runningTotal = (lastLog?.runningTotal || 0) + amount;
  
  await db.jobCostLog.create({
    data: {
      jobId,
      companyId: (await db.job.findUnique({ where: { id: jobId } }))!.companyId,
      costType: 'FUEL',
      description: `Fuel: ${liters}L @ $${unitPrice}/L`,
      amount,
      referenceType: 'FUEL',
      referenceId,
      quantity: liters,
      unitCost: unitPrice,
      runningTotal,
      createdBy: userId,
    },
  });
  
  await updateJobRunningTotals(jobId);
}

// Update job running totals for fast loading
async function updateJobRunningTotals(jobId: string): Promise<void> {
  const logs = await db.jobCostLog.findMany({
    where: { jobId },
  });
  
  const totals = {
    materialCost: 0,
    laborCost: 0,
    fuelCost: 0,
    serviceCost: 0,
    otherCost: 0,
  };
  
  for (const log of logs) {
    switch (log.costType) {
      case 'MATERIAL':
        totals.materialCost += log.amount;
        break;
      case 'LABOR':
        totals.laborCost += log.amount;
        break;
      case 'FUEL':
        totals.fuelCost += log.amount;
        break;
      case 'SERVICE':
        totals.serviceCost += log.amount;
        break;
      case 'OTHER':
        totals.otherCost += log.amount;
        break;
    }
  }
  
  const totalCost = Object.values(totals).reduce((a, b) => a + b, 0);
  
  await db.job.update({
    where: { id: jobId },
    data: {
      ...totals,
      totalCost,
      costCalculatedAt: new Date(),
    },
  });
}

// Get cost breakdown for a job
export async function getJobCostBreakdown(jobId: string): Promise<CostBreakdown> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      materialCost: true,
      laborCost: true,
      fuelCost: true,
      totalCost: true,
    },
  });
  
  return {
    materialCost: job?.materialCost || 0,
    laborCost: job?.laborCost || 0,
    fuelCost: job?.fuelCost || 0,
    serviceCost: 0,
    otherCost: 0,
    totalCost: job?.totalCost || 0,
  };
}

// Create immutable cost snapshot when job is closed
export async function createCostSnapshot(jobId: string, userId: string): Promise<void> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      assignedTo: {
        select: { hourlyRate: true },
      },
      costLogs: true,
    },
  });
  
  if (!job) return;
  
  // Calculate labor hours
  let laborHours = 0;
  if (job.startedAt) {
    const startTime = new Date(job.startedAt).getTime();
    const endTime = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const totalSeconds = (endTime - startTime) / 1000;
    laborHours = (totalSeconds - (job.totalPauseTime || 0)) / 3600;
  }
  
  const snapshotData = {
    materialCost: job.materialCost,
    laborCost: job.laborCost,
    fuelCost: job.fuelCost,
    serviceCost: 0,
    otherCost: 0,
    totalCost: job.totalCost,
    laborHours,
    hourlyRate: job.assignedTo?.hourlyRate || 0,
  };
  
  // Generate SHA-256 hash for immutability
  const hashData = JSON.stringify({
    jobId,
    ...snapshotData,
    timestamp: new Date().toISOString(),
  });
  const dataHash = crypto.createHash('sha256').update(hashData).digest('hex');
  
  // Create snapshot
  await db.jobCostSnapshot.create({
    data: {
      jobId,
      companyId: job.companyId,
      ...snapshotData,
      dataHash,
      createdBy: userId,
    },
  });
  
  // Store hash in document_hashes for validation
  await db.documentHash.create({
    data: {
      documentType: 'JOB_COST_SNAPSHOT',
      documentId: jobId,
      dataHash,
    },
  });
}

// Validate cost snapshot integrity
export async function validateCostSnapshot(jobId: string): Promise<boolean> {
  const snapshot = await db.jobCostSnapshot.findUnique({
    where: { jobId },
  });
  
  if (!snapshot) return false;
  
  // Recalculate hash
  const hashData = JSON.stringify({
    jobId,
    materialCost: snapshot.materialCost,
    laborCost: snapshot.laborCost,
    fuelCost: snapshot.fuelCost,
    serviceCost: snapshot.serviceCost,
    otherCost: snapshot.otherCost,
    totalCost: snapshot.totalCost,
    laborHours: snapshot.laborHours,
    hourlyRate: snapshot.hourlyRate,
    timestamp: snapshot.hashGeneratedAt.toISOString(),
  });
  
  const calculatedHash = crypto.createHash('sha256').update(hashData).digest('hex');
  
  return calculatedHash === snapshot.dataHash;
}

// Check if job can be closed
export async function canCloseJob(jobId: string): Promise<{ canClose: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      itemRequests: {
        include: {
          lines: true,
        },
      },
    },
  });
  
  if (!job) {
    return { canClose: false, reasons: ['Job not found'] };
  }
  
  // Check for pending returns
  const pendingReturns = job.itemRequests.some(req =>
    req.lines.some(line => (line.issuedQty || 0) > (line.returnedQty || 0))
  );
  
  if (pendingReturns) {
    reasons.push('Pending item returns exist. Please return all unused items.');
  }
  
  // Check for safety critical photo
  if (job.safetyPhotoRequired && !job.safetyPhotoUrl) {
    reasons.push('Safety photo is required for this job before closure.');
  }
  
  // Check if job is in correct status
  if (!['COMPLETED'].includes(job.status)) {
    reasons.push('Job must be completed before closing.');
  }
  
  return {
    canClose: reasons.length === 0,
    reasons,
  };
}
