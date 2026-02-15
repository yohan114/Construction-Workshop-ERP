'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  Wrench, 
  UserPlus, 
  Loader2, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pause,
  XCircle,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
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
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  CREATED: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" /> },
  ASSIGNED: { color: 'bg-blue-100 text-blue-800', icon: <UserPlus className="h-3 w-3" /> },
  IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', icon: <Wrench className="h-3 w-3" /> },
  PAUSED: { color: 'bg-orange-100 text-orange-800', icon: <Pause className="h-3 w-3" /> },
  COMPLETED: { color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3 w-3" /> },
  CLOSED: { color: 'bg-purple-100 text-purple-800', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> },
};

const priorityConfig: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function JobsPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [assets, setAssets] = useState<{ id: string; code: string; description: string }[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);
  const [failureTypes, setFailureTypes] = useState<{ id: string; code: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const canCreate = hasRole(['ADMIN', 'MANAGER', 'SUPERVISOR']);
  const canAssign = hasRole(['ADMIN', 'MANAGER', 'SUPERVISOR']);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, assetsRes, usersRes, failureRes] = await Promise.all([
        fetch('/api/jobs', { credentials: 'include' }),
        fetch('/api/assets', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' }),
        fetch('/api/failure-types', { credentials: 'include' }).catch(() => ({ ok: false })),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs);
      }

      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data.assets);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setTechnicians(data.users.filter((u: { role: string }) => 
          ['TECHNICIAN', 'USER'].includes(u.role)
        ));
      }

      if (failureRes.ok) {
        const data = await failureRes.json();
        setFailureTypes(data.failureTypes || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
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

  const [formData, setFormData] = useState({
    assetId: '',
    failureTypeId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    type: 'BREAKDOWN',
    assignedToId: '',
  });

  const handleCreateJob = async () => {
    if (!formData.assetId || !formData.title) {
      toast({
        title: 'Validation Error',
        description: 'Asset and title are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Job created successfully' });
        setCreateDialogOpen(false);
        setFormData({
          assetId: '',
          failureTypeId: '',
          title: '',
          description: '',
          priority: 'MEDIUM',
          type: 'BREAKDOWN',
          assignedToId: '',
        });
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create job', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignJob = async () => {
    if (!selectedJob || !formData.assignedToId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a technician',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedToId: formData.assignedToId }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Job assigned successfully' });
        setAssignDialogOpen(false);
        setSelectedJob(null);
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to assign job', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Job>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.getValue('title')}</p>
          <p className="text-xs text-muted-foreground">{row.original.asset?.code}</p>
        </div>
      ),
    },
    {
      accessorKey: 'asset',
      header: 'Asset',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.asset?.description}</p>
          <p className="text-xs text-muted-foreground">{row.original.asset?.location}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const config = statusConfig[status] || statusConfig.CREATED;
        return (
          <Badge className={config.color}>
            <span className="flex items-center gap-1">
              {config.icon}
              {status.replace('_', ' ')}
            </span>
          </Badge>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.getValue('priority') as string;
        return (
          <Badge className={priorityConfig[priority] || priorityConfig.MEDIUM}>
            {priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'assignedTo',
      header: 'Assigned To',
      cell: ({ row }) => row.original.assignedTo?.name || (
        <span className="text-muted-foreground italic">Unassigned</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => new Date(row.getValue('createdAt')).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const job = row.original;
        return (
          <div className="flex items-center gap-2">
            {canAssign && job.status === 'CREATED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedJob(job);
                  setFormData({ ...formData, assignedToId: '' });
                  setAssignDialogOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Assign
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              View
            </Button>
          </div>
        );
      },
    },
  ];

  const filteredJobs = statusFilter === 'all' 
    ? jobs 
    : jobs.filter(j => j.status === statusFilter);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Jobs" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Wrench className="h-6 w-6" />
                  Job Management
                </h2>
                <p className="text-muted-foreground">
                  Manage and track maintenance jobs
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="CREATED">Created</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
                {canCreate && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Job
                  </Button>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(statusConfig).slice(0, 5).map(([status, config]) => {
                const count = jobs.filter(j => j.status === status).length;
                return (
                  <div 
                    key={status}
                    className="p-4 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={config.color}>{config.icon}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{count}</p>
                  </div>
                );
              })}
            </div>

            <DataTable
              columns={columns}
              data={filteredJobs}
              searchKey="title"
              searchPlaceholder="Search jobs..."
            />
          </div>
        </main>
      </div>

      {/* Create Job Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Create a new maintenance job
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Asset *</Label>
              <Select
                value={formData.assetId}
                onValueChange={(value) => setFormData({ ...formData, assetId: value })}
              >
                <SelectTrigger className="col-span-3">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="col-span-3"
                placeholder="Job title"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="Describe the issue..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Failure Type</Label>
              <Select
                value={formData.failureTypeId}
                onValueChange={(value) => setFormData({ ...formData, failureTypeId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {failureTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.code} - {ft.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Assign To</Label>
              <Select
                value={formData.assignedToId}
                onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select technician (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Job Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job</DialogTitle>
            <DialogDescription>
              Select a technician to assign this job
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={formData.assignedToId}
              onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignJob} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
