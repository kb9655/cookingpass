import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../../i18n/locale";

type ConfirmDialogProps = {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
  busy?: boolean;
};

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  busy = false,
}: ConfirmDialogProps) {
  const { t } = useLocale();

  return createPortal(
    <div className="dialog-overlay">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("techniquesConfirm")}
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 max-h-[min(85dvh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-line bg-card p-5 shadow-lg"
      >
        <p id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </p>
        {children ? <div className="mt-3 text-sm text-muted">{children}</div> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
          >
            {confirmLabel ?? t("techniquesConfirm")}
          </button>
          {cancelLabel || onConfirm ? (
            <button type="button" className="btn-secondary w-full" disabled={busy} onClick={onClose}>
              {cancelLabel ?? t("techniquesCancel")}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
