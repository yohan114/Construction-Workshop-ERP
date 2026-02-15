'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'default';
      case 'MANAGER':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold md:text-xl">{title || 'Dashboard'}</h1>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Search - hidden on mobile */}
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-8 h-9"
          />
        </div>
        
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* Role badge */}
        {user?.role && (
          <Badge variant={getRoleBadgeVariant(user.role)} className="hidden sm:flex">
            {user.role}
          </Badge>
        )}
      </div>
    </header>
  );
}
