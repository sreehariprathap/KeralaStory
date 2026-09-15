import { X } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

interface ModalShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ModalShell({ open, title, onClose, children, className = '' }: ModalShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const callbackPendingRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      callbackPendingRef.current = true;
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      callbackPendingRef.current = false;
      dialog.close();
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (!callbackPendingRef.current) return;
      callbackPendingRef.current = false;
      onClose();
      const previous = restoreFocusRef.current;
      restoreFocusRef.current = null;
      window.setTimeout(() => previous?.focus(), 0);
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  };

  return (
    <dialog ref={dialogRef} className={`ui-modal ${className}`.trim()} aria-labelledby={titleId}>
      <header className="ui-modal__header">
        <h2 id={titleId} className="ui-modal__title">{title}</h2>
        <button ref={closeButtonRef} type="button" className="icon-button" onClick={requestClose} aria-label={`Close ${title}`}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="ui-modal__body">{children}</div>
    </dialog>
  );
}

export type { ModalShellProps };
