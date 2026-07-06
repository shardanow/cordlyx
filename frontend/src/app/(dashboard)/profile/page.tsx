'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { api, getAccessToken } from '@/lib/api-client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  projectId: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

function avatarSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/uploads/') ? `http://localhost:4000${url}` : url;
}

export default function ProfilePage() {
  const { user, loadUser, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Delete account state
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // API Keys state
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user]);

  const { data: apiKeys, refetch: refetchKeys } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiKey[]>('/api-keys'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.patch('/users/me', {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      await loadUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordChanged(false);
    setPasswordError('');
    try {
      await api.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordChanged(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'delete me') return;
    setDeleting(true);
    try {
      await api.delete('/users/me');
      logout();
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const result = await api.post<ApiKey & { key: string }>('/api-keys', { name: newKeyName.trim() });
      setCreatedKey(result.key);
      setNewKeyName('');
      refetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    await api.delete(`/api-keys/${id}`);
    refetchKeys();
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="max-w-lg space-y-12">
      {/* Profile Section */}
      <div>
        <h1 className="text-2xl font-bold mb-6">Profile</h1>

        <div className="mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold overflow-hidden">
            {(avatarUrl || user.avatarUrl) ? (
              <img src={avatarSrc(avatarUrl || user.avatarUrl) ?? ''} alt="" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              user.name.charAt(0)
            )}
          </div>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Avatar</label>
            <div className="flex items-center gap-3">
              {uploadingAvatar ? (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center text-sm font-medium">
                  {(avatarUrl || user?.avatarUrl) ? (
                    <img src={avatarSrc(avatarUrl || user!.avatarUrl) ?? ''} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    user?.name.charAt(0).toUpperCase()
                  )}
                </div>
              )}
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                Upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingAvatar(true);
                    try {
                      const form = new FormData();
                      form.append('avatar', file);
                      const token = getAccessToken();
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/users/me/avatar`, {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: form,
                      });
                      if (!res.ok) throw new Error('Upload failed');
                      const data = await res.json();
                      setAvatarUrl(data.avatarUrl);
                      await loadUser();
                    } catch { setError('Avatar upload failed'); }
                    finally { setUploadingAvatar(false); }
                  }}
                />
              </label>
              <span className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP · max 5 MB</span>
            </div>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}
          {saved && <div className="text-sm text-green-600">Profile updated.</div>}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      {/* Change Password Section */}
      <div>
        <h2 className="text-lg font-bold mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New password (min 8 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          {passwordError && <div className="text-sm text-red-500">{passwordError}</div>}
          {passwordChanged && <div className="text-sm text-green-600">Password changed.</div>}
          <button
            type="submit"
            disabled={changingPassword || !currentPassword || newPassword.length < 8}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Delete Account Section */}
      <div>
        <h2 className="text-lg font-bold mb-4 text-destructive">Delete Account</h2>
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account and all your data. This action cannot be undone.
          </p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Type <span className="font-mono text-foreground">delete me</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete me"
              className={inputClass}
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting || confirmText !== 'delete me'}
            className="bg-destructive text-destructive-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete my account'}
          </button>
        </div>
      </div>

      {/* API Keys Section */}
      <div>
        <h2 className="text-lg font-bold mb-1">API Keys</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use API keys to authenticate requests from scripts and CI/CD pipelines using the{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">X-API-Key</code> header.
        </p>

        {createdKey && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">
              Copy this key now — it will never be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background border border-border rounded px-2 py-1.5 flex-1 truncate font-mono">
                {createdKey}
              </code>
              <button
                onClick={handleCopy}
                className="text-xs px-2 py-1.5 rounded border border-border hover:bg-muted shrink-0"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {apiKeys && apiKeys.length > 0 && (
          <div className="mb-4 border border-border rounded divide-y divide-border">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{key.keyPrefix}...</code>
                    {key.lastUsedAt ? ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                    {key.expiresAt ? ` · Expires ${new Date(key.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCreateKey} className="flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. CI/CD, Script)"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!newKeyName.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50 shrink-0"
          >
            Generate
          </button>
        </form>
      </div>
    </div>
  );
}
