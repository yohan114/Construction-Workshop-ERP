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
  Fuel, 
  AlertTriangle, 
  Gauge, 
  TrendingUp,
  Plus,
  Loader2,
  Car,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface FuelIssue {
  id: string;
  fuelType: string;
  quantityLiters: number;
  meterReading: number;
  consumptionRate: number | null;
  variancePercent: number | null;
  isAbnormal: boolean;
  createdAt: string;
  asset: {
    code: string;
    description: string;
  };
  store: {
    name: string;
  };
}

export default function FuelPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const [fuelIssues, setFuelIssues] = useState<FuelIssue[]>([]);
  const [abnormalIssues, setAbnormalIssues] = useState<FuelIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<{ id: string; code: string; description: string; currentMeter: number | null }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState({
    assetId: '',
    storeId: '',
    meterReading: '',
    quantityLiters: '',
    fuelType: 'DIESEL',
    unitPrice: '',
    meterBroken: false,
  });

  const canIssue = hasRole(['ADMIN', 'MANAGER', 'STOREKEEPER', 'OPERATOR']);

  const fetchData = useCallback(async () => {
    try {
      const [fuelRes, abnormalRes, assetsRes, storesRes] = await Promise.all([
        fetch('/api/fuel', { credentials: 'include' }),
        fetch('/api/fuel?abnormal=true', { credentials: 'include' }),
        fetch('/api/assets', { credentials: 'include' }),
        fetch('/api/stores', { credentials: 'include' }),
      ]);

      if (fuelRes.ok) {
        const data = await fuelRes.json();
        setFuelIssues(data.fuelIssues);
      }

      if (abnormalRes.ok) {
        const data = await abnormalRes.json();
        setAbnormalIssues(data.fuelIssues);
      }

      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data.assets.filter((a: { status: string }) => a.status === 'ACTIVE'));
      }

      if (storesRes.ok) {
        const data = await storesRes.json();
        setStores(data.stores);
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

  const handleSubmit = async () => {
    if (!formData.assetId || !formData.storeId || !formData.meterReading || !formData.quantityLiters) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assetId: formData.assetId,
          storeId: formData.storeId,
          meterReading: parseFloat(formData.meterReading),
          quantityLiters: parseFloat(formData.quantityLiters),
          fuelType: formData.fuelType,
          unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : null,
          meterBroken: formData.meterBroken,
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Fuel issued successfully' });
        setDialogOpen(false);
        setFormData({
          assetId: '',
          storeId: '',
          meterReading: '',
          quantityLiters: '',
          fuelType: 'DIESEL',
          unitPrice: '',
          meterBroken: false,
        });
        fetchData();
      } else {
        const data = await response.json();
        if (data.code === 'METER_ROLLBACK') {
          toast({
            title: 'Meter Rollback Detected',
            description: data.error,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to issue fuel', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectedAsset = assets.find(a => a.id === formData.assetId);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const totalFuelIssued = fuelIssues.reduce((sum, f) => sum + f.quantityLiters, 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Fuel Management" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Fuel className="h-6 w-6" />
                  Fuel & Meter Management
                </h2>
                <p className="text-muted-foreground">
                  Track fuel consumption and validate meter readings
                </p>
              </div>
              {canIssue && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Issue Fuel
                </Button>
              )}
            </div>

            {/* Alert Cards */}
            {abnormalIssues.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-400">
                        {abnormalIssues.length} Abnormal Consumption Alerts
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Review fuel issues with unusual consumption patterns
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Fuel className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{totalFuelIssued.toFixed(0)}L</p>
                      <p className="text-sm text-muted-foreground">Total Issued</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Car className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{fuelIssues.length}</p>
                      <p className="text-sm text-muted-foreground">Total Issues</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Gauge className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {fuelIssues.filter(f => f.consumptionRate).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Tracked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={abnormalIssues.length > 0 ? 'border-red-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-8 w-8 ${abnormalIssues.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-2xl font-bold">{abnormalIssues.length}</p>
                      <p className="text-sm text-muted-foreground">Abnormal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All Issues</TabsTrigger>
                <TabsTrigger value="abnormal">
                  Abnormal ({abnormalIssues.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Fuel Issue History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <div className="grid grid-cols-6 gap-4 p-4 bg-muted/50 font-medium text-sm">
                        <div>Date</div>
                        <div>Asset</div>
                        <div>Liters</div>
                        <div>Meter</div>
                        <div>Consumption</div>
                        <div>Status</div>
                      </div>
                      {fuelIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`grid grid-cols-6 gap-4 p-4 border-t items-center ${issue.isAbnormal ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                        >
                          <div className="text-sm">
                            {new Date(issue.createdAt).toLocaleDateString()}
                          </div>
                          <div>
                            <p className="font-medium">{issue.asset.code}</p>
                            <p className="text-xs text-muted-foreground">{issue.asset.description}</p>
                          </div>
                          <div className="font-medium">{issue.quantityLiters}L</div>
                          <div>{issue.meterReading.toLocaleString()}</div>
                          <div>
                            {issue.consumptionRate ? (
                              <span className={issue.isAbnormal ? 'text-red-600 font-medium' : ''}>
                                {issue.consumptionRate.toFixed(2)}
                                {issue.variancePercent && (
                                  <span className="text-xs ml-1">
                                    ({issue.variancePercent.toFixed(0)}% var)
                                  </span>
                                )}
                              </span>
                            ) : '-'}
                          </div>
                          <div>
                            {issue.isAbnormal ? (
                              <Badge variant="destructive">Abnormal</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Normal
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="abnormal" className="space-y-4">
                {abnormalIssues.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                      <p>No abnormal consumption detected</p>
                    </CardContent>
                  </Card>
                ) : (
                  abnormalIssues.map((issue) => (
                    <Card key={issue.id} className="border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                            <div>
                              <p className="font-medium">{issue.asset.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {issue.quantityLiters}L issued • {new Date(issue.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">
                              {issue.consumptionRate?.toFixed(2)} rate
                            </p>
                            <p className="text-sm text-red-500">
                              {issue.variancePercent?.toFixed(0)}% variance
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

      {/* Issue Fuel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Issue Fuel</DialogTitle>
            <DialogDescription>
              Record fuel issuance with meter validation
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                      {asset.currentMeter !== null && ` (Meter: ${asset.currentMeter})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Store *</Label>
              <Select
                value={formData.storeId}
                onValueChange={(value) => setFormData({ ...formData, storeId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Meter Reading *</Label>
              <Input
                type="number"
                value={formData.meterReading}
                onChange={(e) => setFormData({ ...formData, meterReading: e.target.value })}
                className="col-span-3"
                placeholder="Current meter reading"
              />
            </div>
            {selectedAsset && selectedAsset.currentMeter !== null && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div></div>
                <p className="col-span-3 text-sm text-muted-foreground">
                  Previous reading: {selectedAsset.currentMeter.toLocaleString()}
                </p>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Liters *</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.quantityLiters}
                onChange={(e) => setFormData({ ...formData, quantityLiters: e.target.value })}
                className="col-span-3"
                placeholder="Quantity in liters"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Fuel Type</Label>
              <Select
                value={formData.fuelType}
                onValueChange={(value) => setFormData({ ...formData, fuelType: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIESEL">Diesel</SelectItem>
                  <SelectItem value="PETROL">Petrol</SelectItem>
                  <SelectItem value="LPG">LPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Unit Price</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                className="col-span-3"
                placeholder="Price per liter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue Fuel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
