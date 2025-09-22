import { Page } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Login to the application using test credentials
   */
  async login(email?: string, password?: string) {
    // Use test credentials from environment or defaults
    const testEmail = email || process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = password || process.env.TEST_USER_PASSWORD || 'testpassword123';

    console.log(`Attempting login with email: ${testEmail}`);

    // Go to the app
    await this.page.goto('/');

    // Wait for the login form to appear
    await this.page.waitForSelector('form', { timeout: 5000 });

    // Fill in email
    const emailInput = this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(testEmail);
    } else {
      // Try generic text input as fallback
      const inputs = await this.page.locator('input[type="text"]').all();
      if (inputs.length > 0) {
        await inputs[0].fill(testEmail);
      }
    }

    // Fill in password
    const passwordInput = this.page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]');
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(testPassword);
    }

    // Click submit button
    const submitButton = this.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")');
    if (await submitButton.count() > 0) {
      await submitButton.click();
    }

    // Wait for navigation or for the app to load
    // Look for elements that indicate successful login
    try {
      await this.page.waitForSelector('[data-testid="user-menu"], .user-menu, .app-container', {
        timeout: 10000
      });
      console.log('Login successful - app loaded');
    } catch (_error) {
      console.log('Login may have failed or app is slow to load');
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'tests/visual/debug-login-attempt.png' });
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for presence of login form vs app content
    const loginForm = await this.page.locator('form').filter({ hasText: /sign in|login/i }).count();
    const appContent = await this.page.locator('.app-container, [data-testid="app-content"]').count();

    return loginForm === 0 && appContent > 0;
  }

  /**
   * Logout from the application
   */
  async logout() {
    // Click on user menu if it exists
    const userMenu = this.page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Sign out")');
    if (await userMenu.count() > 0) {
      await userMenu.click();

      // Look for sign out option
      const signOutButton = this.page.locator('button:has-text("Sign out"), button:has-text("Logout"), a:has-text("Sign out")');
      if (await signOutButton.count() > 0) {
        await signOutButton.click();
      }
    }
  }

  /**
   * Setup authenticated state for tests
   * This can be used in beforeEach hooks
   */
  async setupAuthenticatedState() {
    const isLoggedIn = await this.isLoggedIn();
    if (!isLoggedIn) {
      await this.login();
    }
  }
}