function getPageNumbers(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | '...')[] = [1]
  if (page > 3) pages.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
    pages.push(i)
  }
  if (page < totalPages - 2) pages.push('...')
  pages.push(totalPages)
  return pages
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  const btnBase =
    'min-w-[2.25rem] rounded-md border border-[var(--line)] px-2 py-1.5 text-sm font-medium transition-colors'
  const btnIdle =
    'bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] cursor-pointer'
  const btnActive =
    'bg-[var(--lagoon-deep)] text-white border-[var(--lagoon-deep)] cursor-default'
  const btnDisabled = 'opacity-40 cursor-not-allowed bg-[var(--surface-strong)] text-[var(--sea-ink-soft)]'

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${btnBase} ${page <= 1 ? btnDisabled : btnIdle}`}
        aria-label="Previous page"
      >
        ‹
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-[var(--sea-ink-soft)]">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btnBase} ${page >= totalPages ? btnDisabled : btnIdle}`}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  )
}
