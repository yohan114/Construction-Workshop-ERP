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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ClipboardCheck, 
  Package, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface RequestLine {
  id: string;
  itemId: string;
  requestedQty: number;
  approvedQty: number | null;
  item: {
    id: string;
    code: string;
    description: string;
    uom: string;
  };
}

interface ItemRequest {
  id: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    asset: {
      code: string;
      description: string;
    };
  };
  store: {
    id: string;
    name: string;
  };
  requestedBy: {
    id: string;
    name: string;
  };
  lines: RequestLine[];
}

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState<ItemRequest[]>([]);
  const [processedRequests, setProcessedRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(null);
  const [approvedLines, setApprovedLines] = useState<Record<string, number>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/requests', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests.filter((r: ItemRequest) => r.status === 'PENDING'));
        setProcessedRequests(data.requests.filter((r: ItemRequest) => 
          ['APPROVED', 'REJECTED', 'ISSUED'].includes(r.status)
        ));
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
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

  const openApproveDialog = (request: ItemRequest) => {
    setSelectedRequest(request);
    const initialLines: Record<string, number> = {};
    request.lines.forEach(line => {
      initialLines[line.id] = line.requestedQty;
    });
    setApprovedLines(initialLines);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (request: ItemRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const lines = Object.entries(approvedLines).map(([lineId, quantity]) => ({
        lineId,
        quantity,
      }));

      const response = await fetch(`/api/requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          approvedLines: lines,
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Request approved successfully' });
        setApproveDialogOpen(false);
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          rejectionReason,
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Request rejected' });
        setRejectDialogOpen(false);
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject request', variant: 'destructive' });
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

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Approvals" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6" />
                Request Approvals
              </h2>
              <p className="text-muted-foreground">
                Review and approve item requests
              </p>
            </div>

            {/* Alert Card */}
            {pendingRequests.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                    <div>
                      <p className="font-medium">{pendingRequests.length} Pending Approval</p>
                      <p className="text-sm text-muted-foreground">
                        Review and approve or reject the requests below
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="processed">
                  Processed ({processedRequests.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <p>No pending requests</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {request.job.title}
                            </CardTitle>
                            <CardDescription>
                              Requested by {request.requestedBy.name} • {request.job.asset.code}
                            </CardDescription>
                          </div>
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          {request.lines.map((line) => (
                            <div 
                              key={line.id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded"
                            >
                              <div>
                                <p className="font-medium">{line.item.description}</p>
                                <p className="text-sm text-muted-foreground">
                                  {line.item.code} • {line.item.uom}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{line.requestedQty}</p>
                                <p className="text-xs text-muted-foreground">Requested</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => openRejectDialog(request)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => openApproveDialog(request)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="processed" className="space-y-4">
                {processedRequests.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2" />
                      <p>No processed requests</p>
                    </CardContent>
                  </Card>
                ) : (
                  processedRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{request.job.title}</p>
                            <p className="text-sm text-muted-foreground">
                              By {request.requestedBy.name} • {request.lines.length} items
                            </p>
                          </div>
                          <Badge className={
                            request.status === 'REJECTED' 
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }>
                            {request.status}
                          </Badge>
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

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>
              Review and adjust quantities if needed
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest?.lines.map((line) => (
              <div key={line.id} className="space-y-2">
                <Label>{line.item.description}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={approvedLines[line.id] || 0}
                    onChange={(e) => setApprovedLines({
                      ...approvedLines,
                      [line.id]: parseFloat(e.target.value) || 0,
                    })}
                    max={line.requestedQty}
                  />
                  <span className="text-sm text-muted-foreground">
                    / {line.requestedQty} {line.item.uom}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={actionLoading || !rejectionReason}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
