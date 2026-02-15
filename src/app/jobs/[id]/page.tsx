'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import {
  Wrench,
  Clock,
  CheckCircle2,
  Pause,
  Play,
  XCircle,
  Package,
  ArrowLeft,
  Loader2,
  MapPin,
  AlertTriangle,
  Calendar,
  User,
  History,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  closureNotes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalPauseTime?: number;
  asset: {
    id: string;
    code: string;
    description: string;
    location: string;
  };
  failureType?: {
    id: string;
    code: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdByUser: {
    id: string;
    name: string;
  };
  itemRequests?: {
    id: string;
    status: string;
    createdAt: string;
    lines: {
      id: string;
      requestedQty: number;
      approvedQty: number | null;
      issuedQty: number | null;
      item: {
        code: string;
        description: string;
        uom: string;
      };
    }[];
  }[];
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  CREATED: { color: 'bg-gray-500', icon: <Clock className="h-4 w-4" />, label: 'Created' },
  ASSIGNED: { color: 'bg-blue-500', icon: <User className="h-4 w-4" />, label: 'Assigned' },
  IN_PROGRESS: { color: 'bg-yellow-500', icon: <Play className="h-4 w-4" />, label: 'In Progress' },
  PAUSED: { color: 'bg-orange-500', icon: <Pause className="h-4 w-4" />, label: 'Paused' },
  COMPLETED: { color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Completed' },
  CLOSED: { color: 'bg-purple-500', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Closed' },
  CANCELLED: { color: 'bg-red-500', icon: <XCircle className="h-4 w-4" />, label: 'Cancelled' },
};

const priorityConfig: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
};

export default function JobDetailPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');

  const isSupervisor = hasRole(['ADMIN', 'MANAGER', 'SUPERVISOR']);
  const isAssigned = user?.id === job?.assignedTo?.id;

  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
      } else {
        toast({ title: 'Error', description: 'Job not found', variant: 'destructive' });
        router.push('/jobs');
      }
    } catch (error) {
      console.error('Failed to fetch job:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && jobId) {
      fetchJob();
    }
  }, [isAuthenticated, jobId, fetchJob]);

  const handleStatusAction = async (action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: `Job ${action} successful` });
        fetchJob();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'complete', notes: closureNotes }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Job completed successfully' });
        setCompleteDialogOpen(false);
        fetchJob();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete job', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !job) return null;

  const config = statusConfig[job.status];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Job Details" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Back button */}
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {/* Job Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{job.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.asset.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={priorityConfig[job.priority]}>
                      {job.priority}
                    </Badge>
                    <Badge className={`${config.color} text-white`}>
                      {config.icon}
                      <span className="ml-1">{config.label}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Asset Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Asset Code</p>
                    <p className="font-medium">{job.asset.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Asset</p>
                    <p className="font-medium">{job.asset.description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failure Type</p>
                    <p className="font-medium">{job.failureType?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{job.assignedTo?.name || 'Unassigned'}</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{job.description || 'No description'}</p>
                </div>

                {/* Timeline */}
                {(job.startedAt || job.completedAt) && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Timeline
                    </h3>
                    <div className="space-y-2 text-sm">
                      {job.startedAt && (
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4 text-green-500" />
                          <span>Started: {new Date(job.startedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {job.completedAt && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Completed: {new Date(job.completedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Closure Notes */}
                {job.closureNotes && (
                  <div>
                    <h3 className="font-semibold mb-2">Closure Notes</h3>
                    <p className="text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {job.closureNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Item Requests */}
            {job.itemRequests && job.itemRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Parts Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {job.itemRequests.map((request) => (
                      <div key={request.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                          <Badge variant="outline">{request.status}</Badge>
                        </div>
                        <div className="space-y-1">
                          {request.lines.map((line) => (
                            <div key={line.id} className="flex justify-between text-sm">
                              <span>{line.item.description}</span>
                              <span>
                                {line.issuedQty || line.approvedQty || line.requestedQty} {line.item.uom}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {isAssigned && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {job.status === 'ASSIGNED' && (
                      <Button
                        size="lg"
                        onClick={() => handleStatusAction('start')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Start Work
                      </Button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <>
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleStatusAction('pause')}
                          disabled={actionLoading}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button
                          size="lg"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setCompleteDialogOpen(true)}
                          disabled={actionLoading}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete
                        </Button>
                      </>
                    )}
                    {job.status === 'PAUSED' && (
                      <Button
                        size="lg"
                        onClick={() => handleStatusAction('resume')}
                        disabled={actionLoading}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    {job.status === 'COMPLETED' && isSupervisor && (
                      <Button
                        size="lg"
                        onClick={() => handleStatusAction('close')}
                        disabled={actionLoading}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Close Job
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
            <DialogDescription>
              Add any notes about the work completed
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter closure notes..."
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Complete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
