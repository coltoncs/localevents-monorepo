import { Link } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type FilterFn,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import type { Event } from '#/lib/types'
import { isAllDay } from '#/lib/date-utils'

const col = createColumnHelper<Event>()

// Compact mobile row: image thumbnail + title/date/venue stacked
function MobileEventCell({ event, venueNameToId }: { event: Event; venueNameToId: Map<string, string> }) {
  const d = new Date(event.StartTime)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = isAllDay(event)
    ? 'All Day'
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const venue = event.VenueName
  const venueId = event.VenueID ?? (venue ? venueNameToId.get(venue.toLowerCase()) : undefined)

  return (
    <div className="flex items-center gap-3">
      {event.ImageUrl ? (
        <img
          src={event.ImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-12 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded bg-[var(--surface)]" />
      )}
      <div className="min-w-0">
        <Link
          to="/events/$eventId"
          params={{ eventId: event.ID }}
          className="block truncate font-medium text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
        >
          {event.Title}
        </Link>
        <p className="truncate text-xs text-[var(--sea-ink-soft)]">
          {date}, {time}
          {venue && (
            <>
              {' · '}
              {venueId ? (
                <Link
                  to="/venues/$venueId"
                  params={{ venueId }}
                  className="text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
                >
                  {venue}
                </Link>
              ) : venue}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function buildColumns(venueNameToId: Map<string, string>) {
  return [
  // Mobile-only compact column
  col.display({
    id: 'mobile',
    header: '',
    cell: (info) => <MobileEventCell event={info.row.original} venueNameToId={venueNameToId} />,
    enableSorting: false,
    meta: { mobileOnly: true },
  }),
  col.accessor('ImageUrl', {
    header: '',
    cell: (info) => {
      const url = info.getValue()
      if (!url) return null
      return (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-10 w-14 rounded object-cover"
        />
      )
    },
    enableSorting: false,
    meta: { hideOnMobile: true },
  }),
  col.accessor('Title', {
    header: 'Title',
    cell: (info) => (
      <Link
        to="/events/$eventId"
        params={{ eventId: info.row.original.ID }}
        className="font-medium text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
      >
        {info.getValue()}
      </Link>
    ),
    meta: { hideOnMobile: true },
  }),
  col.accessor('Categories', {
    header: () => <span className="whitespace-nowrap">Category</span>,
    cell: (info) => {
      const cats = info.getValue()
      if (!cats || cats.length === 0) return '\u2014'
      return cats[0] + (cats.length > 1 ? ` +${cats.length - 1}` : '')
    },
    meta: { hideOnMobile: true },
  }),
  col.accessor('StartTime', {
    header: 'Date',
    cell: (info) => {
      const event = info.row.original
      const d = new Date(info.getValue())
      const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (isAllDay(event)) {
        return <span className="whitespace-nowrap">{date}, All Day</span>
      }
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return (
        <span className="whitespace-nowrap">
          {date}, {time}
        </span>
      )
    },
    meta: { hideOnMobile: true },
  }),
  col.accessor('VenueName', {
    header: 'Venue',
    cell: (info) => {
      const venue = info.getValue()
      const venueId = info.row.original.VenueID ?? (venue ? venueNameToId.get(venue.toLowerCase()) : undefined)
      if (!venue) return '\u2014'
      if (venueId) {
        return (
          <Link
            to="/venues/$venueId"
            params={{ venueId }}
            className="text-[var(--lagoon-deep)] hover:text-[var(--lagoon)] hover:underline"
          >
            {venue}
          </Link>
        )
      }
      return venue
    },
    meta: { hideOnMobile: true, cellClassName: 'min-w-[8rem]' },
  }),
  col.accessor('City', {
    header: 'City',
    cell: (info) => {
      const city = info.getValue()
      const state = info.row.original.State
      if (!city) return '\u2014'
      return (
        <span className="whitespace-nowrap">
          {city}{state ? `, ${state}` : ''}
        </span>
      )
    },
    meta: { hideOnMobile: true },
  }),
  ]
}

export function EventTable({ events }: { events: Event[] }) {
  const [sorting, setSorting] = useState<SortingState>([])

  const venueNameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) {
      if (event.VenueID && event.VenueName) {
        map.set(event.VenueName.toLowerCase(), event.VenueID)
      }
    }
    return map
  }, [events])

  const columns = useMemo(() => buildColumns(venueNameToId), [venueNameToId])

  const table = useReactTable({
    data: events,
    columns,
    filterFns: {
      fuzzy: ((row, columnId, value) =>
        String(row.getValue(columnId)).toLowerCase().includes(String(value).toLowerCase())) as FilterFn<Event>,
    },
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]">
      <table className="min-w-full divide-y divide-[var(--line)]">
        <thead className="bg-[var(--surface)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta as { hideOnMobile?: boolean; mobileOnly?: boolean; cellClassName?: string } | undefined
                const visClass = meta?.mobileOnly ? ' sm:hidden' : meta?.hideOnMobile ? ' hidden sm:table-cell' : ''
                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`cursor-pointer px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--sea-ink-soft)] select-none sm:px-4 sm:py-3${visClass} ${meta?.cellClassName ?? ''}`}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{ asc: ' \u2191', desc: ' \u2193' }[
                      header.column.getIsSorted() as string
                    ] ?? ''}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-sm text-[var(--sea-ink-soft)] sm:px-4"
              >
                No events found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.original.IsFeatured
                    ? "bg-amber-400/10 hover:bg-amber-400/20"
                    : "hover:bg-[var(--sea-ink)]/[0.06]"
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { hideOnMobile?: boolean; mobileOnly?: boolean; cellClassName?: string } | undefined
                  const visClass = meta?.mobileOnly ? ' sm:hidden' : meta?.hideOnMobile ? ' hidden sm:table-cell' : ''
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 text-sm text-[var(--sea-ink-soft)] sm:px-4 sm:py-3${visClass} ${meta?.cellClassName ?? ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
