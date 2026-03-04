interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onActionClick?: () => void
}

export function EmptyState({ title, description, actionLabel, onActionClick }: EmptyStateProps) {
  return (
    <div className="card">
      <div className="card-body text-center space-y-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400 text-lg">
          !
        </div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {description && <div className="text-xs text-slate-500">{description}</div>}
        {actionLabel && onActionClick && (
          <div className="pt-1">
            <button type="button" onClick={onActionClick} className="btn btn-primary btn-sm">
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

