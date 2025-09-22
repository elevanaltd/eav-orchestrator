import { test } from '@playwright/test';

test.describe('TipTap Editor Diagnostic Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5175/');
    await page.waitForLoadState('networkidle');
  });

  test('diagnose editor editable state and issues', async ({ page }) => {
    console.log('\n=== EDITOR DIAGNOSTIC REPORT ===\n');

    // First check what's actually on the page
    const bodyContent = await page.locator('body').innerHTML();
    console.log('Page has content:', bodyContent.length > 100);

    // Get a sample of what's actually rendered
    const mainContent = await page.locator('#root, main, .app, body').first().textContent();
    console.log('Main content preview:', mainContent?.substring(0, 200));

    // Check for any React error boundaries
    const errorBoundary = await page.locator('[class*="error"], [class*="Error"]').count();
    console.log('Error elements found:', errorBoundary);

    // Look for various editor-related elements
    const editorSelectors = [
      '.ProseMirror',
      '[data-testid="editor-content"]',
      '[data-testid="script-editor"]',
      '.editor-wrapper',
      '[contenteditable]',
      'div[role="textbox"]'
    ];

    console.log('\n=== CHECKING FOR EDITOR ELEMENTS ===');
    for (const selector of editorSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();
      if (count > 0) {
        console.log(`✓ Found element: ${selector}`);
        const attrs = await element.evaluate(el => ({
          contenteditable: el.getAttribute('contenteditable'),
          className: el.className,
          tagName: el.tagName,
          textContent: el.textContent?.substring(0, 50)
        }));
        console.log(`  Attributes:`, attrs);
      } else {
        console.log(`✗ Not found: ${selector}`);
      }
    }

    // 1. Check if ProseMirror editor exists
    const proseMirror = page.locator('.ProseMirror').first();
    const proseMirrorExists = await proseMirror.count() > 0;
    console.log(`\n✓ ProseMirror editor found: ${proseMirrorExists}`);

    if (proseMirrorExists) {
      // 2. Check contenteditable attribute
      const contentEditable = await proseMirror.getAttribute('contenteditable');
      console.log(`✓ ContentEditable attribute: "${contentEditable}"`);

      // 3. Check if editor is focusable
      const tabIndex = await proseMirror.getAttribute('tabindex');
      console.log(`✓ TabIndex: "${tabIndex}"`);

      // 4. Check CSS classes
      const classes = await proseMirror.getAttribute('class');
      console.log(`✓ CSS Classes: "${classes}"`);

      // 5. Check computed styles
      const isVisible = await proseMirror.isVisible();
      console.log(`✓ Is Visible: ${isVisible}`);

      const isEnabled = await proseMirror.isEnabled();
      console.log(`✓ Is Enabled: ${isEnabled}`);

      // 6. Get any error messages from console
      const consoleLogs: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleLogs.push(`ERROR: ${msg.text()}`);
        }
      });

      // 7. Try to click and type
      try {
        await proseMirror.click();
        console.log('✓ Click successful');

        // Wait a moment for focus
        await page.waitForTimeout(500);

        // Check if focused
        const isFocused = await page.evaluate(() => {
          const activeElement = document.activeElement;
          return activeElement?.classList.contains('ProseMirror');
        });
        console.log(`✓ Editor focused after click: ${isFocused}`);

        // Try typing
        await page.keyboard.type('Test typing');
        await page.waitForTimeout(500);

        // Check if text was added
        const textContent = await proseMirror.textContent();
        console.log(`✓ Text content after typing: "${textContent}"`);

      } catch (error) {
        console.log(`✗ Interaction failed: ${error}`);
      }

      // 8. Check for blocking elements
      const boundingBox = await proseMirror.boundingBox();
      if (boundingBox) {
        // Check if any element is covering the editor
        const elementAtCenter = await page.evaluate(({ x, y, width, height }) => {
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          const element = document.elementFromPoint(centerX, centerY);
          return {
            tagName: element?.tagName,
            className: element?.className,
            id: element?.id,
            isProseMirror: element?.classList.contains('ProseMirror')
          };
        }, boundingBox);
        console.log(`✓ Element at editor center:`, elementAtCenter);
      }

      // 9. Check Y.js initialization
      const hasYDoc = await page.evaluate(() => {
        return typeof (window as any).Y !== 'undefined';
      });
      console.log(`✓ Y.js loaded: ${hasYDoc}`);

      // 10. Check TipTap initialization
      const editorState = await page.evaluate(() => {
        const editorEl = document.querySelector('.ProseMirror');
        if (!editorEl) return null;

        // Try to access ProseMirror view through the DOM element
        const pmView = (editorEl as any).pmViewDesc?.view;
        return {
          hasView: !!pmView,
          isEditable: pmView?.editable,
          docSize: pmView?.state?.doc?.content?.size
        };
      });
      console.log('✓ Editor internal state:', editorState);

      // 11. Look for any script components
      const scriptComponents = page.locator('[data-testid*="script-component"]');
      const componentCount = await scriptComponents.count();
      console.log(`✓ Script components found: ${componentCount}`);

      // 12. Console errors
      if (consoleLogs.length > 0) {
        console.log('\n=== CONSOLE ERRORS ===');
        consoleLogs.forEach(log => console.log(log));
      }

      // Take screenshot for visual inspection
      await page.screenshot({ path: 'editor-diagnostic.png', fullPage: true });
      console.log('\n✓ Screenshot saved as editor-diagnostic.png');
    }

    console.log('\n=== END DIAGNOSTIC REPORT ===\n');
  });

  test('check for React hydration or mounting issues', async ({ page }) => {
    // Listen for console messages before navigation
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:5175/');
    await page.waitForTimeout(2000); // Wait for app to fully load

    // Check if React DevTools are available
    const hasReact = await page.evaluate(() => {
      return !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    });
    console.log(`React DevTools available: ${hasReact}`);

    // Check for hydration errors
    const hydrationErrors = consoleLogs.filter(log =>
      log.includes('hydration') ||
      log.includes('Hydration') ||
      log.includes('did not match')
    );

    if (hydrationErrors.length > 0) {
      console.log('Hydration errors found:');
      hydrationErrors.forEach(err => console.log(err));
    }

    // Filter for relevant logs
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('TipTap') ||
      log.includes('editor') ||
      log.includes('Editor') ||
      log.includes('Y.js') ||
      log.includes('error') ||
      log.includes('warning')
    );

    console.log('\n=== RELEVANT CONSOLE LOGS ===');
    relevantLogs.forEach(log => console.log(log));
  });
});