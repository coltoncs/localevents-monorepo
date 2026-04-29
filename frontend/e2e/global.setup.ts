import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'

setup.describe.configure({ mode: 'serial' })

setup('clerk testing token', async () => {
  // clerkSetup primes a Testing Token so authed pages don't trip Clerk's
  // bot protection. It needs both keys; without them, smoke specs against
  // the public surface still work, so we skip rather than fail.
  if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    setup.skip(
      true,
      'CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY not set; authed specs will be skipped',
    )
    return
  }
  await clerkSetup()
})
