import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Map as MapboxMap } from 'mapbox-gl'
import { BeverageMap } from '#/components/BeverageMap'
import { useBeverages } from '#/lib/hooks/useBeverages'
import type { Beverage } from '#/lib/types'

type SheetSnap = 'peek' | 'half' | 'full'
type BevType = 'brewery' | 'bar'

interface FullscreenBeverageMapProps {
  lat: number
  lng: number
  radius?: number
  type?: BevType
  search?: string
  onClose: () => void
}

const RADIUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 25, label: '25 mi' },
  { value: 50, label: '50 mi' },
  { value: 100, label: '100 mi' },
  { value: 0, label: 'All' },
]

export function FullscreenBeverageMap({
  lat,
  lng,
  radius,
  type,
  search,
  onClose,
}: FullscreenBeverageMapProps) {
  const navigate = useNavigate()
  const [settingOrigin, setSettingOrigin] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')
  const [selectedBevId, setSelectedBevId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(search ?? '')
  const mapInstanceRef = useRef<MapboxMap | null>(null)

  const effectiveRadius = radius ?? 10
  const showAll = effectiveRadius === 0
  const filters = {
    lat,
    lng,
    radius: showAll ? 25000 : effectiveRadius,
    type,
    search,
  }
  const { data, isLoading } = useBeverages(filters)
  const beverages = data?.beverages ?? []

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    setSearchInput(search ?? '')
  }, [search])

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
    setSelectedBevId(null)
  }, [type, search, lat, lng, radius])

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
      to: '/drinks',
      search: (prev) => ({ ...prev, lat, lng, ...updates }),
      replace: true,
    })
  }

  function setType(t: BevType | undefined) {
    navigate({
      to: '/drinks',
      search: (prev) => ({ ...prev, type: t }),
      replace: true,
    })
  }

  function setRadius(r: number) {
    navigate({
      to: '/drinks',
      search: (prev) => ({ ...prev, radius: r }),
      replace: true,
    })
  }

  function submitSearch(value: string) {
    const trimmed = value.trim()
    navigate({
      to: '/drinks',
      search: (prev) => ({ ...prev, search: trimmed || undefined }),
      replace: true,
    })
  }

  function handleSelectBev(bev: Beverage) {
    setSelectedBevId(bev.ID)
    mapInstanceRef.current?.flyTo({
      center: [bev.Longitude, bev.Latitude],
      zoom: 15,
      duration: 900,
    })
    if (sheetSnap === 'full') setSheetSnap('half')
  }

  function handleRecenter() {
    mapInstanceRef.current?.flyTo({
      center: [lng, lat],
      zoom: 11,
      duration: 900,
    })
  }

  const filtersNode = (
    <FiltersRow
      type={type}
      radius={effectiveRadius}
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      onSubmitSearch={() => submitSearch(searchInput)}
      onClearSearch={() => {
        setSearchInput('')
        submitSearch('')
      }}
      onTypeChange={setType}
      onRadiusChange={setRadius}
    />
  )

  const listNode = (
    <BeverageList
      beverages={beverages}
      isLoading={isLoading}
      center={{ lat, lng }}
      selectedBevId={selectedBevId}
      onSelect={handleSelectBev}
    />
  )

  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] bg-(--bg-base)">
      <aside
        className={`fullscreen-slide-up relative hidden shrink-0 flex-col border-r border-(--line) bg-(--surface-strong) backdrop-blur-lg transition-[width] duration-200 md:flex ${
          sidebarCollapsed ? 'w-0' : 'w-[400px]'
        }`}
      >
        {!sidebarCollapsed && (
          <>
            <SidebarHeader count={beverages.length} />
            {filtersNode}
            <div className="min-h-0 flex-1 overflow-y-auto">{listNode}</div>
          </>
        )}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute left-full top-6 z-10 flex h-14 w-6 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) shadow-lg backdrop-blur-lg hover:text-(--sea-ink)"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={sidebarCollapsed ? 'M4 2l4 4-4 4' : 'M8 2L4 6l4 4'} />
          </svg>
        </button>
      </aside>

      <div className="relative min-w-0 flex-1">
        <BeverageMap
          beverages={beverages}
          center={{ lat, lng }}
          radiusMiles={showAll ? 0 : effectiveRadius}
          className="h-full w-full"
          onMapReady={(map) => {
            mapInstanceRef.current = map
          }}
          onMapClick={handleMapClick}
          selectedBeverageId={selectedBevId}
        />

        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--surface-strong) text-(--sea-ink) shadow-lg backdrop-blur-lg hover:bg-(--link-bg-hover)"
              aria-label="Exit fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
            <div className="flex flex-col overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) shadow-lg backdrop-blur-lg">
              <button
                type="button"
                onClick={() => setSettingOrigin(!settingOrigin)}
                className={`flex h-10 w-10 cursor-pointer items-center justify-center ${
                  settingOrigin
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
          count={beverages.length}
        >
          {filtersNode}
          <div className="min-h-0 flex-1 overflow-y-auto">{listNode}</div>
        </MobileSheet>
      </div>
    </div>
  )
}

function SidebarHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 py-4">
      <div>
        <div className="island-kicker">Drinks Map</div>
        <div className="mt-0.5 text-lg font-bold tracking-tight text-(--sea-ink)">
          {count} spot{count !== 1 ? 's' : ''}
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
  type,
  radius,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  onClearSearch,
  onTypeChange,
  onRadiusChange,
}: {
  type?: BevType
  radius: number
  searchInput: string
  onSearchInputChange: (v: string) => void
  onSubmitSearch: () => void
  onClearSearch: () => void
  onTypeChange: (t: BevType | undefined) => void
  onRadiusChange: (r: number) => void
}) {
  return (
    <div className="space-y-2 border-b border-(--line) p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmitSearch()
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="Search breweries & bars…"
          className="h-9 flex-1 rounded-lg border border-(--line) bg-(--chip-bg) px-3 text-sm text-(--sea-ink) outline-none placeholder:text-(--sea-ink-soft) focus:border-(--lagoon)"
        />
        {searchInput && (
          <button
            type="button"
            onClick={onClearSearch}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--chip-bg) text-(--sea-ink-soft) hover:border-(--lagoon) hover:text-(--sea-ink)"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </form>

      <div className="flex rounded-lg border border-(--line) bg-(--chip-bg) p-0.5 text-xs font-semibold">
        <TypeButton active={!type} onClick={() => onTypeChange(undefined)}>
          All
        </TypeButton>
        <TypeButton active={type === 'brewery'} onClick={() => onTypeChange('brewery')}>
          Breweries
        </TypeButton>
        <TypeButton active={type === 'bar'} onClick={() => onTypeChange('bar')}>
          Bars
        </TypeButton>
      </div>

      <select
        value={radius}
        onChange={(e) => onRadiusChange(Number(e.target.value))}
        className="w-full cursor-pointer rounded-lg border border-(--line) bg-(--chip-bg) px-3 py-2 text-sm text-(--sea-ink) hover:border-(--lagoon)"
      >
        {RADIUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 transition-colors ${
        active
          ? 'bg-(--lagoon-deep) text-white'
          : 'text-(--sea-ink-soft) hover:text-(--sea-ink)'
      }`}
    >
      {children}
    </button>
  )
}

