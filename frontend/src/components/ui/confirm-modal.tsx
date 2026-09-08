'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscToClose } from '@/hooks/use-esc-to-close';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared replacement for blocking window.confirm(). */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEscToClose(onClose, open);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onPointerDown={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-card border border-border rounded-lg shadow-xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 className="font-medium mb-2">{title}</h3>
        {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={cn(
              'px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50',
              danger
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface PromptModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** Shared replacement for blocking window.prompt(). */
export function PromptModal({
  open,
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'OK',
  onSubmit,
  onClose,
}: PromptModalProps) {
  useEscToClose(onClose, open);
  if (!open) return null;

  return createPortal(
    <PromptForm
      title={title}
      placeholder={placeholder}
      initialValue={initialValue}
      confirmLabel={confirmLabel}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
    document.body,
  );
}

function PromptForm({
  title,
  placeholder,
  initialValue,
  confirmLabel,
  onSubmit,
  onClose,
}: Omit<PromptModalProps, 'open'>) {
  const [value, setValue] = useState(initialValue ?? '');
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onPointerDown={onClose}
    >
      <form
        className="bg-card border border-border rounded-lg shadow-xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <h3 className="font-medium mb-3">{title}</h3>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mb-4 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
