import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Homepage Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('homepage loads with correct layout', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await expect(page).toHaveScreenshot('homepage-full.png', {
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('main navigation renders correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Screenshot just the navigation area
    const nav = page.locator('nav').first();
    await expect(nav).toHaveScreenshot('homepage-nav.png', {
      animations: 'disabled',
      threshold: 0.2,
    });
  });

  test('hero section visual consistency', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Screenshot hero section if it exists
    const hero = page.locator('[data-testid="hero"], .hero, main > section').first();
    if (await hero.count() > 0) {
      await expect(hero).toHaveScreenshot('homepage-hero.png', {
        animations: 'disabled',
        threshold: 0.2,
        mask: [page.locator('.dynamic-content, .timestamp, .user-avatar')],
      });
    }
  });

  test('accessibility compliance', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Run accessibility checks
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('responsive behavior - mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: true,
    });
  });

  test('responsive behavior - tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: true,
    });
  });
});