'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Lock,
  Unlock,
  Server,
  Settings,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  maintenanceMode: boolean;
  checks: {
    database: { status: string; message?: string; details?: any };
    storage: { status: string; message?: string; details?: any };
    memory: { status: string; message?: string; details?: any };
  };
}

interface MaintenanceStatus {
  enabled: boolean;
  reason?: string;
  startedAt?: string;
  estimatedEnd?: string;
  enabledBy?: string;
}

export default function SystemStatusPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();

  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHealth();
      fetchMaintenanceStatus();
    }
  }, [isAuthenticated]);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/system/health', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error('Error fetching health:', error);
    }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch('/api/system/maintenance', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      setMaintenanceStatus(data);
    } catch (error) {
      console.error('Error fetching maintenance status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableMaintenance = async () => {
    if (!maintenanceReason.trim()) {
      alert('Please provide a reason for maintenance');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/system/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          action: 'enable',
          reason: maintenanceReason,
          estimatedMinutes: parseInt(estimatedMinutes),
        }),
      });

      if (res.ok) {
        setShowMaintenanceDialog(false);
        setMaintenanceReason('');
        fetchMaintenanceStatus();
        fetchHealth();
      }
    } catch (error) {
      console.error('Error enabling maintenance:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableMaintenance = async () => {
    if (!confirm('Are you sure you want to disable maintenance mode?')) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/system/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ action: 'disable' }),
      });

      if (res.ok) {
        fetchMaintenanceStatus();
        fetchHealth();
      }
    } catch (error) {
      console.error('Error disabling maintenance:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20';
      case 'degraded':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20';
      case 'unhealthy':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20';
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const isAdmin = hasRole(['ADMIN']);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="System Status" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Health
                  </CardTitle>
                  <CardDescription>
                    Real-time system status and component health
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchHealth}>
                  <Activity className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : health ? (
                <div className="space-y-6">
                  {/* Overall Status Banner */}
                  <div
                    className={`p-4 rounded-lg ${
                      health.maintenanceMode
                        ? 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200'
                        : health.status === 'healthy'
                        ? 'bg-green-50 dark:bg-green-900/10 border border-green-200'
                        : health.status === 'degraded'
                        ? 'bg-orange-50 dark:bg-orange-900/10 border border-orange-200'
                        : 'bg-red-50 dark:bg-red-900/10 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {health.maintenanceMode ? (
                          <Lock className="h-6 w-6 text-yellow-600" />
                        ) : (
                          getStatusIcon(health.status)
                        )}
                        <div>
                          <p className="font-medium">
                            {health.maintenanceMode
                              ? 'System Under Maintenance'
                              : `System ${health.status.charAt(0).toUpperCase() + health.status.slice(1)}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {health.maintenanceMode
                              ? maintenanceStatus?.reason
                              : health.checks.database.message}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(health.maintenanceMode ? 'degraded' : health.status)}>
                        {health.maintenanceMode ? 'MAINTENANCE' : health.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* System Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="font-medium">{health.version}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="font-medium">{formatUptime(health.uptime)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Last Check</p>
                      <p className="font-medium">
                        {new Date(health.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Environment</p>
                      <p className="font-medium capitalize">
                        {process.env.NODE_ENV || 'development'}
                      </p>
                    </div>
                  </div>

                  {/* Component Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-3 mb-2">
                        <Database className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Database</span>
                        {getStatusIcon(health.checks.database.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {health.checks.database.message}
                      </p>
                      {health.checks.database.details && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Size: {health.checks.database.details.size}
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-3 mb-2">
                        <HardDrive className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Storage</span>
                        {getStatusIcon(health.checks.storage.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {health.checks.storage.message}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-3 mb-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Memory</span>
                        {getStatusIcon(health.checks.memory.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {health.checks.memory.message}
                      </p>
                      {health.checks.memory.details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <p>Used: {health.checks.memory.details.heapUsed}</p>
                          <p>Total: {health.checks.memory.details.heapTotal}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Unable to load system health
                </p>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Mode Control */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>
                  Control system availability for maintenance windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    {maintenanceStatus?.enabled ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Lock className="h-5 w-5 text-yellow-500" />
                          <span className="font-medium">Maintenance Mode Active</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {maintenanceStatus.reason}
                        </p>
                        {maintenanceStatus.estimatedEnd && (
                          <p className="text-xs text-muted-foreground">
                            Estimated end: {new Date(maintenanceStatus.estimatedEnd).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Unlock className="h-5 w-5 text-green-500" />
                        <span className="font-medium">System Online</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {maintenanceStatus?.enabled ? (
                      <Button
                        variant="outline"
                        onClick={handleDisableMaintenance}
                        disabled={actionLoading}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Disable Maintenance
                      </Button>
                    ) : (
                      <Button onClick={() => setShowMaintenanceDialog(true)}>
                        <Lock className="h-4 w-4 mr-2" />
                        Enable Maintenance
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Authentication</p>
                    <p className="text-sm text-muted-foreground">JWT enabled</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Audit Logging</p>
                    <p className="text-sm text-muted-foreground">Full tracking</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Data Integrity</p>
                    <p className="text-sm text-muted-foreground">SHA-256 hashing</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Maintenance Dialog */}
      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Maintenance Mode</DialogTitle>
            <DialogDescription>
              This will make the system unavailable to all users. Use with caution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Maintenance *</Label>
              <Textarea
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                placeholder="e.g., Database upgrade, server restart..."
                rows={3}
              />
            </div>
            <div>
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                min={1}
                max={480}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMaintenanceDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnableMaintenance}
              disabled={actionLoading || !maintenanceReason.trim()}
            >
              Enable Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
