interface SkeletonProps {
  lines?: number
  className?: string
}

export function Skeleton({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-3 w-full rounded-full bg-slate-200 animate-pulse"
        />
      ))}
    </div>
  )
}

