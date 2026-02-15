'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Package,
  Box,
  Warehouse,
  Users,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ChevronRight,
  Building2,
  Shield,
  Wrench,
  Smartphone,
  ClipboardList,
  ClipboardCheck,
  Fuel,
  Bell,
  CalendarDays,
  Activity,
  BarChart3,
  Truck,
  Lock,
  Server,
} from 'lucide-react';

interface SidebarNavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  children?: SidebarNavItem[];
}

const sidebarNavItems: SidebarNavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: 'Executive',
    href: '/executive',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Jobs',
    href: '/jobs',
    icon: <Wrench className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'PM Calendar',
    href: '/pm',
    icon: <CalendarDays className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Availability',
    href: '/availability',
    icon: <Activity className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Approvals',
    href: '/approvals',
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Assets',
    href: '/assets',
    icon: <Package className="h-5 w-5" />,
  },
  {
    title: 'Items',
    href: '/items',
    icon: <Box className="h-5 w-5" />,
  },
  {
    title: 'Stores',
    href: '/stores',
    icon: <Warehouse className="h-5 w-5" />,
  },
  {
    title: 'Storekeeper',
    href: '/storekeeper',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'STOREKEEPER'],
  },
  {
    title: 'Fuel',
    href: '/fuel',
    icon: <Fuel className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'STOREKEEPER', 'OPERATOR'],
  },
  {
    title: 'External Repairs',
    href: '/external-repairs',
    icon: <Truck className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Alerts',
    href: '/alerts',
    icon: <Bell className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
  },
  {
    title: 'Mobile App',
    href: '/mobile',
    icon: <Smartphone className="h-5 w-5" />,
    roles: ['TECHNICIAN', 'STOREKEEPER'],
  },
  {
    title: 'Companies',
    href: '/companies',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['ADMIN'],
  },
  {
    title: 'Users',
    href: '/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['ADMIN'],
  },
  {
    title: 'System Status',
    href: '/system',
    icon: <Server className="h-5 w-5" />,
    roles: ['ADMIN'],
  },
];

interface SidebarProps {
  className?: string;
}

function SidebarContent({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, item]
    );
  };

  const filteredItems = sidebarNavItems.filter((item) => {
    if (!item.roles) return true;
    return hasRole(item.roles);
  });

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">ERP System</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.title);

            if (hasChildren) {
              return (
                <div key={item.title}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3',
                      isActive && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => toggleExpanded(item.title)}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.title}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  {isExpanded && item.children && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'w-full justify-start gap-3',
                              pathname === child.href && 'bg-accent text-accent-foreground'
                            )}
                          >
                            {child.icon}
                            {child.title}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  {item.icon}
                  {item.title}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Separator className="my-3" />
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-3 left-3 z-40"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-background">
        <SidebarContent className="w-full" />
      </aside>
    </>
  );
}
