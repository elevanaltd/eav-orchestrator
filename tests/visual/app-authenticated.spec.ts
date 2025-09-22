import { test, expect } from '@playwright/test';
import { AuthHelper } from './auth-helper';
import { VisualHelper } from './visual-helper';

test.describe('EAV Orchestrator - Authenticated App UI', () => {
  let authHelper: AuthHelper;
  let visualHelper: VisualHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    visualHelper = new VisualHelper(page);

    // Login before each test
    await authHelper.login();
  });

  test('capture full application layout after login', async ({ page }) => {
    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to render

    // Check if we're on the app or still on login
    const isLoggedIn = await authHelper.isLoggedIn();

    if (!isLoggedIn) {
      console.log('WARNING: Still on login page. Check test credentials.');

      // Capture login page for debugging
      await page.screenshot({
        path: 'tests/visual/screenshots/login-page.png',
        fullPage: true
      });

      // Try to see what's on the page
      const pageContent = await page.locator('body').textContent();
      console.log('Page content preview:', pageContent?.substring(0, 500));

      test.skip();
      return;
    }

    // Capture the main app layout
    await expect(page).toHaveScreenshot('app-full-layout.png', {
      fullPage: true,
      animations: 'disabled',
      threshold: 0.2
    });
  });

  test('capture 3-column layout structure', async ({ page }) => {
    const isLoggedIn = await authHelper.isLoggedIn();
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    // Wait for app to stabilize
    await page.waitForTimeout(1000);

    // Look for the 3-column structure
    const leftSidebar = page.locator('.video-list, .sidebar, aside').first();
    const mainContent = page.locator('.script-editor, main, .main-content').first();
    const rightSidebar = page.locator('.comments-panel, .right-sidebar, aside').last();

    // Capture each column if they exist
    if (await leftSidebar.count() > 0) {
      await expect(leftSidebar).toHaveScreenshot('app-left-sidebar.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }

    if (await mainContent.count() > 0) {
      await expect(mainContent).toHaveScreenshot('app-main-content.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }

    if (await rightSidebar.count() > 0) {
      await expect(rightSidebar).toHaveScreenshot('app-right-sidebar.png', {
        animations: 'disabled',
        threshold: 0.2
      });
    }

    // Capture the full 3-column layout
    await expect(page).toHaveScreenshot('app-3-column-layout.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: false
    });
  });

  test('capture Script Editor and check component rendering', async ({ page }) => {
    const isLoggedIn = await authHelper.isLoggedIn();
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    // Wait for editor to load
    await page.waitForTimeout(2000);

    // Look for the script editor
    const scriptEditor = page.locator('.script-editor, .editor-container, .ProseMirror').first();

    if (await scriptEditor.count() > 0) {
      // Capture the editor
      await expect(scriptEditor).toHaveScreenshot('script-editor.png', {
        animations: 'disabled',
        threshold: 0.2
      });

      // Check how components are rendered
      // Look for component containers
      const componentBlocks = page.locator('.document-component');
      const componentCount = await componentBlocks.count();
      console.log(`Found ${componentCount} component blocks`);

      if (componentCount > 0) {
        // Capture first few components to see styling
        for (let i = 0; i < Math.min(3, componentCount); i++) {
          await expect(componentBlocks.nth(i)).toHaveScreenshot(`component-${i}.png`, {
            animations: 'disabled',
            threshold: 0.2
          });
        }
      }

      // Check for paragraph elements (should be seamless like Google Docs)
      const paragraphs = page.locator('p.script-paragraph, .editor-content p');
      const paragraphCount = await paragraphs.count();
      console.log(`Found ${paragraphCount} paragraph elements`);

      // Check if components have card styling (they shouldn't)
      // Only check within the script editor area to avoid counting navigation elements
      const cardsWithBorders = await scriptEditor.locator('[style*="border"], .card, .component-card').count();
      console.log(`Elements with card-like styling within editor: ${cardsWithBorders}`);

      // This should be 0 for Google Docs style
      if (cardsWithBorders > 0) {
        console.warn('WARNING: Found card-styled elements. Should be seamless paragraphs like Google Docs.');
      }
    } else {
      console.log('Script editor not found on page');
    }
  });

  test('check for Google Docs-style continuous document flow', async ({ page }) => {
    const isLoggedIn = await authHelper.isLoggedIn();
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    // Use visual helper to check for UI issues
    const issues = await visualHelper.checkForUIIssues();

    if (issues.length > 0) {
      console.log('UI Issues detected:');
      issues.forEach(issue => {
        console.log(`- ${issue.type}:`, issue.elements);
      });
    }

    // Check component spacing - updated for new Google Docs-style classes
    const components = await page.locator('.document-component').all();

    if (components.length > 1) {
      // Check if components have excessive spacing
      for (let i = 0; i < components.length - 1; i++) {
        const currentBox = await components[i].boundingBox();
        const nextBox = await components[i + 1].boundingBox();

        if (currentBox && nextBox) {
          const gap = nextBox.y - (currentBox.y + currentBox.height);

          if (gap > 20) {
            console.warn(`Excessive gap (${gap}px) between components ${i} and ${i + 1}. Should be minimal for document flow.`);
          }
        }
      }
    }

    // Capture the document flow
    await expect(page).toHaveScreenshot('document-flow-check.png', {
      animations: 'disabled',
      threshold: 0.2,
      fullPage: false
    });
  });

  test('capture tabs and navigation', async ({ page }) => {
    const isLoggedIn = await authHelper.isLoggedIn();
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    // Look for tab navigation
    const tabs = page.locator('[role="tab"], .tab-button, button').filter({
      hasText: /Script|Voice|Scenes|Direction/i
    });

    if (await tabs.count() > 0) {
      // Capture tab bar
      const tabContainer = tabs.first().locator('xpath=ancestor::div[contains(@class, "tab")]').first();
      if (await tabContainer.count() > 0) {
        await expect(tabContainer).toHaveScreenshot('tab-navigation.png', {
          animations: 'disabled',
          threshold: 0.2
        });
      }

      // Click through tabs and capture each state
      const tabCount = await tabs.count();
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        const tabText = await tab.textContent();

        await tab.click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot(`tab-content-${tabText?.toLowerCase().replace(/\s/g, '-')}.png`, {
          animations: 'disabled',
          threshold: 0.2,
          fullPage: false
        });
      }
    }
  });
});