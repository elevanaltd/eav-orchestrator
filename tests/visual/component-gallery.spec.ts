import { test } from '@playwright/test';
import { VisualHelper } from './visual-helper';

test.describe('Component Gallery Visual Tests', () => {
  let visualHelper: VisualHelper;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualHelper(page);
    await page.goto('/');
  });

  test('button components visual consistency', async ({ page }) => {
    // Look for common button patterns
    const buttons = page.locator('button, [role="button"], .btn');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Screenshot all buttons in their container
      const buttonContainer = page.locator('body');
      await visualHelper.takeStableScreenshot(
        buttonContainer,
        'buttons-gallery.png',
        { maskDynamic: true }
      );
    }
  });

  test('form components visual consistency', async ({ page }) => {
    // Look for form elements
    const forms = page.locator('form, .form');
    const formCount = await forms.count();

    if (formCount > 0) {
      for (let i = 0; i < formCount; i++) {
        const form = forms.nth(i);
        await visualHelper.takeStableScreenshot(
          form,
          `form-${i}.png`,
          { maskDynamic: true }
        );
      }
    }
  });

  test('modal and dialog components', async ({ page }) => {
    // Try to trigger modals/dialogs
    const modalTriggers = page.locator('[data-testid*="modal"], [data-testid*="dialog"], .modal-trigger');
    const triggerCount = await modalTriggers.count();

    for (let i = 0; i < Math.min(triggerCount, 3); i++) {
      const trigger = modalTriggers.nth(i);

      try {
        await trigger.click();
        await page.waitForTimeout(500); // Wait for modal animation

        const modal = page.locator('.modal, [role="dialog"], .dialog').first();
        if (await modal.isVisible()) {
          await visualHelper.takeStableScreenshot(
            modal,
            `modal-${i}.png`
          );

          // Close modal
          const closeBtn = page.locator('[aria-label="Close"], .modal-close, .close-button').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      } catch (error) {
        // Continue with next modal if this one fails
        console.log(`Modal ${i} could not be triggered:`, error);
      }
    }
  });

  test('navigation states and interactions', async ({ page }) => {
    // Test navigation hover states
    const navItems = page.locator('nav a, .nav-item, .menu-item');
    const navCount = await navItems.count();

    if (navCount > 0) {
      // Normal state
      await visualHelper.takeStableScreenshot(
        page.locator('nav').first(),
        'navigation-normal.png'
      );

      // Hover state on first nav item
      if (navCount > 0) {
        await navItems.first().hover();
        await visualHelper.takeStableScreenshot(
          page.locator('nav').first(),
          'navigation-hover.png'
        );
      }
    }
  });

  test('error and loading states', async ({ page }) => {
    // Look for loading indicators
    const loadingElements = page.locator('.loading, .spinner, [data-testid*="loading"]');
    const loadingCount = await loadingElements.count();

    if (loadingCount > 0) {
      await visualHelper.takeStableScreenshot(
        loadingElements.first(),
        'loading-states.png'
      );
    }

    // Look for error messages
    const errorElements = page.locator('.error, .alert-error, [data-testid*="error"]');
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      await visualHelper.takeStableScreenshot(
        errorElements.first(),
        'error-states.png'
      );
    }
  });

  test('data visualization components', async ({ page }) => {
    // Look for charts, graphs, tables
    const datavizElements = page.locator('table, .chart, .graph, .visualization, canvas');
    const datavizCount = await datavizElements.count();

    for (let i = 0; i < Math.min(datavizCount, 5); i++) {
      const element = datavizElements.nth(i);
      await visualHelper.takeStableScreenshot(
        element,
        `dataviz-${i}.png`,
        { maskDynamic: true }
      );
    }
  });
});