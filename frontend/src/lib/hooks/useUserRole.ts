import { useUser } from '@clerk/clerk-react'

export type Role = 'user' | 'author' | 'admin'

export function useUserRole() {
  const { user, isLoaded } = useUser()

  const role: Role =
    (user?.publicMetadata?.role as Role) || 'user'

  return {
    role,
    isLoaded,
    isAdmin: role === 'admin',
    isAuthor: role === 'author',
    isUser: role === 'user',
    canCreateEvent: role === 'author' || role === 'admin',
    canManageAuthors: role === 'admin',
  }
}
