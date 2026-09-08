import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationPrefs from '@/components/NotificationPrefs';
import { api } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const mockedApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPrefs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockedApi.get.mockImplementation((path: string) => {
    if (path === '/projects') return Promise.resolve([{ id: 'p1', name: 'Demo', slug: 'demo' }]);
    if (path === '/notifications/prefs') {
      return Promise.resolve([
        { projectId: 'p1', projectSlug: 'demo', projectName: 'Demo', muted: false, emailDigest: true, digestHour: 8 },
      ]);
    }
    return Promise.resolve([]);
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationPrefs />
    </QueryClientProvider>,
  );
}

describe('NotificationPrefs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders projects with prefs and toggles mute', async () => {
    renderPrefs();
    await waitFor(() => expect(screen.getByText('Demo')).toBeInTheDocument());
    const mute = screen.getByLabelText('Mute') as HTMLInputElement;
    expect(mute.checked).toBe(false);
    fireEvent.click(mute);
    await waitFor(() =>
      expect(mockedApi.put).toHaveBeenCalledWith('/notifications/prefs/demo', { muted: true }),
    );
  });

  it('changes digest hour and sends a digest', async () => {
    mockedApi.post.mockResolvedValue({ sent: true });
    renderPrefs();
    await waitFor(() => expect(screen.getByText('Demo')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('08:00 UTC'), { target: { value: '18' } });
    await waitFor(() =>
      expect(mockedApi.put).toHaveBeenCalledWith('/notifications/prefs/demo', { digestHour: 18 }),
    );
    fireEvent.click(screen.getByText('Send digest now'));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/notifications/digest/send'));
  });
});
