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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, Box, Loader2 } from 'lucide-react';

interface Item {
  id: string;
  code: string;
  description: string;
  uom: string | null;
  category: string | null;
  status: string;
  valuationMethod: string;
  unitPrice: number | null;
  minStock: number | null;
  maxStock: number | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  DISCONTINUED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export default function ItemsPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    uom: '',
    category: '',
    status: 'ACTIVE',
    valuationMethod: 'WEIGHTED_AVERAGE',
    unitPrice: '',
    minStock: '',
    maxStock: '',
  });
  const [saving, setSaving] = useState(false);

  const canEdit = hasRole(['ADMIN', 'MANAGER']);

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch('/api/items', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
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
      fetchItems();
    }
  }, [isAuthenticated, fetchItems]);

  const handleOpenDialog = (item?: Item) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        code: item.code,
        description: item.description,
        uom: item.uom || '',
        category: item.category || '',
        status: item.status,
        valuationMethod: item.valuationMethod,
        unitPrice: item.unitPrice?.toString() || '',
        minStock: item.minStock?.toString() || '',
        maxStock: item.maxStock?.toString() || '',
      });
    } else {
      setSelectedItem(null);
      setFormData({
        code: '',
        description: '',
        uom: '',
        category: '',
        status: 'ACTIVE',
        valuationMethod: 'WEIGHTED_AVERAGE',
        unitPrice: '',
        minStock: '',
        maxStock: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.description) {
      toast({
        title: 'Validation Error',
        description: 'Code and Description are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const url = selectedItem ? `/api/items/${selectedItem.id}` : '/api/items';
      const method = selectedItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: selectedItem ? 'Item updated successfully' : 'Item created successfully',
        });
        setDialogOpen(false);
        fetchItems();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to save item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const response = await fetch(`/api/items/${selectedItem.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Item deleted successfully',
        });
        setDeleteDialogOpen(false);
        fetchItems();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const columns: ColumnDef<Item>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
    },
    {
      accessorKey: 'description',
      header: 'Description',
    },
    {
      accessorKey: 'uom',
      header: 'UoM',
      cell: ({ row }) => row.getValue('uom') || '-',
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => row.getValue('category') || '-',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <Badge className={statusColors[status] || ''}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'unitPrice',
      header: 'Unit Price',
      cell: ({ row }) => {
        const price = row.getValue('unitPrice') as number | null;
        return price ? `$${price.toFixed(2)}` : '-';
      },
    },
    {
      accessorKey: 'valuationMethod',
      header: 'Valuation',
      cell: ({ row }) => {
        const method = row.getValue('valuationMethod') as string;
        return method.replace('_', ' ');
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        if (!canEdit) return null;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenDialog(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedItem(row.original);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Items" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Box className="h-6 w-6" />
                  Item Master
                </h2>
                <p className="text-muted-foreground">
                  Manage your inventory items
                </p>
              </div>
              {canEdit && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
            </div>

            <DataTable
              columns={columns}
              data={items}
              searchKey="code"
              searchPlaceholder="Search by code..."
            />
          </div>
        </main>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? 'Update the item information below.'
                : 'Fill in the item details below.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                Code *
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description *
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="uom" className="text-right">
                UoM
              </Label>
              <Input
                id="uom"
                value={formData.uom}
                onChange={(e) =>
                  setFormData({ ...formData, uom: e.target.value })
                }
                className="col-span-3"
                placeholder="e.g., PCS, KG, LTR"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="valuationMethod" className="text-right">
                Valuation
              </Label>
              <Select
                value={formData.valuationMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, valuationMethod: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEIGHTED_AVERAGE">Weighted Average</SelectItem>
                  <SelectItem value="FIFO">FIFO</SelectItem>
                  <SelectItem value="LIFO">LIFO</SelectItem>
                  <SelectItem value="STANDARD_COST">Standard Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unitPrice" className="text-right">
                Unit Price
              </Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="minStock" className="text-right">
                Min Stock
              </Label>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({ ...formData, minStock: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxStock" className="text-right">
                Max Stock
              </Label>
              <Input
                id="maxStock"
                type="number"
                step="0.01"
                value={formData.maxStock}
                onChange={(e) =>
                  setFormData({ ...formData, maxStock: e.target.value })
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete item &quot;{selectedItem?.description}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
