import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmModal, PromptModal } from '@/components/ui/confirm-modal';

vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmModal open={false} title="Delete?" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  it('confirms and cancels', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal
        open
        title="Delete?"
        message="Gone forever"
        confirmLabel="Delete it"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Delete it'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop pointer down', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmModal open title="X" onConfirm={() => {}} onClose={onClose} />,
    );
    fireEvent.pointerDown(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PromptModal', () => {
  it('submits trimmed value and cancels', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <PromptModal open title="Link URL" initialValue="https://x.test" onSubmit={onSubmit} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledWith('https://x.test');
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requires non-empty value', () => {
    const onSubmit = vi.fn();
    render(
      <PromptModal open title="T" initialValue="   " onSubmit={onSubmit} onClose={() => {}} />,
    );
    expect(screen.getByText('OK').closest('button')).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
