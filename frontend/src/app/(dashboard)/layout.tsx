'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import QuickCreateModal from '@/components/QuickCreateModal';
import SearchModal from '@/components/SearchModal';
import ShortcutsModal from '@/components/ShortcutsModal';
import NotificationsButton from '@/components/NotificationsButton';
import { useTheme } from 'next-themes';
import {
  FolderOpen, Search, Keyboard, Sun, Moon,
  LogOut, Plus, ChevronLeft, Menu, X,
  LayoutList, Columns3, Activity, Users, Settings, Target, Map, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NextTopLoader from 'nextjs-toploader';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  badge?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadUser, logout, user } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const projectSlug = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const itemSeq = pathname.match(/\/items\/(\d+)/)?.[1];

  const { data: currentItem } = useQuery<{ id: string; sequenceNum: number; title: string }>({
    queryKey: ['item', projectSlug, itemSeq],
    queryFn: () => api.get(`/projects/${projectSlug}/items/${itemSeq}`),
    enabled: !!projectSlug && !!itemSeq,
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ['admin', 'check'],
    queryFn: () => api.get('/admin/check'),
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const isAdmin = adminCheck?.isAdmin ?? false;

  useEffect(() => {
    loadUser();
    setMounted(true);
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) setSidebarOpen(saved === 'true');
  }, [loadUser]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
      e.preventDefault();
      setQuickCreateOpen(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === '/') {
      const tag = e.target as HTMLElement;
      if (tag.tagName !== 'INPUT' && tag.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    if (e.key === '?') {
      const tag = e.target as HTMLElement;
      if (tag.tagName !== 'INPUT' && tag.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }
    if (e.key === 'Escape') {
      setQuickCreateOpen(false);
      setSearchOpen(false);
      setShortcutsOpen(false);
      setMobileSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const mainNav: NavItem[] = [
    { href: '/projects', label: 'Projects', icon: FolderOpen },
    ...(projectSlug ? [
      { href: `/projects/${projectSlug}`, label: 'Items List', icon: LayoutList },
      { href: `/projects/${projectSlug}/board`, label: 'Board', icon: Columns3 },
      { href: `/projects/${projectSlug}/plans`, label: 'Plans', icon: Target },
      { href: `/projects/${projectSlug}/roadmaps`, label: 'Roadmaps', icon: Map },
      { href: `/projects/${projectSlug}/activity`, label: 'Activity', icon: Activity },
    ] : []),
  ];

  const bottomNav: NavItem[] = projectSlug
    ? [
      { href: `/projects/${projectSlug}/members`, label: 'Members', icon: Users },
      { href: `/projects/${projectSlug}/settings`, label: 'Settings', icon: Settings },
    ]
    : [];

  const isActive = (href: string) => {
    if (href === '/projects') return pathname === '/projects';
    return pathname === href;
  };

  const navLinkClass = (href: string) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
    !sidebarOpen && 'justify-center px-2',
    isActive(href)
      ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  const sidebarContent = (
    <>
      {/* Brand + toggle */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border min-h-[53px]">
        <div className={cn('flex items-center gap-2', !sidebarOpen && 'mx-auto')}>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-bold">C</span>
          </div>
          <span className={cn('font-semibold text-sm tracking-tight', !sidebarOpen && 'hidden')}>CordLyx</span>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={cn('text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors', (!sidebarOpen || !mounted) && 'hidden')}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors md:hidden"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsed expand (desktop only) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden md:flex items-center justify-center py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* MAIN section — top */}
      {mainNav.length > 0 && (
        <>
          <div className={cn('px-4 pt-4 pb-1', !sidebarOpen && 'sr-only')}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Main</span>
          </div>
          <nav className="px-3 pb-1 space-y-0.5">
            {mainNav.map(({ href, label, icon: Icon }) => {
              const isItemsList = projectSlug && href === `/projects/${projectSlug}`;
              return (
                <div key={href}>
                  <Link
                    href={href}
                    title={!sidebarOpen ? label : undefined}
                    className={navLinkClass(href)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={cn(!sidebarOpen && 'hidden')}>{label}</span>
                  </Link>
                  {/* Item sub-item under Items List */}
                  {isItemsList && itemSeq && (
                    <Link
                      href={pathname}
                      className={cn(
                        'flex items-center gap-3 pl-10 pr-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                        !sidebarOpen && 'sr-only',
                        'bg-gradient-to-r from-primary/20 to-primary/5 text-foreground',
                      )}
                    >
                      <span className="text-muted-foreground">└</span>
                      <span className="truncate">{currentItem?.title ?? `#${itemSeq}`}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </>
      )}

      {/* Spacer — pushes everything below to bottom */}
      <div className="flex-1 min-h-4" />

      {/* WORKSPACE section — pinned to bottom */}
      <div className={cn('px-4 pb-1', !sidebarOpen && 'sr-only')}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Workspace</span>
      </div>
      <div className="px-3 pb-1 space-y-0.5">
        <button
          onClick={() => setQuickCreateOpen(true)}
          title={!sidebarOpen ? 'Quick create' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
            !sidebarOpen && 'justify-center px-2',
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className={cn('flex-1 text-left', !sidebarOpen && 'hidden')}>Quick create</span>
          <kbd className={cn('text-[10px] opacity-70 font-mono', !sidebarOpen && 'hidden')}>⌘K</kbd>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          title={!sidebarOpen ? 'Search' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            !sidebarOpen && 'justify-center px-2',
          )}
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className={cn('flex-1 text-left', !sidebarOpen && 'hidden')}>Search</span>
          <kbd className={cn('text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono', !sidebarOpen && 'hidden')}>/</kbd>
        </button>

        <NotificationsButton collapsed={!sidebarOpen} />

        <button
          onClick={() => setShortcutsOpen(true)}
          title={!sidebarOpen ? 'Shortcuts' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            !sidebarOpen && 'justify-center px-2',
          )}
        >
          <Keyboard className="w-4 h-4 shrink-0" />
          <span className={cn('flex-1 text-left', !sidebarOpen && 'hidden')}>Shortcuts</span>
          <kbd className={cn('text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono', !sidebarOpen && 'hidden')}>?</kbd>
        </button>

        {isAdmin && (
          <Link
            href="/admin"
            title={!sidebarOpen ? 'Admin' : undefined}
            className={navLinkClass('/admin')}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span className={cn(!sidebarOpen && 'hidden')}>Admin</span>
          </Link>
        )}
      </div>

      {/* Bottom nav: Members, Settings */}
      {bottomNav.length > 0 && (
        <>
          <div className="border-t border-border mx-3 my-1" />
          <div className="px-3 pt-2 pb-1 space-y-0.5">
          {bottomNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={!sidebarOpen ? label : undefined}
              className={navLinkClass(href)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={cn(!sidebarOpen && 'hidden')}>{label}</span>
            </Link>
          ))}
        </div>
        </>
      )}

      {/* Theme toggle */}
      <div className="border-t border-border">
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title={!sidebarOpen ? (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              !sidebarOpen && 'justify-center px-2',
            )}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            <span className={cn(!sidebarOpen && 'hidden')}>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        )}
      </div>

      {/* User block */}
      {user && (
        <div className={cn(
          'flex items-center gap-2.5 px-3 py-2 border-t border-border',
          !sidebarOpen && 'justify-center px-2',
        )}>
          <Link
            href="/profile"
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className={cn('flex-1 min-w-0', !sidebarOpen && 'hidden')}>
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </Link>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            title="Sign out"
            className={cn('text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted transition-colors shrink-0', !sidebarOpen && 'hidden')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onPointerDown={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border flex flex-col transition-transform duration-200 md:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen sticky top-0 shrink-0 bg-sidebar border-r border-border transition-all duration-200 z-30',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile top bar (hamburger) */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-background border-b border-border flex items-center px-4 z-20 md:hidden">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="text-muted-foreground hover:text-foreground p-1 -ml-1 rounded hover:bg-muted transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-[10px] font-bold">C</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">CordLyx</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto relative z-0">
        <NextTopLoader color="hsl(var(--primary))" height={3} showSpinner={false} />
        <div className="pt-14 md:pt-0 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <QuickCreateModal open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} sidebarOpen={sidebarOpen} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
