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
import { useState } from 'react'
import type { Event } from '#/lib/types'
import { isAllDay } from '#/lib/date-utils'

const col = createColumnHelper<Event>()

const columns = [
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
  }),
  col.accessor('Category', {
    header: () => <span className="whitespace-nowrap">Category</span>,
    cell: (info) => info.getValue() ?? '\u2014',
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
  }),
  col.accessor('VenueName', {
    header: 'Venue',
    cell: (info) => {
      const venue = info.getValue()
      const venueId = info.row.original.VenueID
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
    meta: { cellClassName: 'min-w-[8rem]' },
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

export function EventTable({ events }: { events: Event[] }) {
  const [sorting, setSorting] = useState<SortingState>([])

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
                const hideOnMobile = (header.column.columnDef.meta as { hideOnMobile?: boolean })?.hideOnMobile
                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`cursor-pointer px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--sea-ink-soft)] select-none sm:px-4 sm:py-3${hideOnMobile ? ' hidden sm:table-cell' : ''} ${(header.column.columnDef.meta as any)?.cellClassName ?? ''}`}
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
              <tr key={row.id} className="hover:bg-[var(--surface)]">
                {row.getVisibleCells().map((cell) => {
                  const hideOnMobile = (cell.column.columnDef.meta as { hideOnMobile?: boolean })?.hideOnMobile
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 text-sm text-[var(--sea-ink-soft)] sm:px-4 sm:py-3${hideOnMobile ? ' hidden sm:table-cell' : ''} ${(cell.column.columnDef.meta as any)?.cellClassName ?? ''}`}
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
