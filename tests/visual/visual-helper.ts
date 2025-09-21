import { Page, Locator } from '@playwright/test';

/**
 * Visual testing helper utilities for Playwright
 */
export class VisualHelper {
  constructor(private page: Page) {}

  /**
   * Wait for all animations to complete and page to be stable
   */
  async waitForPageStable(): Promise<void> {
    await this.page.waitForLoadState('networkidle');

    // Wait for any remaining CSS animations/transitions
    await this.page.waitForFunction(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.animationName !== 'none' || computedStyle.transitionProperty !== 'none') {
          return false;
        }
      }
      return true;
    }, { timeout: 5000 }).catch(() => {
      // Continue if animations don't finish in 5s
    });
  }

  /**
   * Disable all animations on the page
   */
  async disableAnimations(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
        }
      `
    });
  }

  /**
   * Hide dynamic content that changes between test runs
   */
  async hideDynamicContent(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        .timestamp, .dynamic-content, .user-avatar,
        [data-testid*="timestamp"], [data-testid*="dynamic"],
        .relative-time, .last-updated {
          visibility: hidden !important;
        }
      `
    });
  }

  /**
   * Set consistent fonts to reduce rendering differences
   */
  async setConsistentFonts(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        * {
          font-family: 'Arial', sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
      `
    });
  }

  /**
   * Prepare page for visual testing with all stability measures
   */
  async prepareForVisualTest(): Promise<void> {
    await this.disableAnimations();
    await this.hideDynamicContent();
    await this.waitForPageStable();
  }

  /**
   * Take a screenshot with intelligent masking of dynamic content
   */
  async takeStableScreenshot(
    locator: Locator | Page,
    name: string,
    options: {
      additionalMasks?: string[];
      threshold?: number;
      fullPage?: boolean;
    } = {}
  ): Promise<void> {
    await this.prepareForVisualTest();

    const defaultMasks = [
      '.timestamp',
      '.dynamic-content',
      '.user-avatar',
      '[data-testid*="timestamp"]',
      '[data-testid*="dynamic"]'
    ];

    const allMasks = [...defaultMasks, ...(options.additionalMasks || [])];
    const maskLocators = allMasks.map(selector => this.page.locator(selector));

    const screenshotOptions = {
      animations: 'disabled' as const,
      threshold: options.threshold || 0.2,
      mask: maskLocators,
      fullPage: options.fullPage || false,
    };

    if ('toHaveScreenshot' in locator) {
      await expect(locator).toHaveScreenshot(name, screenshotOptions);
    } else {
      await expect(this.page).toHaveScreenshot(name, screenshotOptions);
    }
  }
}