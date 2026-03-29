import { LayoutGrid, List } from 'lucide-react'

interface ViewToggleProps {
  view: 'cards' | 'list'
  onChange: (view: 'cards' | 'list') => void
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-md border border-(--line)">
      <button
        onClick={() => onChange('cards')}
        className={`cursor-pointer p-2 ${
          view === 'cards'
            ? 'bg-(--lagoon-deep) text-white'
            : 'bg-(--surface-strong) text-(--sea-ink-soft) hover:bg-(--surface)'
        } rounded-l-md`}
        aria-label="Card view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`cursor-pointer p-2 ${
          view === 'list'
            ? 'bg-(--lagoon-deep) text-white'
            : 'bg-(--surface-strong) text-(--sea-ink-soft) hover:bg-(--surface)'
        } rounded-r-md`}
        aria-label="List view"
      >
        <List size={16} />
      </button>
    </div>
  )
}
