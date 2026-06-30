import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setTokenGetter } from '#/lib/api'
import { track } from '#/lib/analytics'

export function ClerkTokenProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    setTokenGetter(getToken)
  }, [getToken])

  // Fire sign_in on the signed-out -> signed-in transition (not on initial
  // load of an already-authenticated session). prev starts undefined, so the
  // first observed value seeds the ref without emitting.
  const prevSignedIn = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    if (prevSignedIn.current === false && isSignedIn) {
      track('sign_in')
    }
    prevSignedIn.current = isSignedIn
  }, [isSignedIn])

  return <>{children}</>
}
