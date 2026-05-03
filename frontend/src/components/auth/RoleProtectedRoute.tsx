import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useUserRole, type Role } from '#/lib/hooks/useUserRole'

export function RoleProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles: Role[]
}) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const { role, isLoaded: roleLoaded } = useUserRole()
  const navigate = useNavigate()

  const isLoaded = authLoaded && roleLoaded

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !roles.includes(role))) {
      navigate({ to: '/' })
    }
  }, [isLoaded, isSignedIn, role, roles, navigate])

  if (!isLoaded) {
    return (
      <div className="py-12 text-center text-[var(--sea-ink-soft)]">Loading...</div>
    )
  }

  if (!isSignedIn || !roles.includes(role)) return null

  return <>{children}</>
}
