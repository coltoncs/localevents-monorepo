import { useEffect, useState } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env.local file')
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    function check() {
      const el = document.documentElement
      setIsDark(el.classList.contains('dark'))
    }

    check()

    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return isDark
}

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const isDark = useIsDark()

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={isDark ? { baseTheme: dark } : undefined}
    >
      {children}
    </ClerkProvider>
  )
}
