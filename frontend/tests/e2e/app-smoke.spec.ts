import { expect, test } from '@playwright/test'

test('renders public landing page and navigates to login', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false }),
    })
  })

  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: /TimeCapsule/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Login/i })).toBeVisible()

  await page.getByRole('button', { name: /Login/i }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('input[name="email"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()

  expect(consoleErrors.filter((message) => !message.includes('Failed to load resource'))).toEqual([])
})
