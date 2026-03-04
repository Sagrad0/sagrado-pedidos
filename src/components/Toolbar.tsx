import type { ReactNode } from 'react'

interface ToolbarProps {
  title?: string
  subtitle?: string
  metaText?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchSubmit?: () => void
  children?: ReactNode
}

export function Toolbar({
  title,
  subtitle,
  metaText,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  children,
}: ToolbarProps) {
  return (
    <div className="card mb-4">
      <div className="card-body space-y-3">
        {(title || subtitle || metaText) && (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {title && <div className="font-semibold text-slate-900">{title}</div>}
              {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
            </div>
            {metaText && <div className="text-xs text-slate-500 mono">{metaText}</div>}
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {onSearchChange && (
            <div className="w-full md:max-w-md flex gap-2">
              <input
                className="form-input flex-1"
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {onSearchSubmit && (
                <button
                  type="button"
                  onClick={onSearchSubmit}
                  className="btn btn-secondary hidden xs:inline-flex"
                >
                  Buscar
                </button>
              )}
            </div>
          )}

          {children && <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">{children}</div>}
        </div>
      </div>
    </div>
  )
}

