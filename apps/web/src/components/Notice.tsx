import { ReactNode, useEffect, useId, useRef } from 'react';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" className="state state-loading">
      <span className="spinner" aria-hidden="true" /> {label}…
    </p>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="state state-error">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Modal popup (the "Popup → Message" element in the design). Traps nothing exotic: Esc closes, focus moves in. */
export function Popup({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="popup-backdrop">
      <div ref={ref} className="popup" role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
