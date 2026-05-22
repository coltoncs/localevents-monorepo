import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { EventMap } from '#/components/maps/EventMap'
import { useEvents } from '#/lib/hooks/useEvents'
import { useUserRole } from '#/lib/hooks/useUserRole'
import { isAllDay } from '#/lib/date-utils'
import type { Event } from '#/lib/types'
import { CATEGORIES } from '../events/EventFilters'
import ClerkHeader from '#/integrations/clerk/header-user'
import ThemeToggle from '#/components/ThemeToggle'

type SheetSnap = 'peek' | 'half' | 'full'

interface FullscreenMapProps {
  lat: number
  lng: number
  radius?: number
  date?: string
  category?: string
}

export function FullscreenMap({
  lat,
  lng,
  radius,
  date,
  category,
}: FullscreenMapProps) {
  const navigate = useNavigate()
  const [settingOrigin, setSettingOrigin] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const mapInstanceRef = useRef<MapboxMap | null>(null)

  const filters = { lat, lng, radius, date, category }
  const shouldFetch = !!date
  const { data, isLoading } = useEvents(filters, shouldFetch)
  const events = shouldFetch ? (data?.events ?? []) : []

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const canvas = mapInstanceRef.current?.getCanvas()
    if (!canvas) return
    canvas.style.cursor = settingOrigin ? 'crosshair' : ''
    return () => {
      canvas.style.cursor = ''
    }
  }, [settingOrigin])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      map.resize()
      if (t - start < 260) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sidebarCollapsed])

  useEffect(() => {
    setSelectedEventId(null)
  }, [date, category, lat, lng])

  function handleMapClick(lngLat: { lng: number; lat: number }) {
    if (!settingOrigin) return
    setSettingOrigin(false)
    updateSearch({
      lat: String(Math.round(lngLat.lat * 1_000_000) / 1_000_000),
      lng: String(Math.round(lngLat.lng * 1_000_000) / 1_000_000),
    })
  }

  function updateSearch(updates: Record<string, string | undefined>) {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, lat, lng, view: undefined, ...updates }),
      replace: true,
    })
  }

  function handleShowList() {
    navigate({
      to: '/events',
      search: (prev) => ({
        ...prev,
        view: 'list' as const,
        date: undefined,
        endDate: undefined,
        page: undefined,
      }),
    })
  }

  function shiftDate(days: number) {
    const base = date ? new Date(date + 'T00:00:00') : new Date()
    base.setDate(base.getDate() + days)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    updateSearch({ date: `${yyyy}-${mm}-${dd}` })
  }

  function handleSelectEvent(event: Event) {
    setSelectedEventId(event.ID)
    mapInstanceRef.current?.flyTo({
      center: [event.Longitude, event.Latitude],
      zoom: 16.5,
      pitch: 60,
      bearing: -20,
      duration: 1200,
      essential: true,
    })
    if (sheetSnap === 'full') setSheetSnap('half')
  }

  function handleRecenter() {
    mapInstanceRef.current?.flyTo({
      center: [lng, lat],
      zoom: 11,
      pitch: 0,
      bearing: 0,
      duration: 900,
    })
  }

  const filtersNode = (
    <FiltersRow
      date={date}
      category={category}
      onShiftDate={shiftDate}
      onDateChange={(v) => updateSearch({ date: v || undefined })}
      onCategoryChange={(v) => updateSearch({ category: v || undefined })}
    />
  )

  const listNode = (
    <EventList
      events={events}
      shouldFetch={shouldFetch}
      isLoading={isLoading && shouldFetch}
      center={{ lat, lng }}
      selectedEventId={selectedEventId}
      onSelect={handleSelectEvent}
    />
  )

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-(--bg-base)">
      <MapNavBar onShowList={handleShowList} />
      <div className="flex min-h-0 flex-1">
        <aside
          className={`fullscreen-slide-up relative z-10 hidden shrink-0 flex-col border-r border-(--line) bg-(--surface-strong) backdrop-blur-lg transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-0' : 'w-[400px]'
            }`}
        >
          {!sidebarCollapsed && (
            <>
              <SidebarHeader eventCount={events.length} shouldFetch={shouldFetch} />
              {filtersNode}
              <div className="min-h-0 flex-1 overflow-y-auto">{listNode}</div>
            </>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute left-full top-12 z-10 flex h-14 w-6 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) shadow-lg backdrop-blur-lg hover:text-(--sea-ink)"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={sidebarCollapsed ? 'M4 2l4 4-4 4' : 'M8 2L4 6l4 4'} />
            </svg>
          </button>
        </aside>

        <div className="relative min-w-0 flex-1">
          <EventMap
            events={events}
            center={{ lat, lng }}
            radiusMiles={radius ?? 10}
            className="h-full w-full"
            onMapReady={(map) => {
              mapInstanceRef.current = map
            }}
            onMapClick={handleMapClick}
            selectedEventId={selectedEventId}
          />

          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2">
              <div className="flex flex-col overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) shadow-lg backdrop-blur-lg">
                <button
                  type="button"
                  onClick={() => setSettingOrigin(!settingOrigin)}
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center ${settingOrigin
                      ? 'bg-(--lagoon-deep) text-white'
                      : 'text-(--sea-ink) hover:bg-(--link-bg-hover)'
                    }`}
                  aria-label="Set search center"
                  title="Click map to set new search center"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="10" cy="10" r="3" />
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 1v4M10 15v4M1 10h4M15 10h4" />
                  </svg>
                </button>
                <div className="border-t border-(--line)" />
                <button
                  type="button"
                  onClick={handleRecenter}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center text-(--sea-ink) hover:bg-(--link-bg-hover)"
                  aria-label="Recenter map"
                  title="Recenter map"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="10" cy="10" r="3" />
                    <path d="M10 1v3M10 16v3M1 10h3M16 10h3" />
                  </svg>
                </button>
              </div>
            </div>

            {settingOrigin && (
              <div
                className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-(--lagoon) bg-(--surface-strong) px-4 py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-(--lagoon) shadow-lg backdrop-blur-lg"
                style={{ boxShadow: '0 0 0 1px var(--lagoon), 0 0 22px color-mix(in oklab, var(--lagoon) 40%, transparent)' }}
              >
                Click anywhere to set search center
              </div>
            )}
          </div>

          <MobileSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            eventCount={events.length}
            shouldFetch={shouldFetch}
          >
            {filtersNode}
            <div className="min-h-0 flex-1 overflow-y-auto">{listNode}</div>
          </MobileSheet>
        </div>
      </div>
    </div>
  )
}

function SidebarHeader({
  eventCount,
  shouldFetch,
}: {
  eventCount: number
  shouldFetch: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 py-4">
      <div>
        <div className="island-kicker">Map</div>
        <div className="mt-0.5 text-lg font-bold tracking-tight text-(--sea-ink)">
          {shouldFetch
            ? `${eventCount} event${eventCount !== 1 ? 's' : ''}`
            : 'Pick a date'}
        </div>
      </div>
      <div
        className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))]"
        style={{ boxShadow: '0 0 10px var(--lagoon)' }}
        aria-hidden
      />
    </div>
  )
}

function FiltersRow({
  date,
  category,
  onShiftDate,
  onDateChange,
  onCategoryChange,
}: {
  date?: string
  category?: string
  onShiftDate: (n: number) => void
  onDateChange: (v: string) => void
  onCategoryChange: (v: string) => void
}) {
  return (
    <div className="space-y-2 border-b border-(--line) p-3">
      <div className="flex items-center gap-1.5">
        <IconButton onClick={() => onShiftDate(-1)} label="Previous day">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3L4 7l4 4" />
          </svg>
        </IconButton>
        <label className="relative flex-1">
          <span className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--chip-bg) px-3 text-sm font-semibold text-(--sea-ink) hover:border-(--lagoon)">
            {date ? formatDateLabel(date) : 'Pick date'}
          </span>
          <input
            type="date"
            value={date ?? ''}
            onChange={(e) => onDateChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <IconButton onClick={() => onShiftDate(1)} label="Next day">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 3l4 4-4 4" />
          </svg>
        </IconButton>
      </div>
      <select
        value={category ?? ''}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-(--line) bg-(--chip-bg) px-3 py-2 text-sm text-(--sea-ink) hover:border-(--lagoon)"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--chip-bg) text-(--sea-ink) hover:border-(--lagoon) hover:bg-(--link-bg-hover)"
      aria-label={label}
    >
      {children}
    </button>
  )
}

function EventList({
  events,
  shouldFetch,
  isLoading,
  center,
  selectedEventId,
  onSelect,
}: {
  events: Event[]
  shouldFetch: boolean
  isLoading: boolean
  center: { lat: number; lng: number }
  selectedEventId: string | null
  onSelect: (e: Event) => void
}) {
  if (!shouldFetch) {
    return (
      <EmptyState
        title="Pick a date"
        subtitle="Select a date above to see events on the map."
      />
    )
  }
  if (isLoading) {
    return (
      <div className="px-4 py-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="mb-3 flex animate-pulse gap-3"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-16 w-16 shrink-0 rounded-md bg-(--line)" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-3/4 rounded bg-(--line)" />
              <div className="h-2.5 w-1/2 rounded bg-(--line)" />
              <div className="h-2.5 w-1/3 rounded bg-(--line)" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events"
        subtitle="Try a different date, category, or radius."
      />
    )
  }
  return (
    <ul className="divide-y divide-(--line)">
      {events.map((event) => (
        <EventCardRow
          key={event.ID}
          event={event}
          center={center}
          selected={selectedEventId === event.ID}
          onClick={() => onSelect(event)}
        />
      ))}
    </ul>
  )
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <div className="island-kicker">Nothing here yet</div>
      <div className="mt-2 text-sm font-bold text-(--sea-ink)">{title}</div>
      <div className="mt-1 text-xs text-(--sea-ink-soft)">{subtitle}</div>
    </div>
  )
}

function EventCardRow({
  event,
  center,
  selected,
  onClick,
}: {
  event: Event
  center: { lat: number; lng: number }
  selected: boolean
  onClick: () => void
}) {
  const distance = haversineMiles(
    center.lat,
    center.lng,
    event.Latitude,
    event.Longitude,
  )
  const time = isAllDay(event)
    ? 'All day'
    : new Date(event.StartTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  const price = formatPrice(event)
  const category = event.Categories?.[0]

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-(--link-bg-hover)' : 'hover:bg-(--link-bg-hover)'
          }`}
        style={
          selected ? { boxShadow: 'inset 3px 0 0 var(--lagoon)' } : undefined
        }
      >
        {event.ImageUrl ? (
          <img
            src={event.ImageUrl}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-md border border-(--line) object-cover"
          />
        ) : (
          <div
            className="h-16 w-16 shrink-0 rounded-md border border-(--line)"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in oklab, var(--lagoon) 40%, transparent), color-mix(in oklab, var(--palm) 40%, transparent))',
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-(--sea-ink)">
            {event.Title}
          </div>
          <div className="mt-0.5 truncate text-xs text-(--sea-ink-soft)">
            {time}
            {event.VenueName ? ` · ${event.VenueName}` : ''}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem]">
            {category && (
              <span className="rounded-full border border-(--chip-line) bg-(--chip-bg) px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-(--lagoon-deep)">
                {category}
              </span>
            )}
            <span className="text-(--sea-ink-soft)">
              {distance.toFixed(1)} mi
            </span>
            {price && (
              <span className="font-semibold text-(--lime)">{price}</span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

function MobileSheet({
  snap,
  onSnapChange,
  eventCount,
  shouldFetch,
  children,
}: {
  snap: SheetSnap
  onSnapChange: (s: SheetSnap) => void
  eventCount: number
  shouldFetch: boolean
  children: React.ReactNode
}) {
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)

  function computeSnapPx(s: SheetSnap): number {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    if (s === 'peek') return 120
    if (s === 'half') return Math.round(vh * 0.5)
    return Math.round(vh * 0.9)
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY
    dragStartHeight.current = computeSnapPx(snap)
    setDragHeight(dragStartHeight.current)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch { }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragHeight == null) return
    const delta = dragStartY.current - e.clientY
    const vh = window.innerHeight
    const h = Math.max(
      80,
      Math.min(vh * 0.9, dragStartHeight.current + delta),
    )
    setDragHeight(h)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragHeight == null) return
    const vh = window.innerHeight
    const snaps: Array<[SheetSnap, number]> = [
      ['peek', 120],
      ['half', Math.round(vh * 0.5)],
      ['full', Math.round(vh * 0.9)],
    ]
    let nearest: SheetSnap = 'peek'
    let bestDist = Infinity
    for (const [s, h] of snaps) {
      const d = Math.abs(dragHeight - h)
      if (d < bestDist) {
        bestDist = d
        nearest = s
      }
    }
    onSnapChange(nearest)
    setDragHeight(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { }
  }

  const style: React.CSSProperties =
    dragHeight != null
      ? { height: `${dragHeight}px`, transition: 'none' }
      : {
        height:
          snap === 'peek' ? '120px' : snap === 'half' ? '50vh' : '90vh',
      }

  function cycleSnap() {
    onSnapChange(
      snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek',
    )
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-(--line) bg-(--surface-strong) shadow-2xl backdrop-blur-lg transition-[height] duration-200 md:hidden"
      style={style}
    >
      <div
        className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label="Resize event list"
        aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 50 : 100}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div className="h-1.5 w-10 rounded-full bg-(--sea-ink-soft) opacity-40" />
      </div>
      <button
        type="button"
        onClick={cycleSnap}
        className="flex items-center justify-between gap-2 border-b border-(--line) px-4 pb-3 text-left"
      >
        <div>
          <div className="island-kicker">Map</div>
          <div className="mt-0.5 text-sm font-bold text-(--sea-ink)">
            {shouldFetch
              ? `${eventCount} event${eventCount !== 1 ? 's' : ''}`
              : 'Pick a date'}
          </div>
        </div>
        <div
          className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))]"
          style={{ boxShadow: '0 0 8px var(--lagoon)' }}
          aria-hidden
        />
      </button>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export function FullscreenMapSkeleton() {
  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-(--bg-base)">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
        <div className="h-4 w-24 animate-pulse rounded bg-(--line)" />
        <div className="ml-auto h-7 w-16 animate-pulse rounded-md bg-(--line)" />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="relative hidden w-[400px] shrink-0 flex-col border-r border-(--line) bg-(--surface-strong) backdrop-blur-lg md:flex">
          <div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 py-4">
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-16 animate-pulse rounded bg-(--line)" />
              <div className="h-4 w-28 animate-pulse rounded bg-(--line)" />
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))] opacity-60" />
          </div>
          <div className="space-y-2 border-b border-(--line) p-3">
            <div className="flex items-center gap-1.5">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-(--line)" />
              <div className="h-9 flex-1 animate-pulse rounded-lg bg-(--line)" />
              <div className="h-9 w-9 animate-pulse rounded-lg bg-(--line)" />
            </div>
            <div className="h-9 w-full animate-pulse rounded-lg bg-(--line)" />
          </div>
          <div className="flex-1 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex animate-pulse gap-3 border-b border-(--line) px-4 py-3"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="h-16 w-16 shrink-0 rounded-md bg-(--line)" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-3/4 rounded bg-(--line)" />
                  <div className="h-2.5 w-1/2 rounded bg-(--line)" />
                  <div className="h-2.5 w-1/3 rounded bg-(--line)" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        >
          <div
            className="absolute inset-0 animate-pulse opacity-40"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--lagoon) 22%, transparent), transparent 55%)',
            }}
          />
          <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) shadow-lg backdrop-blur-lg">
              <div className="h-10 w-10" />
              <div className="border-t border-(--line)" />
              <div className="h-10 w-10" />
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 z-20 rounded-t-2xl border border-b-0 border-(--line) bg-(--surface-strong) shadow-2xl backdrop-blur-lg md:hidden"
            style={{ height: '120px' }}
          >
            <div className="flex h-7 items-center justify-center">
              <div className="h-1.5 w-10 rounded-full bg-(--sea-ink-soft) opacity-30" />
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 pb-3">
              <div className="space-y-1.5">
                <div className="h-2 w-16 animate-pulse rounded bg-(--line)" />
                <div className="h-3 w-24 animate-pulse rounded bg-(--line)" />
              </div>
              <div className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))] opacity-60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapNavBar({ onShowList }: { onShowList: () => void }) {
  const { isSignedIn } = useAuth()
  const { isUser, canCreateEvent, canManageAuthors } = useUserRole()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = (
    <>
      <Link
        to="/events"
        className="nav-link"
        activeProps={{ className: 'nav-link is-active' }}
        activeOptions={{ exact: true, includeSearch: false }}
        onClick={() => setMenuOpen(false)}
      >
        Events
      </Link>
      {isSignedIn && canCreateEvent && (
        <Link
          to="/submit"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
          onClick={() => setMenuOpen(false)}
        >
          Submit Event
        </Link>
      )}
      {isSignedIn && canCreateEvent && (
        <Link
          to="/my-events"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
          onClick={() => setMenuOpen(false)}
        >
          My Events
        </Link>
      )}
      {isSignedIn && isUser && (
        <Link
          to="/apply-author"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
          onClick={() => setMenuOpen(false)}
        >
          Apply to be Author
        </Link>
      )}
      {isSignedIn && canManageAuthors && (
        <Link
          to="/admin"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      )}
      {isSignedIn && (
        <Link
          to="/profile"
          className="nav-link"
          activeProps={{ className: 'nav-link is-active' }}
          onClick={() => setMenuOpen(false)}
        >
          Profile
        </Link>
      )}
    </>
  )

  return (
    <nav className="relative shrink-0 border-b border-(--line) bg-(--header-bg) backdrop-blur-lg">
      <div className="flex items-center gap-x-3 px-4 py-2">
        <Link
          to="/"
          className="shrink-0 text-sm font-bold tracking-tight text-(--sea-ink) no-underline"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))] shadow-[0_0_10px_var(--lagoon)]" />
            919Events
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-(--sea-ink-soft) hover:bg-(--surface) sm:hidden"
          aria-label="Toggle navigation menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className="hidden items-center gap-x-3 text-sm font-semibold sm:flex">
          {navLinks}
        </div>

        <button
          type="button"
          onClick={onShowList}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-semibold text-(--sea-ink) hover:bg-(--link-bg-hover)"
          aria-label="Switch to list view"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 3.5h10M2 7h10M2 10.5h10" />
          </svg>
          List
        </button>

        <ThemeToggle />
        <ClerkHeader />
      </div>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-lg sm:hidden">
          <div className="flex flex-col px-4 py-2 text-sm font-semibold [&>a]:flex [&>a]:min-h-11 [&>a]:items-center">
            {navLinks}
          </div>
        </div>
      )}
    </nav>
  )
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function formatPrice(event: Event): string | null {
  const min = event.PriceMin
  const max = event.PriceMax
  if (min == null && max == null) return null
  if ((min ?? 0) === 0 && (max ?? 0) === 0) return 'Free'
  if (min != null && max != null && min !== max) return `$${min}–${max}`
  const p = min ?? max
  return p != null ? `$${p}` : null
}
