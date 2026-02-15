'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Package, 
  Plus, 
  Trash2, 
  Search,
  Loader2,
  ArrowLeft,
  Send,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  status: string;
  asset: {
    code: string;
    description: string;
  };
}

interface Item {
  id: string;
  code: string;
  description: string;
  uom: string;
}

interface RequestLine {
  itemId: string;
  item?: Item;
  quantity: number;
}

export default function RequestPartsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState(preselectedJobId || '');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [lines, setLines] = useState<RequestLine[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, storesRes] = await Promise.all([
        fetch('/api/jobs?mine=true', { credentials: 'include' }),
        fetch('/api/stores', { credentials: 'include' }),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        // Only show active jobs
        setJobs(data.jobs.filter((j: Job) => 
          ['ASSIGNED', 'IN_PROGRESS', 'PAUSED'].includes(j.status)
        ));
      }

      if (storesRes.ok) {
        const data = await storesRes.json();
        setStores(data.stores);
        if (data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
        }
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

  // Blind item search - no stock/cost info
  const searchItems = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/items/search?q=${encodeURIComponent(term)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.items);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchItems(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addItemToRequest = (item: Item) => {
    const existing = lines.find(l => l.itemId === item.id);
    if (existing) {
      setLines(lines.map(l => 
        l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l
      ));
    } else {
      setLines([...lines, { itemId: item.id, item, quantity: 1 }]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const updateLineQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setLines(lines.filter(l => l.itemId !== itemId));
    } else {
      setLines(lines.map(l => 
        l.itemId === itemId ? { ...l, quantity } : l
      ));
    }
  };

  const removeLine = (itemId: string) => {
    setLines(lines.filter(l => l.itemId !== itemId));
  };

  const handleSubmit = async () => {
    if (!selectedJobId) {
      toast({ title: 'Error', description: 'Please select a job', variant: 'destructive' });
      return;
    }

    if (!selectedStoreId) {
      toast({ title: 'Error', description: 'Please select a store', variant: 'destructive' });
      return;
    }

    if (lines.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one item', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId: selectedJobId,
          storeId: selectedStoreId,
          lines: lines.map(l => ({
            itemId: l.itemId,
            quantity: l.quantity,
          })),
        }),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Request submitted successfully' });
        router.push('/mobile');
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => router.push('/mobile')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Request Parts</h1>
            <p className="text-sm opacity-90">Select items for your job</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Job Selection */}
        <div className="space-y-2">
          <Label>Select Job *</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  <div className="flex items-center gap-2">
                    <span>{job.title}</span>
                    <span className="text-xs text-muted-foreground">
                      ({job.asset.code})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Store Selection */}
        <div className="space-y-2">
          <Label>Select Store *</Label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a store" />
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

        {/* Item Search */}
        <div className="space-y-2">
          <Label>Search Items</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Type to search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching...
            </div>
          )}

          {searchResults.length > 0 && (
            <Card className="overflow-hidden">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  className="w-full p-3 flex items-center justify-between hover:bg-muted/50 border-b last:border-b-0 text-left"
                  onClick={() => addItemToRequest(item)}
                >
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.code} • {item.uom}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </Card>
          )}
        </div>

        {/* Request Lines */}
        {lines.length > 0 && (
          <div className="space-y-3">
            <Label>Requested Items</Label>
            {lines.map((line) => (
              <Card key={line.itemId}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{line.item?.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.item?.code} • {line.item?.uom}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateLineQuantity(line.itemId, line.quantity - 1)}
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(line.itemId, parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateLineQuantity(line.itemId, line.quantity + 1)}
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => removeLine(line.itemId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || lines.length === 0}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Request
        </Button>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="grid grid-cols-3 h-16">
          <button
            className="flex flex-col items-center justify-center text-muted-foreground"
            onClick={() => router.push('/mobile')}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs mt-1">Jobs</span>
          </button>
          <button
            className="flex flex-col items-center justify-center text-primary"
          >
            <Package className="h-5 w-5" />
            <span className="text-xs mt-1">Parts</span>
          </button>
          <button
            className="flex flex-col items-center justify-center text-muted-foreground"
            onClick={() => router.push('/')}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs mt-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
