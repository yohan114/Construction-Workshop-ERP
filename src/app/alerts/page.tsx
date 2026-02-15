'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { 
  AlertTriangle, 
  Bell, 
  AlertCircle,
  Fuel,
  Gauge,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

const severityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const typeIcons: Record<string, React.ReactNode> = {
  ABNORMAL_CONSUMPTION: <Fuel className="h-5 w-5" />,
  ZERO_CONSUMPTION: <AlertCircle className="h-5 w-5" />,
  METER_ROLLBACK: <Gauge className="h-5 w-5" />,
  SAFETY_VIOLATION: <Shield className="h-5 w-5" />,
  FRAUD_SUSPECTED: <AlertTriangle className="h-5 w-5" />,
  LOW_STOCK: <AlertTriangle className="h-5 w-5" />,
  COST_OVERRUN: <AlertTriangle className="h-5 w-5" />,
};

export default function AlertsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Alert resolved' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to resolve alert', variant: 'destructive' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const unResolvedAlerts = alerts.filter(a => !a.isResolved);
  const resolvedAlerts = alerts.filter(a => a.isResolved);
  const criticalCount = alerts.filter(a => !a.isResolved && a.severity === 'CRITICAL').length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Alerts" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-6 w-6" />
                Alerts & Notifications
              </h2>
              <p className="text-muted-foreground">
                Monitor system alerts and anomalies
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{alerts.length}</p>
                      <p className="text-sm text-muted-foreground">Total Alerts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={unResolvedAlerts.length > 0 ? 'border-orange-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-8 w-8 ${unResolvedAlerts.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-2xl font-bold">{unResolvedAlerts.length}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={criticalCount > 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`h-8 w-8 ${criticalCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-2xl font-bold">{criticalCount}</p>
                      <p className="text-sm text-muted-foreground">Critical</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{resolvedAlerts.length}</p>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending ({unResolvedAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved ({resolvedAlerts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {unResolvedAlerts.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <p>No pending alerts</p>
                    </CardContent>
                  </Card>
                ) : (
                  unResolvedAlerts.map((alert) => (
                    <Card key={alert.id} className={alert.severity === 'CRITICAL' ? 'border-red-200' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${
                              alert.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/20' :
                              alert.severity === 'HIGH' ? 'bg-orange-100 dark:bg-orange-900/20' :
                              'bg-yellow-100 dark:bg-yellow-900/20'
                            }`}>
                              {typeIcons[alert.type] || <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{alert.title}</p>
                                <Badge className={severityColors[alert.severity]}>
                                  {alert.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(alert.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="resolved" className="space-y-4">
                {resolvedAlerts.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <p>No resolved alerts</p>
                    </CardContent>
                  </Card>
                ) : (
                  resolvedAlerts.map((alert) => (
                    <Card key={alert.id} className="opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{alert.title}</p>
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Resolved
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Created: {new Date(alert.createdAt).toLocaleString()}
                              {alert.resolvedAt && (
                                <> • Resolved: {new Date(alert.resolvedAt).toLocaleString()}</>
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
