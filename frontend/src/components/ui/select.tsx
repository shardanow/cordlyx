'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select components must be used within <Select>');
  return ctx;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  autoOpen?: boolean;
  onClose?: () => void;
}

function Select({ value, onChange, children, className, autoOpen, onClose }: SelectProps) {
  const [open, setOpen] = React.useState(autoOpen ?? false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      const isOutsideContent = contentRef.current && !contentRef.current.contains(target);
      if (isOutsideWrapper && isOutsideContent) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    } else if (!open && onClose) {
      const timer = setTimeout(() => onClose(), 0);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  return (
    <SelectContext.Provider value={{ value, onChange, open, setOpen, triggerRef, contentRef }}>
      <div ref={wrapperRef} className={cn('relative', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className, style, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useSelectContext();
    const combinedRef = React.useCallback((el: HTMLButtonElement | null) => {
      triggerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    }, [ref, triggerRef]);
    return (
      <button
        ref={combinedRef}
        type="button"
        style={style}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className={cn(
          'h-9 inline-flex items-center gap-2 px-3 rounded-lg text-sm bg-muted/50 border border-border text-foreground cursor-pointer whitespace-nowrap transition-colors hover:bg-muted',
          open && 'ring-1 ring-ring',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-auto" />
      </button>
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

function SelectContent({ children, className }: SelectContentProps) {
  const { open, triggerRef, contentRef } = useSelectContext();
  const [style, setStyle] = React.useState<React.CSSProperties | undefined>(undefined);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });

    function updatePosition() {
      if (!contentRef.current || !triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      contentRef.current.style.top = `${r.bottom + 4}px`;
      contentRef.current.style.left = `${r.left}px`;
    }

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, triggerRef, contentRef]);

  if (!open) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <div
        ref={contentRef}
        style={{ position: 'absolute', ...style }}
        className={cn(
          'pointer-events-auto z-50 bg-card border border-border rounded-lg shadow-lg overflow-auto py-1 max-w-[280px]',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface SelectOptionProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function SelectOption({ value, children, className }: SelectOptionProps) {
  const { value: selectedValue, onChange, setOpen } = useSelectContext();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(value); setOpen(false); }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

export { Select, SelectTrigger, SelectContent, SelectOption };
