import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { test as setup, expect } from '@playwright/test'

const STORAGE_STATE = 'e2e/.clerk/user.json'

const username = process.env.E2E_TEST_USER_USERNAME
const password = process.env.E2E_TEST_USER_PASSWORD

setup('authenticate test user', async ({ page }) => {
  if (!username || !password) {
    setup.skip(
      true,
      'E2E_TEST_USER_USERNAME / E2E_TEST_USER_PASSWORD not set; skipping authed specs',
    )
    return
  }

  await setupClerkTestingToken({ page })
  await page.goto('/')

  // Clerk's helper handles the SignIn flow against the configured test
  // instance. The strategy must match how the test user was created in the
  // Clerk dashboard.
  await clerk.signIn({
    page,
    signInParams: { strategy: 'password', identifier: username, password },
  })

  await page.goto('/')
  // Sanity check: after sign-in the header should expose a user menu rather
  // than the sign-in CTA.
  await expect(page.getByRole('button', { name: /sign in/i })).toHaveCount(0)

  await page.context().storageState({ path: STORAGE_STATE })
})
