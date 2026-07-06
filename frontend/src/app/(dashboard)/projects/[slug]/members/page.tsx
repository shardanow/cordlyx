'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import Spinner from '@/components/Spinner';
import { Link as LinkIcon, Check, Copy } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export default function MembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const { data: project } = useQuery<{ id: string; name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });
  const currentUser = useAuthStore((s) => s.user);
  const [showAdd, setShowAdd] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newRole, setNewRole] = useState<'member' | 'viewer'>('member');
  const [adding, setAdding] = useState(false);
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    api.get<SearchUser[]>(`/users/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => {
        setSearchResults(data ?? []);
        setShowDropdown(true);
      })
      .catch(() => { setSearchResults([]); })
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ['members', slug],
    queryFn: () => api.get(`/projects/${slug}/members`),
  });

  const currentMember = members?.find((m) => m.userId === currentUser?.id);
  const isAdmin = currentMember?.role === 'admin';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setAdding(true);
    try {
      await api.post(`/projects/${slug}/members`, { userId: selectedUser.id, role: newRole });
      setSearchQuery('');
      setSelectedUser(null);
      setSearchResults([]);
      setShowDropdown(false);
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['members', slug] });
      toast.success('Member added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setSearchQuery(user.name);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    setLoadingMemberId(memberId);
    try {
      await api.patch(`/projects/${slug}/members/${memberId}`, { role });
      queryClient.invalidateQueries({ queryKey: ['members', slug] });
      toast.success('Role updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoadingMemberId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setLoadingMemberId(memberId);
    try {
      await api.delete(`/projects/${slug}/members/${memberId}`);
      queryClient.invalidateQueries({ queryKey: ['members', slug] });
      toast.success('Member removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoadingMemberId(null);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Members</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm font-medium"
          >
            Add member
          </button>
        )}
      </div>

      {showAdd && isAdmin && (
        <form onSubmit={handleAdd} className="mb-6 p-4 border border-border rounded space-y-3">
          <div ref={searchRef} className="relative">
            <input
              placeholder="Search by name or email..."
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedUser(null); }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm bg-background hover:bg-muted transition text-left border-b border-border last:border-b-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{user.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && !searching && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground text-center">
                No users found
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'member' | 'viewer')}
              className="border border-input rounded px-2 py-1.5 text-sm"
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" disabled={adding || !selectedUser} className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm disabled:opacity-50">
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Invite link */}
      {isAdmin && (
        <div className="mb-6 p-4 border border-border rounded space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Invite link</h3>
            <button
              onClick={async () => {
                setGeneratingInvite(true);
                try {
                  const res = await api.post<{ token: string }>(`/projects/${slug}/invites`);
                  const link = `${window.location.origin}/invite/${res.token}`;
                  setInviteLink(link);
                } catch (err) {
                  toast.error('Failed to generate invite link');
                } finally {
                  setGeneratingInvite(false);
                }
              }}
              disabled={generatingInvite}
              className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded font-medium disabled:opacity-50"
            >
              {generatingInvite ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs font-mono shadow-sm"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="h-9 px-3 rounded-md border border-border text-xs hover:bg-muted transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border border-border rounded divide-y divide-border">
        {(members ?? []).map((member) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
              {member.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{member.name}</div>
              <div className="text-xs text-muted-foreground truncate">{member.email}</div>
            </div>

            {isAdmin && member.userId !== currentUser?.id ? (
              <div className="flex items-center gap-1">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  disabled={loadingMemberId === member.id}
                  className="text-xs border border-input rounded px-2 py-1 disabled:opacity-50"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                {loadingMemberId === member.id && <Spinner size="sm" />}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
            )}

            {isAdmin && member.userId !== currentUser?.id && (
              <button
                onClick={() => handleRemove(member.id)}
                disabled={loadingMemberId === member.id}
                className="text-xs text-red-500 hover:text-red-700 shrink-0 disabled:opacity-50"
              >
                {loadingMemberId === member.id ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
