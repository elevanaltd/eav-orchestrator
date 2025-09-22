import { test, expect } from '@playwright/test';

test.describe('TipTap Collaborative Editor Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Script tab if needed
    const scriptTab = page.locator('button, [role="tab"]').filter({ hasText: /Script/i }).first();
    if (await scriptTab.count() > 0) {
      await scriptTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('TipTap editor renders with toolbar', async ({ page }) => {
    // Locate TipTap editor
    const editor = page.locator('[class*="tiptap"], [data-testid="tiptap-editor"], .ProseMirror').first();

    if (await editor.count() > 0) {
      await expect(editor).toBeVisible();

      // Screenshot editor with toolbar
      const editorContainer = editor.locator('xpath=ancestor::div[contains(@class, "editor")]').first() || editor;
      await expect(editorContainer).toHaveScreenshot('tiptap-editor-initial.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });

  test('editor formatting toolbar buttons', async ({ page }) => {
    const toolbar = page.locator('[class*="toolbar"], [role="toolbar"]').first();

    if (await toolbar.count() > 0) {
      await expect(toolbar).toBeVisible();

      // Screenshot toolbar
      await expect(toolbar).toHaveScreenshot('tiptap-toolbar.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Test formatting buttons if they exist
      const formatButtons = ['bold', 'italic', 'underline', 'bullet', 'heading'];

      for (const format of formatButtons) {
        const button = toolbar.locator(`button[title*="${format}"], button[aria-label*="${format}"], button`).filter({ hasText: new RegExp(format, 'i') }).first();

        if (await button.count() > 0) {
          // Hover state
          await button.hover();
          await expect(toolbar).toHaveScreenshot(`tiptap-toolbar-${format}-hover.png`, {
            animations: 'disabled',
            threshold: 0.2,
          });
        }
      }
    }
  });

  test('editor content area interaction states', async ({ page }) => {
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();

    if (await editor.count() > 0) {
      // Initial state
      await expect(editor).toHaveScreenshot('tiptap-content-initial.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Focused state
      await editor.click();
      await page.waitForTimeout(200);
      await expect(editor).toHaveScreenshot('tiptap-content-focused.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Type some content
      await editor.type('# Test Heading\n\nThis is a test paragraph with **bold** text.');
      await page.waitForTimeout(300);

      await expect(editor).toHaveScreenshot('tiptap-content-with-text.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });

  test('collaborative features visual elements', async ({ page }) => {
    // Check for collaboration indicators
    const collabIndicators = page.locator('[class*="collab"], [class*="cursor"], [class*="presence"]');

    if (await collabIndicators.count() > 0) {
      await expect(collabIndicators.first()).toHaveScreenshot('tiptap-collab-indicators.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }

    // Check for user presence/avatars
    const presenceList = page.locator('[class*="presence-list"], [data-testid="active-users"]');
    if (await presenceList.count() > 0) {
      await expect(presenceList).toHaveScreenshot('tiptap-presence-list.png', {
        animations: 'disabled',
        threshold: 0.2,
        mask: [page.locator('.user-avatar, .user-name')],
      });
    }
  });

  test('editor comment system visual', async ({ page }) => {
    // Look for comment indicators
    const commentButtons = page.locator('[class*="comment"], button[aria-label*="comment"]');

    if (await commentButtons.count() > 0) {
      const firstComment = commentButtons.first();
      await firstComment.hover();

      await expect(firstComment).toHaveScreenshot('tiptap-comment-hover.png', {
        animations: 'disabled',
        threshold: 0.2,
      });

      // Click to open comment panel if possible
      await firstComment.click();
      await page.waitForTimeout(300);

      const commentPanel = page.locator('[class*="comment-panel"], [class*="comments"]').first();
      if (await commentPanel.count() > 0) {
        await expect(commentPanel).toHaveScreenshot('tiptap-comment-panel.png', {
          animations: 'disabled',
          threshold: 0.2,
          mask: [page.locator('.timestamp, .user-name')],
        });
      }
    }
  });

  test('editor auto-save indicator', async ({ page }) => {
    // Look for auto-save status
    const saveIndicator = page.locator('[class*="save"], [class*="status"], text=/saving|saved/i');

    if (await saveIndicator.count() > 0) {
      await expect(saveIndicator.first()).toHaveScreenshot('tiptap-save-indicator.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });

  test('editor error states', async ({ page }) => {
    // Check for any error indicators (circuit breaker, connection issues)
    const errorIndicators = page.locator('[class*="error"], [class*="offline"], .circuit-breaker-open');

    if (await errorIndicators.count() > 0) {
      await expect(errorIndicators.first()).toHaveScreenshot('tiptap-error-state.png', {
        animations: 'disabled',
        threshold: 0.2,
      });
    }
  });

  test('editor responsive behavior on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();

    if (await editor.count() > 0) {
      await expect(editor).toHaveScreenshot('tiptap-mobile.png', {
        animations: 'disabled',
        threshold: 0.2
      });

      // Check if toolbar collapses or changes on mobile
      const toolbar = page.locator('[class*="toolbar"]').first();
      if (await toolbar.count() > 0) {
        await expect(toolbar).toHaveScreenshot('tiptap-mobile-toolbar.png', {
          animations: 'disabled',
          threshold: 0.2,
        });
      }
    }
  });
});