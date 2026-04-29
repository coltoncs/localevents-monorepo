import { test, expect } from '@playwright/test'

test('donate page renders', async ({ page }) => {
  await page.goto('/donate')
  await expect(page.getByRole('heading', { level: 1, name: /Help keep 919Events free/i })).toBeVisible()
  // Subscription section header is the most stable text on the page.
  await expect(page.getByText(/Monthly via subscription/i)).toBeVisible()
})
