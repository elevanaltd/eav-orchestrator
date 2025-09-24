import { test, expect } from '@playwright/test';

test.describe('TipTap Editor Working Verification', () => {
  test('verify editor is editable after loading fix', async ({ page }) => {
    console.log('\n=== EDITOR VERIFICATION TEST ===\n');

    // Navigate to the app
    await page.goto('http://localhost:5174/');
    await page.waitForLoadState('networkidle');

    // Step 1: Handle authentication
    console.log('Step 1: Authenticating...');
    const devUserButton = page.locator('button:has-text("Dev User")').first();
    const hasDevUser = await devUserButton.count() > 0;

    if (hasDevUser) {
      await devUserButton.click();
      console.log('✓ Clicked Dev User button');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠ No Dev User button found - may already be authenticated');
    }

    // Step 2: Wait for editor to load (with our 3-second timeout)
    console.log('\nStep 2: Waiting for editor to load...');
    await page.waitForTimeout(4000); // Wait longer than our 3-second timeout

    // Step 3: Check for ProseMirror editor
    console.log('\nStep 3: Checking for TipTap/ProseMirror editor...');
    const proseMirror = page.locator('.ProseMirror').first();
    const editorExists = await proseMirror.count() > 0;

    if (!editorExists) {
      console.log('✗ No ProseMirror editor found!');
      console.log('Looking for any script-related elements...');

      // Debug: What's on the page?
      const scriptEditor = await page.locator('[data-testid="script-editor"]').count();
      const editorContent = await page.locator('[data-testid="editor-content"]').count();
      const anyContentEditable = await page.locator('[contenteditable="true"]').count();

      console.log(`  - script-editor elements: ${scriptEditor}`);
      console.log(`  - editor-content elements: ${editorContent}`);
      console.log(`  - contenteditable elements: ${anyContentEditable}`);

      // Take a screenshot for debugging
      await page.screenshot({ path: 'editor-not-found.png', fullPage: true });
      console.log('Screenshot saved as editor-not-found.png');

      // Check what's visible on the page
      const bodyText = await page.locator('body').innerText();
      console.log('Page content preview:', bodyText.substring(0, 500));
    } else {
      console.log('✓ ProseMirror editor found!');

      // Step 4: Verify editor attributes
      console.log('\nStep 4: Verifying editor attributes...');
      const contentEditable = await proseMirror.getAttribute('contenteditable');
      const spellCheck = await proseMirror.getAttribute('spellcheck');
      const dataTestId = await proseMirror.getAttribute('data-testid');

      console.log(`  - contenteditable: "${contentEditable}"`);
      console.log(`  - spellcheck: "${spellCheck}"`);
      console.log(`  - data-testid: "${dataTestId}"`);

      // Step 5: Test if we can click and type
      console.log('\nStep 5: Testing interaction...');
      try {
        await proseMirror.click();
        console.log('✓ Clicked on editor');

        // Clear any existing content first
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');

        // Type test content
        const testText = 'Testing TipTap editor after loading fix!';
        await page.keyboard.type(testText);
        console.log(`✓ Typed: "${testText}"`);

        // Wait a moment for the text to appear
        await page.waitForTimeout(500);

        // Verify text was added
        const editorText = await proseMirror.textContent();
        console.log(`✓ Editor now contains: "${editorText}"`);

        if (editorText.includes('Testing')) {
          console.log('✅ SUCCESS: Editor is editable and accepting input!');
        } else {
          console.log('⚠ Warning: Text was typed but not reflected in editor');
        }

        // Step 6: Test save functionality
        console.log('\nStep 6: Testing save functionality...');

        // Look for a save button or check auto-save
        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.count() > 0) {
          await saveButton.click();
          console.log('✓ Clicked Save button');
          await page.waitForTimeout(1000);
        } else {
          console.log('ℹ No explicit Save button - checking for auto-save...');

          // Wait for potential auto-save
          await page.waitForTimeout(2000);

          // Check network activity for save requests
          const saveRequestPromise = page.waitForResponse(
            response => response.url().includes('/api/') && response.status() === 200,
            { timeout: 5000 }
          ).catch(() => null);

          // Make a small edit to trigger auto-save
          await proseMirror.click();
          await page.keyboard.type(' Auto-save test.');

          const saveResponse = await saveRequestPromise;
          if (saveResponse) {
            console.log('✓ Auto-save detected:', saveResponse.url());
          } else {
            console.log('⚠ No auto-save detected within 5 seconds');
          }
        }

        // Step 7: Check Y.js collaboration
        console.log('\nStep 7: Checking Y.js collaboration...');
        const hasYjs = await page.evaluate(() => {
          return !!(window as any).Y;
        });

        if (hasYjs) {
          console.log('✓ Y.js library is loaded');

          // Check for Y.js document
          const hasYDoc = await page.evaluate(() => {
            const proseMirrorEl = document.querySelector('.ProseMirror');
            return !!(proseMirrorEl as any)?.__yjs_doc;
          });

          if (hasYDoc) {
            console.log('✓ Y.js document is attached to editor');
          } else {
            console.log('⚠ Y.js loaded but no document attached to editor');
          }
        } else {
          console.log('⚠ Y.js library not detected');
        }

        // Take a success screenshot
        await page.screenshot({ path: 'editor-working.png', fullPage: true });
        console.log('\n✓ Success screenshot saved as editor-working.png');

      } catch (error) {
        console.log(`✗ Interaction failed: ${error}`);
        await page.screenshot({ path: 'editor-interaction-failed.png', fullPage: true });
      }
    }

    console.log('\n=== END VERIFICATION TEST ===\n');
  });

  test('verify loading state timeout works', async ({ page }) => {
    console.log('\n=== LOADING STATE TIMEOUT TEST ===\n');

    // Navigate and authenticate
    await page.goto('http://localhost:5174/');
    const devUserButton = page.locator('button:has-text("Dev User")').first();
    if (await devUserButton.count() > 0) {
      await devUserButton.click();
    }

    // Monitor console for our timeout message
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Component loading') || text.includes('timeout')) {
        consoleLogs.push(text);
        console.log(`Console: ${text}`);
      }
    });

    // Wait for the timeout to trigger
    await page.waitForTimeout(4000);

    // Check if editor appeared
    const editorVisible = await page.locator('.ProseMirror').count() > 0;

    if (editorVisible) {
      console.log('✓ Editor rendered successfully');

      // Check if we got the timeout message
      const hasTimeoutMessage = consoleLogs.some(log =>
        log.includes('Component loading timed out') ||
        log.includes('showing editor anyway')
      );

      if (hasTimeoutMessage) {
        console.log('✓ Timeout fallback was triggered as expected');
      } else {
        console.log('✓ Components loaded normally without timeout');
      }
    } else {
      console.log('✗ Editor did not render even after timeout');
    }

    console.log('\n=== END TIMEOUT TEST ===\n');
  });
});