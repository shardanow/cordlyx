import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchModal from '@/components/SearchModal';

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SearchModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when not open', () => {
    render(<SearchModal open={false} onClose={onClose} />);
    expect(screen.queryByPlaceholderText('Search items...')).not.toBeInTheDocument();
  });

  it('should render search input when open', () => {
    render(<SearchModal open={true} onClose={onClose} />);
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
  });

  it('should call onClose when backdrop clicked', () => {
    const { container } = render(<SearchModal open={true} onClose={onClose} />);
    fireEvent.pointerDown(container.firstChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
