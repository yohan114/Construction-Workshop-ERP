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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, Plus, Wrench, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface PMSchedule {
  id: string;
  assetId: string;
  asset: {
    id: string;
    code: string;
    description: string;
    currentMeter: number;
    status: string;
  };
  intervalType: string;
  intervalValue: number;
  lastServiceMeter: number;
  nextDueMeter: number;
  lastServiceDate: string | null;
  jobTitleTemplate: string;
  priority: string;
  isActive: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  assetCode: string;
  assetDescription: string;
  dueDate: Date;
  isDue: boolean;
  isOverdue: boolean;
  currentMeter: number;
  nextDueMeter: number;
  intervalType: string;
  intervalValue: number;
}

export default function PMPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    assetId: '',
    intervalType: 'HOURS',
    intervalValue: '',
    jobTitleTemplate: 'PM Service - {asset_code}',
    jobDescription: '',
    estimatedDuration: '',
    priority: 'MEDIUM',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, currentMonth]);

  const fetchData = async () => {
    try {
      // Fetch PM schedules
      const schedulesRes = await fetch('/api/pm-schedules?includeStatus=true', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const schedulesData = await schedulesRes.json();
      setSchedules(schedulesData.schedules || []);

      // Fetch calendar events
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const calendarRes = await fetch(
        `/api/pm-schedules?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const calendarData = await calendarRes.json();
      setCalendarEvents(calendarData.upcoming || []);

      // Fetch assets for form
      const assetsRes = await fetch('/api/assets', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const assetsData = await assetsRes.json();
      setAssets(assetsData.assets || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/pm-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowAddDialog(false);
        fetchData();
        setFormData({
          assetId: '',
          intervalType: 'HOURS',
          intervalValue: '',
          jobTitleTemplate: 'PM Service - {asset_code}',
          jobDescription: '',
          estimatedDuration: '',
          priority: 'MEDIUM',
        });
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfMonth };
  };

  const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentMonth);

  const getEventsForDay = (day: number) => {
    return calendarEvents.filter((event) => {
      const eventDate = new Date(event.dueDate);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentMonth.getMonth() &&
        eventDate.getFullYear() === currentMonth.getFullYear()
      );
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const canCreate = hasRole(['ADMIN', 'MANAGER', 'SUPERVISOR']);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Preventive Maintenance" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Schedules</p>
                    <p className="text-2xl font-bold">{schedules.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">
                      {schedules.filter((s) => s.isActive).length}
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
                    <p className="text-sm text-muted-foreground">Due Soon</p>
                    <p className="text-2xl font-bold">
                      {calendarEvents.filter((e) => e.isDue && !e.isOverdue).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold">
                      {calendarEvents.filter((e) => e.isOverdue).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendar */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>PM Calendar</CardTitle>
                  <CardDescription>
                    View upcoming preventive maintenance schedules
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {canCreate && (
                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Schedule
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create PM Schedule</DialogTitle>
                          <DialogDescription>
                            Configure preventive maintenance for an asset
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label>Asset</Label>
                            <Select
                              value={formData.assetId}
                              onValueChange={(v) => setFormData({ ...formData, assetId: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select asset" />
                              </SelectTrigger>
                              <SelectContent>
                                {assets.map((asset) => (
                                  <SelectItem key={asset.id} value={asset.id}>
                                    {asset.code} - {asset.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Interval Type</Label>
                              <Select
                                value={formData.intervalType}
                                onValueChange={(v) => setFormData({ ...formData, intervalType: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="HOURS">Hours</SelectItem>
                                  <SelectItem value="DAYS">Days</SelectItem>
                                  <SelectItem value="KILOMETERS">Kilometers</SelectItem>
                                  <SelectItem value="MILES">Miles</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Interval Value</Label>
                              <Input
                                type="number"
                                value={formData.intervalValue}
                                onChange={(e) =>
                                  setFormData({ ...formData, intervalValue: e.target.value })
                                }
                                placeholder="e.g., 250"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Job Title Template</Label>
                            <Input
                              value={formData.jobTitleTemplate}
                              onChange={(e) =>
                                setFormData({ ...formData, jobTitleTemplate: e.target.value })
                              }
                              placeholder="PM Service - {asset_code}"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Use {'{asset_code}'} and {'{asset_description}'} as placeholders
                            </p>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={formData.jobDescription}
                              onChange={(e) =>
                                setFormData({ ...formData, jobDescription: e.target.value })
                              }
                              placeholder="Maintenance tasks to perform..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Est. Duration (hours)</Label>
                              <Input
                                type="number"
                                value={formData.estimatedDuration}
                                onChange={(e) =>
                                  setFormData({ ...formData, estimatedDuration: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Priority</Label>
                              <Select
                                value={formData.priority}
                                onValueChange={(v) => setFormData({ ...formData, priority: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="LOW">Low</SelectItem>
                                  <SelectItem value="MEDIUM">Medium</SelectItem>
                                  <SelectItem value="HIGH">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">Create Schedule</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 min-h-[80px]" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const events = getEventsForDay(day);
                  return (
                    <div
                      key={day}
                      className={`p-2 min-h-[80px] border rounded-lg ${
                        isToday(day) ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                      }`}
                    >
                      <span className={`text-sm ${isToday(day) ? 'font-bold' : ''}`}>{day}</span>
                      <div className="mt-1 space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate ${
                              event.isOverdue
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/20'
                                : event.isDue
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20'
                            }`}
                          >
                            {event.assetCode}
                          </div>
                        ))}
                        {events.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{events.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Schedules List */}
          <Card>
            <CardHeader>
              <CardTitle>PM Schedules</CardTitle>
              <CardDescription>Configured preventive maintenance schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {schedules.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No PM schedules configured. Create one to get started.
                  </p>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/50 gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                          <Wrench className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{schedule.asset.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.asset.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              Every {schedule.intervalValue} {schedule.intervalType.toLowerCase()}
                            </Badge>
                            <Badge variant="secondary">{schedule.priority}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-1">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Current:</span>{' '}
                          {schedule.asset.currentMeter.toLocaleString()}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Next Due:</span>{' '}
                          {schedule.nextDueMeter.toLocaleString()}
                        </div>
                        {schedule.lastServiceDate && (
                          <div className="text-sm text-muted-foreground">
                            Last: {new Date(schedule.lastServiceDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
