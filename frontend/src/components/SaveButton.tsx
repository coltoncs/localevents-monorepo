import { useAuth } from '@clerk/clerk-react'
import { Heart } from 'lucide-react'
import {
  useSavedEvents,
  useSaveEvent,
  useUnsaveEvent,
} from '#/lib/hooks/useSavedEvents'

export function SaveButton({ eventId }: { eventId: string }) {
  const { isSignedIn } = useAuth()
  const { data: savedEvents } = useSavedEvents()
  const saveEvent = useSaveEvent()
  const unsaveEvent = useUnsaveEvent()

  if (!isSignedIn) return null

  const isSaved = savedEvents?.some((e) => e.ID === eventId)
  const isPending = saveEvent.isPending || unsaveEvent.isPending

  function handleToggle() {
    if (isSaved) {
      unsaveEvent.mutate(eventId)
    } else {
      saveEvent.mutate(eventId)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`cursor-pointer inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-nowrap transition ${
        isSaved
          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]'
      } disabled:opacity-50`}
    >
      <Heart size={15} className={isSaved ? 'fill-red-500 text-red-500' : ''} />
      {isSaved ? 'Saved' : 'Save'}
    </button>
  )
}
