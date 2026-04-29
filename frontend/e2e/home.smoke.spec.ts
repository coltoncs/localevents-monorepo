import { test, expect } from '@playwright/test'

test.describe('home', () => {
  test('hero renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /Discover Events/i })).toBeVisible()
  })

  test('header links to events page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Events', exact: true }).first().click()
    await expect(page).toHaveURL(/\/events/)
  })
})
