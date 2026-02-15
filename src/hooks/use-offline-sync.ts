'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getOfflineData,
  addOfflineRecord,
  getPendingCount,
  isOnline,
  syncAllPending,
  startBackgroundSync,
  stopBackgroundSync,
  generateLocalId,
  type OfflineData,
} from '@/lib/offline-sync';

interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  pendingRecords: OfflineData[];
  addToQueue: (type: OfflineData['type'], action: OfflineData['action'], data: Record<string, unknown>) => OfflineData;
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

// Helper to get initial state outside of effect
function getInitialState() {
  const data = getOfflineData();
  return {
    online: isOnline(),
    pendingRecords: data.filter(d => d.status === 'pending' || d.status === 'failed'),
    pendingCount: getPendingCount(),
  };
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [state, setState] = useState(() => getInitialState());

  // Update state from localStorage
  const updateState = useCallback(() => {
    const newState = getInitialState();
    setState(newState);
  }, []);

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => {
      updateState();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, online: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start background sync
    startBackgroundSync(updateState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopBackgroundSync();
    };
  }, [updateState]);

  const addToQueue = useCallback((
    type: OfflineData['type'],
    action: OfflineData['action'],
    data: Record<string, unknown>
  ) => {
    const record = addOfflineRecord(type, action, {
      ...data,
      localId: generateLocalId(),
    });
    updateState();
    return record;
  }, [updateState]);

  const syncNow = useCallback(async () => {
    const result = await syncAllPending();
    updateState();
    return result;
  }, [updateState]);

  return {
    isOnline: state.online,
    pendingCount: state.pendingCount,
    pendingRecords: state.pendingRecords,
    addToQueue,
    syncNow,
  };
}
