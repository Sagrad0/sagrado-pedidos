import type { ReactNode } from 'react'

export type ToastVariant = 'success' | 'error'

export interface ToastProps {
  visible: boolean
  message: string
  variant?: ToastVariant
  onClose?: () => void
  actionLabel?: string
  onActionClick?: () => void
}

export function Toast({ visible, message, variant = 'error', onClose, actionLabel, onActionClick }: ToastProps) {
  if (!visible || !message) return null

  const base =
    variant === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-red-600 text-white'

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:inset-auto md:right-4 md:top-4 md:justify-end">
      <div className={`${base} shadow-lg rounded-2xl px-4 py-3 flex items-center gap-3 max-w-md w-full`}>
        <div className="flex-1 text-sm">{message}</div>
        {actionLabel && onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="text-xs font-semibold underline underline-offset-2"
          >
            {actionLabel}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold opacity-80 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

