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
import { toast } from '@/components/ui/use-toast';
import { 
  Package, 
  Warehouse, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  QrCode,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';

interface ItemRequest {
  id: string;
  status: string;
  createdAt: string;
  qrCode?: string;
  qrExpiresAt?: string;
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
  lines: {
    id: string;
    itemId: string;
    requestedQty: number;
    approvedQty: number | null;
    issuedQty: number | null;
    item: {
      id: string;
      code: string;
      description: string;
      uom: string;
    };
  }[];
}

interface StockItem {
  id: string;
  quantity: number;
  item: {
    id: string;
    code: string;
    description: string;
    uom: string;
    minStock: number | null;
    maxStock: number | null;
    unitPrice: number | null;
  };
  store: {
    id: string;
    name: string;
  };
}

export default function StorekeeperDashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState<ItemRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ItemRequest[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(null);
  const [issuedLines, setIssuedLines] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [requestsRes, stockRes] = await Promise.all([
        fetch('/api/requests', { credentials: 'include' }),
        fetch('/api/stock', { credentials: 'include' }),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setPendingRequests(data.requests.filter((r: ItemRequest) => r.status === 'APPROVED'));
        setApprovedRequests(data.requests.filter((r: ItemRequest) => r.status === 'ISSUED'));
      }

      if (stockRes.ok) {
        const data = await stockRes.json();
        setStock(data.stock);
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

  const handlePrepareIssue = async (request: ItemRequest) => {
    setSelectedRequest(request);
    const initialLines: Record<string, number> = {};
    request.lines.forEach(line => {
      initialLines[line.id] = line.approvedQty || line.requestedQty;
    });
    setIssuedLines(initialLines);
    setIssueDialogOpen(true);
  };

  const handleIssueItems = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const lines = Object.entries(issuedLines).map(([lineId, quantity]) => ({
        id: lineId,
        issuedQty: quantity,
      }));

      const response = await fetch(`/api/requests/${selectedRequest.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'issue',
          issuedLines: lines.map(l => ({
            lineId: l.id,
            issuedQty: l.issuedQty,
          })),
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Items issued successfully' });
        setIssueDialogOpen(false);
        fetchData();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to issue items', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const lowStockItems = stock.filter(s => 
    s.item.minStock && s.quantity < s.item.minStock
  );

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
        <Header title="Storekeeper" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Warehouse className="h-6 w-6" />
                Storekeeper Dashboard
              </h2>
              <p className="text-muted-foreground">
                Manage inventory requests and stock
              </p>
            </div>

            {/* Alert Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">{pendingRequests.length}</p>
                      <p className="text-sm text-muted-foreground">Pending Issues</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold">{lowStockItems.length}</p>
                      <p className="text-sm text-muted-foreground">Low Stock Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50 dark:bg-green-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{stock.length}</p>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending Issues ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="stock">
                  Stock Levels
                </TabsTrigger>
                <TabsTrigger value="low">
                  Low Stock ({lowStockItems.length})
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
                          <Badge className="bg-blue-100 text-blue-800">
                            Approved
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
                                <p className="font-bold">{line.approvedQty || line.requestedQty}</p>
                                <p className="text-xs text-muted-foreground">Qty</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => handlePrepareIssue(request)}
                        >
                          <ArrowDownToLine className="h-4 w-4 mr-2" />
                          Issue Items
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="stock" className="space-y-4">
                <div className="rounded-md border">
                  <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 font-medium text-sm">
                    <div>Item</div>
                    <div>Quantity</div>
                    <div>Min/Max</div>
                    <div>Status</div>
                  </div>
                  {stock.map((item) => (
                    <div 
                      key={item.id}
                      className="grid grid-cols-4 gap-4 p-4 border-t items-center"
                    >
                      <div>
                        <p className="font-medium">{item.item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.item.code}</p>
                      </div>
                      <div>
                        <p className="font-bold">{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">{item.item.uom}</p>
                      </div>
                      <div className="text-sm">
                        {item.item.minStock || '-'} / {item.item.maxStock || '-'}
                      </div>
                      <div>
                        {item.item.minStock && item.quantity < item.item.minStock ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            OK
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="low" className="space-y-4">
                {lowStockItems.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <p>All items are above minimum stock levels</p>
                    </CardContent>
                  </Card>
                ) : (
                  lowStockItems.map((item) => (
                    <Card key={item.id} className="border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{item.item.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.item.code} • Min: {item.item.minStock}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-red-600">{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">Current</p>
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

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Issue Items</DialogTitle>
            <DialogDescription>
              Confirm the quantities to issue
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest?.lines.map((line) => (
              <div key={line.id} className="space-y-2">
                <Label>{line.item.description}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={issuedLines[line.id] || 0}
                    onChange={(e) => setIssuedLines({
                      ...issuedLines,
                      [line.id]: parseFloat(e.target.value) || 0,
                    })}
                    max={line.approvedQty || line.requestedQty}
                  />
                  <span className="text-sm text-muted-foreground">
                    / {line.approvedQty || line.requestedQty} {line.item.uom}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleIssueItems} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
