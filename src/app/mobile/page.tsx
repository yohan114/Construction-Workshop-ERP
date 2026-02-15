'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  Pause,
  Package,
  AlertTriangle,
  Play,
  Loader2,
  Smartphone,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  asset: {
    code: string;
    description: string;
    location: string;
  };
  failureType?: {
    name: string;
  };
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  CREATED: { color: 'bg-gray-500', icon: <Clock className="h-4 w-4" />, label: 'Created' },
  ASSIGNED: { color: 'bg-blue-500', icon: <Wrench className="h-4 w-4" />, label: 'Assigned' },
  IN_PROGRESS: { color: 'bg-yellow-500', icon: <Play className="h-4 w-4" />, label: 'In Progress' },
  PAUSED: { color: 'bg-orange-500', icon: <Pause className="h-4 w-4" />, label: 'Paused' },
  COMPLETED: { color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Completed' },
};

const priorityConfig: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
};

export default function MobileDashboard() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs?mine=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
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
      fetchJobs();
    }
  }, [isAuthenticated, fetchJobs]);

  const handleJobAction = async (jobId: string, action: string) => {
    setActionLoading(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: `Job ${action} successful` });
        fetchJobs();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const activeJobs = jobs.filter(j => ['ASSIGNED', 'IN_PROGRESS', 'PAUSED'].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Welcome,</p>
            <h1 className="text-lg font-bold">{user?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            <span className="text-sm">{user?.role}</span>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-blue-600">{activeJobs.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-green-600">{completedJobs.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-red-600">
                {jobs.filter(j => j.priority === 'CRITICAL').length}
              </p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            My Active Jobs
          </h2>
          {activeJobs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active jobs assigned</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => {
                const config = statusConfig[job.status];
                return (
                  <Card key={job.id} className="overflow-hidden">
                    <div className={`h-1 ${config.color}`} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{job.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {job.asset.description}
                          </CardDescription>
                        </div>
                        <Badge className={priorityConfig[job.priority]}>
                          {job.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Asset:</strong> {job.asset.code} • {job.asset.location}</p>
                        {job.failureType && (
                          <p><strong>Failure:</strong> {job.failureType.name}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={config.color.replace('bg-', 'text-')}>
                          {config.icon}
                          <span className="ml-1">{config.label}</span>
                        </Badge>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap pt-2">
                        {job.status === 'ASSIGNED' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleJobAction(job.id, 'start')}
                            disabled={actionLoading === job.id}
                          >
                            {actionLoading === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            Start Work
                          </Button>
                        )}
                        {job.status === 'IN_PROGRESS' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleJobAction(job.id, 'pause')}
                              disabled={actionLoading === job.id}
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleJobAction(job.id, 'complete')}
                              disabled={actionLoading === job.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                        {job.status === 'PAUSED' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleJobAction(job.id, 'resume')}
                            disabled={actionLoading === job.id}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        {['IN_PROGRESS', 'PAUSED'].includes(job.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push(`/mobile/request?jobId=${job.id}`)}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Request Parts
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="grid grid-cols-3 h-16">
          <button
            className="flex flex-col items-center justify-center text-primary"
            onClick={() => router.push('/mobile')}
          >
            <Wrench className="h-5 w-5" />
            <span className="text-xs mt-1">Jobs</span>
          </button>
          <button
            className="flex flex-col items-center justify-center text-muted-foreground"
            onClick={() => router.push('/mobile/request')}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs mt-1">Parts</span>
          </button>
          <button
            className="flex flex-col items-center justify-center text-muted-foreground"
            onClick={() => router.push('/')}
          >
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs mt-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
