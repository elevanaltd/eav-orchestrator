import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('EAV Orchestrator 3-Column Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('3-column layout structure renders correctly', async ({ page }) => {
    // Verify 3-column container exists
    const container = page.locator('[data-testid="three-column-layout"], .three-column-layout, .layout-container');
    await expect(container).toBeVisible();

    // Take screenshot of full layout
    await expect(page).toHaveScreenshot('eav-3column-layout.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: true,
    });
  });

  test('left sidebar navigation renders and is interactive', async ({ page }) => {
    const leftSidebar = page.locator('[data-testid="left-sidebar"], .left-sidebar, aside.navigation');

    if (await leftSidebar.count() > 0) {
      await expect(leftSidebar).toBeVisible();

      // Screenshot left sidebar
      await expect(leftSidebar).toHaveScreenshot('eav-left-sidebar.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Test navigation items if they exist
      const navItems = leftSidebar.locator('a, button').filter({ hasText: /Script|Voice|Scenes|Direction/i });
      const count = await navItems.count();

      if (count > 0) {
        // Click through navigation items and capture states
        for (let i = 0; i < count; i++) {
          const item = navItems.nth(i);
          const text = await item.textContent();

          await item.click();
          await page.waitForTimeout(500); // Allow for state change

          await expect(leftSidebar).toHaveScreenshot(`eav-sidebar-${text?.toLowerCase().replace(/\s/g, '-')}-active.png`, {
            animations: 'disabled',
            threshold: 0.2,
          });
        }
      }
    }
  });

  test('main content area with tabs renders correctly', async ({ page }) => {
    const mainContent = page.locator('[data-testid="main-content"], .main-content, main');

    if (await mainContent.count() > 0) {
      await expect(mainContent).toBeVisible();

      // Screenshot main content area
      await expect(mainContent).toHaveScreenshot('eav-main-content.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Check for tab navigation
      const tabs = mainContent.locator('[role="tab"], .tab, button').filter({ hasText: /Script|Voice|Scenes|Direction/i });
      const tabCount = await tabs.count();

      if (tabCount > 0) {
        // Test each tab
        for (let i = 0; i < tabCount; i++) {
          const tab = tabs.nth(i);
          const tabText = await tab.textContent();

          await tab.click();
          await page.waitForTimeout(300);

          await expect(mainContent).toHaveScreenshot(`eav-tab-${tabText?.toLowerCase().replace(/\s/g, '-')}.png`, {
            animations: 'disabled',
            threshold: 0.2,
          });
        }
      }
    }
  });

  test('right sidebar timeline/status renders', async ({ page }) => {
    const rightSidebar = page.locator('[data-testid="right-sidebar"], .right-sidebar, aside.timeline');

    if (await rightSidebar.count() > 0) {
      await expect(rightSidebar).toBeVisible();

      await expect(rightSidebar).toHaveScreenshot('eav-right-sidebar.png', {
        animations: 'disabled',
        threshold: 0.2,
        mask: [page.locator('.timestamp, .dynamic-status')],
      });
    }
  });

  test('responsive behavior - collapsed sidebars on mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('eav-mobile-layout.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: true,
    });

    // Check if hamburger menu exists
    const hamburger = page.locator('[data-testid="menu-toggle"], .menu-toggle, button[aria-label*="menu"]');
    if (await hamburger.count() > 0) {
      await hamburger.click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('eav-mobile-menu-open.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });

  test('tablet responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('eav-tablet-layout.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: true,
    });
  });

  test('accessibility compliance for layout', async ({ page }) => {
    // Check accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast', 'aria-roles', 'button-name', 'link-name'])
      .analyze();

    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('layout state persistence across navigation', async ({ page }) => {
    // Get initial state
    const initialLayout = await page.screenshot();

    // Navigate to different sections if available
    const navLinks = page.locator('a[href^="/"], button[data-route]').first();
    if (await navLinks.count() > 0) {
      await navLinks.click();
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Compare layouts
      const afterNavigation = await page.screenshot();
      expect(Buffer.compare(initialLayout, afterNavigation)).toBe(0);
    }
  });
});