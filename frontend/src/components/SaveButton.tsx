import { useAuth, useClerk } from '@clerk/clerk-react'
import { Heart } from 'lucide-react'
import { track } from '#/lib/analytics'
import {
  useSavedEvents,
  useSaveEvent,
  useUnsaveEvent,
  useEventSaveCount,
} from '#/lib/hooks/useSavedEvents'

export function SaveButton({ eventId, disabled, source = 'event_detail' }: { eventId: string, disabled: boolean, source?: string }) {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const { data: savedEvents } = useSavedEvents()
  const saveEvent = useSaveEvent()
  const unsaveEvent = useUnsaveEvent()
  const { data: saveCount } = useEventSaveCount(eventId)

  const isSaved = isSignedIn && savedEvents?.some((e) => e.ID === eventId)
  const isPending = saveEvent.isPending || unsaveEvent.isPending

  function handleToggle() {
    if (!isSignedIn) {
      track('save_signin_prompt', { source })
      openSignIn()
      return
    }
    if (isSaved) {
      track('unsave_event', { source })
      unsaveEvent.mutate(eventId)
    } else {
      track('save_event', { source })
      saveEvent.mutate(eventId)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending || disabled}
      className={`${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-nowrap transition ${
        isSaved
          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]'
      } disabled:opacity-50`}
    >
      <Heart size={15} className={isSaved ? 'fill-red-500 text-red-500' : ''} />
      {isSaved ? 'Saved' : 'Save'}
      {saveCount ? <span className="text-xs opacity-70">({saveCount})</span> : null}
    </button>
  )
}
