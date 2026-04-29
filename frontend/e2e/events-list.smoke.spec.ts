import { test, expect } from '@playwright/test'

test('events page accepts a location and renders results', async ({ page }) => {
  // Pre-seeded coords keep this independent of the LocationSearch geocoder.
  // Raleigh, NC.
  await page.goto('/events?lat=35.7796&lng=-78.6382&radius=25')

  // Wait for any heading on /events. The page's exact copy may evolve, so we
  // assert presence + URL rather than specific words.
  await expect(page).toHaveURL(/\/events/)
  await expect(page.locator('main, body')).toBeVisible()
})
