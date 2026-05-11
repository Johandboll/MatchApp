import React from "react";

export default function ConfirmDialog({
  open,
  title = "Bekräfta",
  message,
  confirmText = "OK",
  cancelText = "Avbryt",
  secondaryText,
  variant = "default",
  onConfirm,
  onCancel,
  onSecondary
}) {
  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45"
        onClick={onCancel}
        aria-label="Stäng dialog"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-wide text-sky-700">MatchApp</div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">{title}</h2>
          {message && <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          {secondaryText && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {secondaryText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
