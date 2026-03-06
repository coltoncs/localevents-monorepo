import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate({ to: '/' })
    }
  }, [isLoaded, isSignedIn, navigate])

  if (!isLoaded) {
    return (
      <div className="py-12 text-center text-[var(--sea-ink-soft)]">Loading...</div>
    )
  }

  if (!isSignedIn) return null

  return <>{children}</>
}
