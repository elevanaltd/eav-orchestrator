/**
 * ISOLATION TEST A: Test editor without Y.js Collaboration
 * This test verifies if the TipTap editor accepts input when Collaboration is disabled
 */

import { test, expect } from '@playwright/test';

test.describe('Isolation Test A - Editor without Collaboration', () => {
  test('should allow typing when Collaboration is disabled', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');

    // Use dev login to bypass auth
    const devLoginButton = page.getByRole('button', { name: 'Dev User (Internal) (dev@localhost)' });
    await expect(devLoginButton).toBeVisible({ timeout: 10000 });
    await devLoginButton.click();

    // Wait for editor to be visible
    await page.waitForSelector('.ProseMirror', { state: 'visible', timeout: 15000 });

    // Check console for our isolation test message
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (text.includes('ISOLATION TEST')) {
        console.log('Console:', text);
      }
    });

    // Get the editor element
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible();

    // Check if contenteditable is true
    const isContentEditable = await editor.getAttribute('contenteditable');
    console.log('✓ Editor contenteditable:', isContentEditable);
    expect(isContentEditable).toBe('true');

    // Click on the editor to focus it
    await editor.click();

    // Check if editor has focus
    const isFocused = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.classList.contains('ProseMirror') || false;
    });
    console.log('✓ Editor has focus:', isFocused);

    // Type test text
    const testText = 'ISOLATION TEST A: This text was typed without Y.js Collaboration!';
    await editor.type(testText);

    // Verify text was entered
    const content = await editor.textContent();
    console.log('✓ Editor content after typing:', content);

    // Check if the text includes our test message
    if (content?.includes(testText)) {
      console.log('🎉 SUCCESS: Editor accepts input without Collaboration!');
      console.log('   Y.js was blocking the input!');
    } else {
      console.log('❌ FAIL: Editor still not accepting input');
      console.log('   Problem is not Y.js Collaboration');
    }

    expect(content).toContain(testText);

    // Log all isolation test related console messages
    console.log('\n--- Console Messages ---');
    consoleMessages
      .filter(msg => msg.includes('ISOLATION'))
      .forEach(msg => console.log(msg));
  });
});