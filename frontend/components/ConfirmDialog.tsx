import React, { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border bg-white shadow-2xl p-5">
        <div className="text-lg font-extrabold text-gray-900">{title}</div>
        <div className="mt-2 text-sm text-gray-600">{message}</div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 transition active:scale-[0.99] text-gray-800 border-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
