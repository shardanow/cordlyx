import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickCreateModal from '@/components/QuickCreateModal';

vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: [] }),
  useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectOption: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/RichEditor', () => ({
  default: () => <div />,
}));

describe('QuickCreateModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when not open', () => {
    render(<QuickCreateModal open={false} onClose={onClose} />);
    expect(screen.queryByText('Quick create')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<QuickCreateModal open={true} onClose={onClose} />);
    expect(screen.getByText('Quick create')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button clicked', () => {
    render(<QuickCreateModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose on Escape key', () => {
    render(<QuickCreateModal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
