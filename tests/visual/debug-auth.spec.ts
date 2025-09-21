import { test, expect } from '@playwright/test';

test.describe('Auth Debug Tests', () => {
  test('check Supabase connection and localStorage', async ({ page }) => {
    // Add console listener to capture logs
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    // Navigate to the app
    await page.goto('/');

    // Wait a bit for auth to initialize
    await page.waitForTimeout(2000);

    // Check localStorage for Supabase auth data
    const localStorage = await page.evaluate(() => {
      const items: Record<string, any> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.includes('supabase') || key && key.includes('eav')) {
          try {
            items[key] = JSON.parse(window.localStorage.getItem(key) || '{}');
          } catch {
            items[key] = window.localStorage.getItem(key);
          }
        }
      }
      return items;
    });

    console.log('LocalStorage Supabase items:', JSON.stringify(localStorage, null, 2));

    // Check if login form is visible
    const loginForm = page.locator('form').filter({ hasText: /sign in|login/i });
    const isLoginVisible = await loginForm.count() > 0;

    console.log('Login form visible:', isLoginVisible);

    // Check network requests to Supabase
    const supabaseRequests: any[] = [];

    page.on('request', request => {
      if (request.url().includes('supabase')) {
        supabaseRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('supabase')) {
        const req = supabaseRequests.find(r => r.url === response.url());
        if (req) {
          req.status = response.status();
          req.statusText = response.statusText();
          console.log(`Supabase request: ${req.method} ${req.url} => ${req.status} ${req.statusText}`);
        }
      }
    });

    // Reload to capture network traffic
    await page.reload();
    await page.waitForTimeout(3000);

    // Check if we can access Supabase client
    const supabaseCheck = await page.evaluate(() => {
      // @ts-ignore
      return typeof window.supabase !== 'undefined';
    });

    console.log('Supabase client available in window:', supabaseCheck);

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'tests/visual/debug-auth-state.png', fullPage: true });

    // Basic assertion to complete test
    expect(isLoginVisible).toBe(true);
  });

  test('test direct Supabase auth', async ({ page }) => {
    await page.goto('/');

    // Try to check Supabase auth directly
    const authState = await page.evaluate(async () => {
      try {
        // @ts-ignore
        if (window.supabase) {
          // @ts-ignore
          const { data, error } = await window.supabase.auth.getSession();
          return {
            hasClient: true,
            session: data?.session ? 'exists' : 'none',
            error: error?.message || null
          };
        }
        return { hasClient: false };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });

    console.log('Direct Supabase auth check:', authState);

    expect(authState).toBeDefined();
  });
});