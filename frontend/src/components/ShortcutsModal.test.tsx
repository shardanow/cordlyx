import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShortcutsModal from '@/components/ShortcutsModal';

describe('ShortcutsModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('should render nothing when not open', () => {
    render(<ShortcutsModal open={false} onClose={onClose} />);
    expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument();
  });

  it('should render shortcuts when open', () => {
    render(<ShortcutsModal open={true} onClose={onClose} />);
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Quick create item')).toBeInTheDocument();
    expect(screen.getByText('Search items')).toBeInTheDocument();
    expect(screen.getByText('Show this help')).toBeInTheDocument();
    expect(screen.getByText('Close modals / Cancel')).toBeInTheDocument();
    expect(screen.getByText('Navigate search results')).toBeInTheDocument();
    expect(screen.getByText('Open selected item')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    render(<ShortcutsModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key pressed', () => {
    render(<ShortcutsModal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});