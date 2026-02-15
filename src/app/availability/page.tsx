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
  ArrowDown,
  ArrowUp,
  Clock,
  DollarSign,
  Minus,
  Truck,
  Wrench,
} from 'lucide-react';

interface TrafficLightItem {
  assetId: string;
  assetCode: string;
  assetDescription: string;
  availabilityPercent: number;
  downtimeHours: number;
  lostOpportunityCost: number;
}

interface ActiveDowntime {
  id: string;
  assetId: string;
  assetCode: string;
  assetDescription: string;
  category: string;
  startedAt: string;
  durationMinutes: number;
  notes: string;
}

interface ParetoItem {
  category: string;
  hours: number;
  count: number;
  cumulativePercent: number;
}

export default function AvailabilityPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<any>(null);
  const [pareto, setPareto] = useState<ParetoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, selectedYear, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/downtime?year=${selectedYear}&month=${selectedMonth}&pareto=true`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const data = await res.json();
      setDashboard(data.dashboard);
      setPareto(data.pareto?.paretoData || []);
    } catch (error) {
      console.error('Error fetching availability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndDowntime = async (downtimeId: string) => {
    try {
      await fetch('/api/downtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          action: 'end',
          downtimeLogId: downtimeId,
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Error ending downtime:', error);
    }
  };

  const getAvailabilityColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600';
    if (percent >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAvailabilityBg = (percent: number) => {
    if (percent >= 90) return 'bg-green-100 dark:bg-green-900/20';
    if (percent >= 70) return 'bg-orange-100 dark:bg-orange-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

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
        <Header title="Availability Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {/* Period Selector */}
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Fleet Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <Truck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Assets</p>
                        <p className="text-2xl font-bold">{dashboard?.fleetStats?.totalAssets || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <Activity className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Availability</p>
                        <p className="text-2xl font-bold">
                          {(dashboard?.fleetStats?.avgAvailability || 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                        <Clock className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Downtime</p>
                        <p className="text-2xl font-bold">
                          {(dashboard?.fleetStats?.totalDowntimeHours || 0).toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                        <DollarSign className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Lost Opportunity</p>
                        <p className="text-2xl font-bold">
                          ${(dashboard?.fleetStats?.totalLostOpportunityCost || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Traffic Light View */}
              <Card>
                <CardHeader>
                  <CardTitle>Fleet Status</CardTitle>
                  <CardDescription>
                    Traffic light view of asset availability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Green */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        Working ({dashboard?.trafficLight?.green?.length || 0})
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(dashboard?.trafficLight?.green || []).map((item: TrafficLightItem) => (
                          <div
                            key={item.assetId}
                            className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{item.assetCode}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.assetDescription}
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-green-100 text-green-700">
                                {item.availabilityPercent.toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Yellow */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-orange-600 font-medium">
                        <div className="w-4 h-4 rounded-full bg-orange-500" />
                        Warning ({dashboard?.trafficLight?.yellow?.length || 0})
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(dashboard?.trafficLight?.yellow || []).map((item: TrafficLightItem) => (
                          <div
                            key={item.assetId}
                            className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{item.assetCode}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.assetDescription}
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-orange-100 text-orange-700">
                                {item.availabilityPercent.toFixed(0)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.downtimeHours.toFixed(1)}h downtime
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Red */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600 font-medium">
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                        Down ({dashboard?.trafficLight?.red?.length || 0})
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(dashboard?.trafficLight?.red || []).map((item: TrafficLightItem) => (
                          <div
                            key={item.assetId}
                            className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{item.assetCode}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.assetDescription}
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-red-100 text-red-700">
                                {item.availabilityPercent.toFixed(0)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.downtimeHours.toFixed(1)}h downtime
                            </p>
                            {item.lostOpportunityCost > 0 && (
                              <p className="text-xs text-red-600 font-medium">
                                ${item.lostOpportunityCost.toLocaleString()} lost
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Downtimes */}
              {(dashboard?.activeDowntimes?.length || 0) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Active Downtimes
                    </CardTitle>
                    <CardDescription>
                      Assets currently experiencing downtime
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboard?.activeDowntimes?.map((downtime: ActiveDowntime) => (
                        <div
                          key={downtime.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                              <Wrench className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium">{downtime.assetCode}</p>
                              <p className="text-sm text-muted-foreground">
                                {downtime.assetDescription}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="destructive">{downtime.category}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Started: {new Date(downtime.startedAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">
                                {formatDuration(downtime.durationMinutes)}
                              </p>
                              <p className="text-xs text-muted-foreground">Duration</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleEndDowntime(downtime.id)}
                            >
                              End Downtime
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Downtime Pareto Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Downtime Pareto</CardTitle>
                    <CardDescription>
                      Top reasons for downtime this month
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pareto.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No downtime recorded this month
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {pareto.map((item, index) => (
                          <div key={item.category}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium capitalize">
                                {item.category.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {item.hours.toFixed(1)}h ({item.count} events)
                              </span>
                            </div>
                            <div className="h-4 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${(item.hours / (pareto[0]?.hours || 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground">
                                Cumulative: {item.cumulativePercent}%
                              </span>
                              {index < 2 && (
                                <Badge variant="outline" className="text-xs">
                                  Top Cause
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                    <CardDescription>
                      Period overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Total Events</p>
                          <p className="text-xl font-bold">
                            {pareto.reduce((sum, p) => sum + p.count, 0)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Total Hours</p>
                          <p className="text-xl font-bold">
                            {pareto.reduce((sum, p) => sum + p.hours, 0).toFixed(1)}h
                          </p>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-2">Top 3 Causes</p>
                        <div className="space-y-1">
                          {pareto.slice(0, 3).map((item, i) => (
                            <div key={item.category} className="flex items-center gap-2">
                              <span className="text-lg font-bold">{i + 1}.</span>
                              <span className="capitalize text-sm">
                                {item.category.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({item.hours.toFixed(1)}h)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
