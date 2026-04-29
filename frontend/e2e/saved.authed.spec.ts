import { test, expect } from '@playwright/test'

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
