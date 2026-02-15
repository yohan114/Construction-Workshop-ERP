// Offline Sync Utility for Mobile App
// Handles localStorage-based offline storage and background sync

export interface OfflineData {
  id: string;
  type: 'job' | 'request' | 'return' | 'status_update';
  action: 'create' | 'update';
  data: Record<string, unknown>;
  createdAt: string;
  syncedAt?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  error?: string;
}

const OFFLINE_KEY = 'erp_offline_data';
const SYNC_INTERVAL = 30000; // 30 seconds

// Get all offline data
export function getOfflineData(): OfflineData[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(OFFLINE_KEY);
  return data ? JSON.parse(data) : [];
}

// Save offline data
export function saveOfflineData(data: OfflineData[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(data));
}

// Add new offline record
export function addOfflineRecord(
  type: OfflineData['type'],
  action: OfflineData['action'],
  data: Record<string, unknown>
): OfflineData {
  const record: OfflineData = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    action,
    data,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  const existing = getOfflineData();
  existing.push(record);
  saveOfflineData(existing);

  return record;
}

// Update record status
export function updateRecordStatus(
  id: string,
  status: OfflineData['status'],
  error?: string
): void {
  const data = getOfflineData();
  const index = data.findIndex(d => d.id === id);
  if (index !== -1) {
    data[index].status = status;
    if (error) data[index].error = error;
    if (status === 'synced') data[index].syncedAt = new Date().toISOString();
    saveOfflineData(data);
  }
}

// Remove synced records older than specified days
export function cleanupSyncedRecords(daysToKeep: number = 7): void {
  const data = getOfflineData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const filtered = data.filter(d => 
    d.status !== 'synced' || 
    (d.syncedAt && new Date(d.syncedAt) > cutoff)
  );
  saveOfflineData(filtered);
}

// Get pending records count
export function getPendingCount(): number {
  return getOfflineData().filter(d => d.status === 'pending' || d.status === 'failed').length;
}

// Check if online
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

// Sync endpoint mapping
const SYNC_ENDPOINTS: Record<OfflineData['type'], string> = {
  job: '/api/jobs',
  request: '/api/requests',
  return: '/api/returns',
  status_update: '/api/jobs', // Will append job ID
};

// Sync a single record
async function syncRecord(record: OfflineData): Promise<boolean> {
  try {
    let url = SYNC_ENDPOINTS[record.type];
    let method = record.action === 'create' ? 'POST' : 'PUT';

    // Handle status updates specially
    if (record.type === 'status_update' && record.data.jobId) {
      url = `${url}/${record.data.jobId}/status`;
      method = 'POST';
    } else if (record.action === 'update' && record.data.id) {
      url = `${url}/${record.data.id}`;
    }

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(record.data),
    });

    if (response.ok) {
      updateRecordStatus(record.id, 'synced');
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      updateRecordStatus(record.id, 'failed', errorData.error || 'Sync failed');
      return false;
    }
  } catch (error) {
    updateRecordStatus(record.id, 'failed', error instanceof Error ? error.message : 'Network error');
    return false;
  }
}

// Sync all pending records
export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const data = getOfflineData();
  const pending = data.filter(d => d.status === 'pending' || d.status === 'failed');

  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    updateRecordStatus(record.id, 'syncing');
    const success = await syncRecord(record);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

// Start background sync
let syncInterval: NodeJS.Timeout | null = null;

export function startBackgroundSync(onSync?: (result: { synced: number; failed: number }) => void): void {
  if (syncInterval) return;

  // Sync immediately if online
  if (isOnline()) {
    syncAllPending().then(onSync);
  }

  // Set up interval
  syncInterval = setInterval(() => {
    if (isOnline()) {
      syncAllPending().then(onSync);
    }
  }, SYNC_INTERVAL);

  // Listen for online event
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      syncAllPending().then(onSync);
    });
  }
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Generate local ID for offline records
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
