import { test, expect } from '@playwright/test'

// Authed specs require the storage state written by auth.setup.ts. Skip the
// whole file when that setup was itself skipped (no Clerk e2e creds).
test.skip(
  !process.env.E2E_TEST_USER_USERNAME || !process.env.E2E_TEST_USER_PASSWORD,
  'E2E_TEST_USER_USERNAME / E2E_TEST_USER_PASSWORD not set',
)

test('signed-in user reaches /saved without redirect', async ({ page }) => {
  await page.goto('/saved')
  // Authed users see the saved-events page; unauthed users would be bounced
  // to sign-in or see an empty state with a sign-in prompt.
  await expect(page).toHaveURL(/\/saved/)
})

test('signed-in user reaches /settings without redirect', async ({ page }) => {
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings/)
})