function BeverageList({
  beverages,
  isLoading,
  center,
  selectedBevId,
  onSelect,
}: {
  beverages: Beverage[]
  isLoading: boolean
  center: { lat: number; lng: number }
  selectedBevId: string | null
  onSelect: (b: Beverage) => void
}) {
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
  if (beverages.length === 0) {
    return (
      <EmptyState
        title="No spots"
        subtitle="Try a larger radius or different filters."
      />
    )
  }
  return (
    <ul className="divide-y divide-(--line)">
      {beverages.map((bev) => (
        <BeverageCardRow
          key={bev.ID}
          beverage={bev}
          center={center}
          selected={selectedBevId === bev.ID}
          onClick={() => onSelect(bev)}
        />
      ))}
    </ul>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <div className="island-kicker">Nothing nearby</div>
      <div className="mt-2 text-sm font-bold text-(--sea-ink)">{title}</div>
      <div className="mt-1 text-xs text-(--sea-ink-soft)">{subtitle}</div>
    </div>
  )
}

function BeverageCardRow({
  beverage,
  center,
  selected,
  onClick,
}: {
  beverage: Beverage
  center: { lat: number; lng: number }
  selected: boolean
  onClick: () => void
}) {
  const distance = haversineMiles(
    center.lat,
    center.lng,
    beverage.Latitude,
    beverage.Longitude,
  )
  const typeLabel = beverage.Type === 'brewery' ? 'Brewery' : 'Bar'
  const price = formatPriceLevel(beverage.PriceLevel)
  const firstTag = beverage.Tags?.[0]

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors ${
          selected ? 'bg-(--link-bg-hover)' : 'hover:bg-(--link-bg-hover)'
        }`}
        style={selected ? { boxShadow: 'inset 3px 0 0 var(--lagoon)' } : undefined}
      >
        {beverage.ImageUrl ? (
          <img
            src={beverage.ImageUrl}
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
            {beverage.Name}
          </div>
          <div className="mt-0.5 truncate text-xs text-(--sea-ink-soft)">
            {typeLabel}
            {beverage.City ? ` · ${beverage.City}` : ''}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem]">
            <span className="rounded-full border border-(--chip-line) bg-(--chip-bg) px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-(--lagoon-deep)">
              {typeLabel}
            </span>
            <span className="text-(--sea-ink-soft)">
              {distance.toFixed(1)} mi
            </span>
            {price && (
              <span className="font-semibold text-(--sea-ink)">{price}</span>
            )}
            {firstTag && (
              <span className="truncate text-(--sea-ink-soft)">· {firstTag}</span>
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
  count,
  children,
}: {
  snap: SheetSnap
  onSnapChange: (s: SheetSnap) => void
  count: number
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
    } catch {}
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragHeight == null) return
    const delta = dragStartY.current - e.clientY
    const vh = window.innerHeight
    const h = Math.max(80, Math.min(vh * 0.9, dragStartHeight.current + delta))
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
    } catch {}
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
        aria-label="Resize list"
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
          <div className="island-kicker">Drinks Map</div>
          <div className="mt-0.5 text-sm font-bold text-(--sea-ink)">
            {count} spot{count !== 1 ? 's' : ''}
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

export function FullscreenBeverageMapSkeleton() {
  return (
    <div className="fixed inset-0 z-[60] flex h-[100dvh] bg-(--bg-base)">
      <aside className="relative hidden w-[400px] shrink-0 flex-col border-r border-(--line) bg-(--surface-strong) backdrop-blur-lg md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 py-4">
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-16 animate-pulse rounded bg-(--line)" />
            <div className="h-4 w-28 animate-pulse rounded bg-(--line)" />
          </div>
          <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(90deg,var(--lagoon),var(--palm))] opacity-60" />
        </div>
        <div className="space-y-2 border-b border-(--line) p-3">
          <div className="h-9 w-full animate-pulse rounded-lg bg-(--line)" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-(--line)" />
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
          <div className="h-10 w-10 rounded-lg border border-(--line) bg-(--surface-strong) shadow-lg backdrop-blur-lg" />
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
  )
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

function formatPriceLevel(level?: number): string | null {
  if (!level || level <= 0) return null
  return '$'.repeat(Math.min(4, level))
}
