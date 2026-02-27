import React, { useEffect } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export default function Toast({
  open,
  kind,
  message,
  onClose,
  durationMs = 2600
}: {
  open: boolean
  kind: ToastKind
  message: string
  onClose: () => void
  durationMs?: number
}) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => onClose(), durationMs)
    return () => clearTimeout(t)
  }, [open, durationMs, onClose])

  if (!open) return null

  const cls =
    kind === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : kind === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-gray-200 bg-white text-gray-800'

  return (
    <div className="fixed z-50 bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-md">
      <div className={`rounded-xl border px-4 py-3 shadow-lg flex items-start justify-between gap-3 ${cls}`}>
        <div className="text-sm font-medium">{message}</div>
        <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100 transition" type="button" title="Fermer">
          ×
        </button>
      </div>
    </div>
  )
}
