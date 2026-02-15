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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  Plus,
  ArrowRightLeft,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface ExternalRepair {
  id: string;
  assetId: string;
  asset: {
    code: string;
    description: string;
  };
  vendorName: string;
  vendorReference: string | null;
  gatePassNumber: string;
  gatePassType: string;
  sentOutAt: string | null;
  receivedAt: string | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  isPaid: boolean;
  status: string;
  estimatedCost: number | null;
  conditionNotes: string | null;
  completionNotes: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  totalCost: number;
  outForRepair: number;
}

export default function ExternalRepairsPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();

  const [repairs, setRepairs] = useState<ExternalRepair[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    totalCost: 0,
    outForRepair: 0,
  });
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<ExternalRepair | null>(null);

  const [formData, setFormData] = useState({
    assetId: '',
    vendorName: '',
    vendorReference: '',
    vendorContact: '',
    estimatedCost: '',
    notes: '',
  });

  const [receiveData, setReceiveData] = useState({
    conditionNotes: '',
    invoiceNumber: '',
    invoiceAmount: '',
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
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [repairsRes, assetsRes] = await Promise.all([
        fetch('/api/external-repairs', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }),
        fetch('/api/assets', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }),
      ]);

      const repairsData = await repairsRes.json();
      const assetsData = await assetsRes.json();

      setRepairs(repairsData.repairs || []);
      setStats(repairsData.stats || {});
      setAssets(assetsData.assets || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/external-repairs', {
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
          vendorName: '',
          vendorReference: '',
          vendorContact: '',
          estimatedCost: '',
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error creating repair:', error);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      const res = await fetch('/api/external-repairs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          id: selectedRepair.id,
          action: 'receive',
          ...receiveData,
        }),
      });

      if (res.ok) {
        setShowReceiveDialog(false);
        setSelectedRepair(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error receiving repair:', error);
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;

    try {
      const res = await fetch('/api/external-repairs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          id: selectedRepair.id,
          action: 'invoice',
          ...receiveData,
        }),
      });

      if (res.ok) {
        setShowInvoiceDialog(false);
        setSelectedRepair(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
    }
  };

  const handleMarkPaid = async (repair: ExternalRepair) => {
    try {
      await fetch('/api/external-repairs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          id: repair.id,
          action: 'pay',
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20';
    }
  };

  const canCreate = hasRole(['ADMIN', 'MANAGER', 'SUPERVISOR']);

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
        <Header title="External Repairs" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
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
                    <p className="text-sm text-muted-foreground">Out for Repair</p>
                    <p className="text-2xl font-bold">{stats.outForRepair}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
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
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">${stats.totalCost.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Create Button */}
          {canCreate && (
            <div className="flex justify-end">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Gate Pass
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Gate Pass</DialogTitle>
                    <DialogDescription>
                      Send an asset out for external repair
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
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
                    <div>
                      <Label>Vendor Name *</Label>
                      <Input
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        placeholder="e.g., ABC Motors"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Vendor Reference</Label>
                        <Input
                          value={formData.vendorReference}
                          onChange={(e) =>
                            setFormData({ ...formData, vendorReference: e.target.value })
                          }
                          placeholder="Vendor job number"
                        />
                      </div>
                      <div>
                        <Label>Estimated Cost</Label>
                        <Input
                          type="number"
                          value={formData.estimatedCost}
                          onChange={(e) =>
                            setFormData({ ...formData, estimatedCost: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Reason for external repair..."
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Gate Pass</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Repairs List */}
          <Card>
            <CardHeader>
              <CardTitle>External Repairs</CardTitle>
              <CardDescription>
                Track assets sent to external vendors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {repairs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No external repairs recorded
                  </p>
                ) : (
                  repairs.map((repair) => (
                    <div
                      key={repair.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/50 gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            repair.receivedAt
                              ? 'bg-green-100 dark:bg-green-900/20'
                              : 'bg-orange-100 dark:bg-orange-900/20'
                          }`}
                        >
                          {repair.receivedAt ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowRightLeft className="h-5 w-5 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{repair.asset.code}</p>
                            <Badge className={getStatusColor(repair.status)}>
                              {repair.status}
                            </Badge>
                            {repair.isPaid && (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Paid
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {repair.asset.description}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Vendor: {repair.vendorName}</span>
                            <span>GP: {repair.gatePassNumber}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col md:items-end gap-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Sent:</span>{' '}
                          {repair.sentOutAt
                            ? new Date(repair.sentOutAt).toLocaleDateString()
                            : 'N/A'}
                        </div>
                        {repair.receivedAt && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Received:</span>{' '}
                            {new Date(repair.receivedAt).toLocaleDateString()}
                          </div>
                        )}
                        {repair.invoiceAmount && (
                          <div className="text-sm font-medium">
                            ${repair.invoiceAmount.toLocaleString()}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          {!repair.receivedAt && canCreate && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRepair(repair);
                                setShowReceiveDialog(true);
                              }}
                            >
                              Receive
                            </Button>
                          )}
                          {repair.receivedAt && !repair.invoiceAmount && canCreate && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRepair(repair);
                                setShowInvoiceDialog(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Invoice
                            </Button>
                          )}
                          {repair.invoiceAmount && !repair.isPaid && hasRole(['ADMIN', 'MANAGER']) && (
                            <Button size="sm" onClick={() => handleMarkPaid(repair)}>
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Receive Dialog */}
          <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Receive Asset</DialogTitle>
                <DialogDescription>
                  Mark asset as returned from vendor
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleReceive} className="space-y-4">
                <div>
                  <Label>Condition Notes</Label>
                  <Textarea
                    value={receiveData.conditionNotes}
                    onChange={(e) => setReceiveData({ ...receiveData, conditionNotes: e.target.value })}
                    placeholder="Describe the condition of the returned asset..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input
                      value={receiveData.invoiceNumber}
                      onChange={(e) => setReceiveData({ ...receiveData, invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Invoice Amount</Label>
                    <Input
                      type="number"
                      value={receiveData.invoiceAmount}
                      onChange={(e) => setReceiveData({ ...receiveData, invoiceAmount: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Receive Asset</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Invoice Dialog */}
          <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Invoice</DialogTitle>
                <DialogDescription>
                  Record invoice details for this repair
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddInvoice} className="space-y-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    value={receiveData.invoiceNumber}
                    onChange={(e) => setReceiveData({ ...receiveData, invoiceNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Invoice Amount</Label>
                  <Input
                    type="number"
                    value={receiveData.invoiceAmount}
                    onChange={(e) => setReceiveData({ ...receiveData, invoiceAmount: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Save Invoice</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
