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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Shield,
  Truck,
  Wrench,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Lock,
  Unlock,
  Clock,
} from 'lucide-react';

interface ExecutiveData {
  period: { year: number; month: number };
  fleetAvailability: {
    avgAvailability: number;
    totalAssets: number;
    totalDowntimeHours: number;
    lostOpportunityCost: number;
    trafficLight: {
      green: any[];
      yellow: any[];
      red: any[];
    };
  };
  maintenanceSpend: {
    total: number;
    material: number;
    labor: number;
    fuel: number;
    external: number;
  };
  jobs: {
    total: number;
    completed: number;
    preventive: number;
    breakdown: number;
  };
  safety: {
    compliance: number;
    criticalJobs: number;
    compliantJobs: number;
  };
  alerts: {
    active: number;
    critical: number;
  };
  externalRepairs: {
    count: number;
    cost: number;
  };
  activeDowntimes: any[];
}

export default function ExecutivePage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      checkPeriodLock();
    }
  }, [isAuthenticated, selectedYear, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports?type=executive&year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching executive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPeriodLock = async () => {
    try {
      const res = await fetch('/api/period-locks', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const result = await res.json();
      const currentPeriod = result.locks?.find(
        (l: any) => l.year === selectedYear && l.month === selectedMonth
      );
      setIsLocked(currentPeriod?.isLocked || false);
    } catch (error) {
      console.error('Error checking period lock:', error);
    }
  };

  const handleLockPeriod = async () => {
    if (!confirm('Are you sure you want to lock this period? This action cannot be undone by non-admins.')) {
      return;
    }
    try {
      await fetch('/api/period-locks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          action: 'lock',
        }),
      });
      setIsLocked(true);
      fetchData();
    } catch (error) {
      console.error('Error locking period:', error);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const canLock = hasRole(['ADMIN', 'MANAGER']);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Executive Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {/* Period Selector & Lock */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {isLocked ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Period Locked
                </Badge>
              ) : canLock ? (
                <Button variant="outline" onClick={handleLockPeriod}>
                  <Lock className="h-4 w-4 mr-2" />
                  Lock Period
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/availability')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Fleet Availability</p>
                        <p className="text-2xl font-bold">
                          {data.fleetAvailability.avgAvailability.toFixed(1)}%
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${
                        data.fleetAvailability.avgAvailability >= 90
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : data.fleetAvailability.avgAvailability >= 70
                          ? 'bg-orange-100 dark:bg-orange-900/20'
                          : 'bg-red-100 dark:bg-red-900/20'
                      }`}>
                        <Activity className={`h-5 w-5 ${
                          data.fleetAvailability.avgAvailability >= 90
                            ? 'text-green-600'
                            : data.fleetAvailability.avgAvailability >= 70
                            ? 'text-orange-600'
                            : 'text-red-600'
                        }`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Click to drill down</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/jobs')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Maintenance Spend</p>
                        <p className="text-2xl font-bold">
                          ${data.maintenanceSpend.total.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {data.maintenanceSpend.total > 50000 ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-green-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        M: ${data.maintenanceSpend.material.toLocaleString()} | L: ${data.maintenanceSpend.labor.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/jobs')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Jobs Completed</p>
                        <p className="text-2xl font-bold">
                          {data.jobs.completed} / {data.jobs.total}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <Wrench className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {data.jobs.preventive} PM
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {data.jobs.breakdown} BD
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/alerts')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Safety Compliance</p>
                        <p className="text-2xl font-bold">
                          {data.safety.compliance.toFixed(0)}%
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${
                        data.safety.compliance >= 95
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-red-100 dark:bg-red-900/20'
                      }`}>
                        <Shield className={`h-5 w-5 ${
                          data.safety.compliance >= 95 ? 'text-green-600' : 'text-red-600'
                        }`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {data.alerts.critical > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {data.alerts.critical} Critical Alerts
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Traffic Light Overview */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Fleet Status</CardTitle>
                    <CardDescription>
                      Real-time view of asset availability
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/10">
                        <div className="w-8 h-8 rounded-full bg-green-500 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-green-600">
                          {data.fleetAvailability.trafficLight?.green?.length || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Working</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                        <div className="w-8 h-8 rounded-full bg-orange-500 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-orange-600">
                          {data.fleetAvailability.trafficLight?.yellow?.length || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Warning</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/10">
                        <div className="w-8 h-8 rounded-full bg-red-500 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-red-600">
                          {data.fleetAvailability.trafficLight?.red?.length || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Down</p>
                      </div>
                    </div>

                    {(data.activeDowntimes?.length || 0) > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Active Downtimes</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {data.activeDowntimes?.map((dt: any) => (
                            <div key={dt.id} className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-900/10">
                              <div>
                                <span className="font-medium text-sm">{dt.assetCode}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {dt.category}
                                </span>
                              </div>
                              <Badge variant="destructive" className="text-xs">
                                {Math.round(dt.durationMinutes / 60)}h
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Breakdown</CardTitle>
                    <CardDescription>
                      Monthly maintenance costs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Material</span>
                          <span>${data.maintenanceSpend.material.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${(data.maintenanceSpend.material / (data.maintenanceSpend.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Labor</span>
                          <span>${data.maintenanceSpend.labor.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(data.maintenanceSpend.labor / (data.maintenanceSpend.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Fuel</span>
                          <span>${data.maintenanceSpend.fuel.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500"
                            style={{
                              width: `${(data.maintenanceSpend.fuel / (data.maintenanceSpend.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>External</span>
                          <span>${data.maintenanceSpend.external.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500"
                            style={{
                              width: `${(data.maintenanceSpend.external / (data.maintenanceSpend.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between">
                          <span className="font-medium">Total</span>
                          <span className="font-bold">${data.maintenanceSpend.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Assets</p>
                        <p className="text-lg font-bold">{data.fleetAvailability.totalAssets}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Downtime Hours</p>
                        <p className="text-lg font-bold">
                          {data.fleetAvailability.totalDowntimeHours.toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Lost Opportunity</p>
                        <p className="text-lg font-bold text-red-600">
                          ${data.fleetAvailability.lostOpportunityCost.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Active Alerts</p>
                        <p className="text-lg font-bold">
                          {data.alerts.active}
                          {data.alerts.critical > 0 && (
                            <span className="text-red-600 text-sm ml-1">
                              ({data.alerts.critical} critical)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">No data available</p>
          )}
        </main>
      </div>
    </div>
  );
}
