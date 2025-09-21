import { Page, Locator } from '@playwright/test';

export class VisualHelper {
  constructor(private page: Page) {}

  /**
   * Takes a stable screenshot with anti-flake measures
   */
  async takeStableScreenshot(
    locator: Locator | Page,
    filename: string,
    options: {
      maskDynamic?: boolean;
      waitForAnimations?: boolean;
      waitForFonts?: boolean;
    } = {}
  ) {
    const {
      maskDynamic = true,
      waitForAnimations = true,
      waitForFonts = true,
    } = options;

    // Wait for fonts to load
    if (waitForFonts) {
      await this.page.evaluate(() => document.fonts.ready);
    }

    // Wait for animations to complete
    if (waitForAnimations) {
      await this.page.waitForTimeout(300);
    }

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');

    // Mask dynamic content
    const maskSelectors = maskDynamic
      ? [
          this.page.locator('.timestamp'),
          this.page.locator('.date-time'),
          this.page.locator('.user-avatar'),
          this.page.locator('.dynamic-id'),
          this.page.locator('[data-dynamic="true"]'),
        ]
      : [];

    return await locator.screenshot({
      path: filename,
      animations: 'disabled',
      mask: maskSelectors.filter(async (s) => (await s.count()) > 0),
    });
  }

  /**
   * Debug helper: Highlights elements and takes screenshot
   */
  async debugHighlight(selector: string, label: string) {
    await this.page.evaluate(
      ({ selector, label }) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el: any) => {
          el.style.outline = '3px solid red';
          el.style.outlineOffset = '2px';

          const labelEl = document.createElement('div');
          labelEl.textContent = label;
          labelEl.style.cssText = `
            position: absolute;
            background: red;
            color: white;
            padding: 4px 8px;
            font-size: 12px;
            z-index: 9999;
            top: -25px;
            left: 0;
          `;
          el.style.position = 'relative';
          el.appendChild(labelEl);
        });
      },
      { selector, label }
    );

    await this.page.screenshot({ path: `debug-${label.replace(/\s/g, '-')}.png` });
  }

  /**
   * Captures element dimensions and position for debugging
   */
  async captureElementMetrics(selector: string) {
    const element = this.page.locator(selector).first();

    if ((await element.count()) === 0) {
      return null;
    }

    const box = await element.boundingBox();
    const isVisible = await element.isVisible();
    const isEnabled = await element.isEnabled();
    const classes = await element.getAttribute('class');
    const computedStyle = await element.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
        overflow: style.overflow,
        opacity: style.opacity,
      };
    });

    return {
      selector,
      box,
      isVisible,
      isEnabled,
      classes,
      computedStyle,
    };
  }

  /**
   * Debug helper: Log all network requests during action
   */
  async captureNetworkDuringAction(
    action: () => Promise<void>,
    filter?: (url: string) => boolean
  ) {
    const requests: any[] = [];

    this.page.on('request', (request) => {
      if (!filter || filter(request.url())) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
        });
      }
    });

    this.page.on('response', (response) => {
      if (!filter || filter(response.url())) {
        const req = requests.find((r) => r.url === response.url());
        if (req) {
          req.status = response.status();
          req.statusText = response.statusText();
        }
      }
    });

    await action();

    return requests;
  }

  /**
   * Debug helper: Capture console logs during test
   */
  async captureConsoleMessages(
    action: () => Promise<void>,
    types: ('log' | 'error' | 'warning' | 'info')[] = ['error', 'warning']
  ) {
    const messages: any[] = [];

    this.page.on('console', (msg) => {
      if (types.includes(msg.type() as any)) {
        messages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    await action();

    return messages;
  }

  /**
   * Visual regression helper: Compare with baseline with tolerance
   */
  async compareWithBaseline(
    locator: Locator,
    baselineName: string,
    tolerance: number = 0.2
  ) {
    return await locator.screenshot({
      animations: 'disabled',
      path: `tests/visual/screenshots/${baselineName}`,
      threshold: tolerance,
    });
  }

  /**
   * Debug helper: Capture full page state
   */
  async capturePageState(label: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stateDir = `tests/visual/debug/${timestamp}-${label}`;

    // Full page screenshot
    await this.page.screenshot({
      path: `${stateDir}/full-page.png`,
      fullPage: true,
    });

    // Viewport screenshot
    await this.page.screenshot({
      path: `${stateDir}/viewport.png`,
      fullPage: false,
    });

    // Page HTML
    const html = await this.page.content();
    require('fs').writeFileSync(`${stateDir}/page.html`, html);

    // Page title and URL
    const metadata = {
      title: await this.page.title(),
      url: this.page.url(),
      viewport: await this.page.viewportSize(),
      timestamp,
    };
    require('fs').writeFileSync(
      `${stateDir}/metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    return stateDir;
  }

  /**
   * Helper to wait for React/Vue component to be ready
   */
  async waitForFrameworkReady() {
    // Wait for React
    await this.page.evaluate(() => {
      return new Promise((resolve) => {
        if ((window as any).React && (window as any).ReactDOM) {
          // React is loaded
          setTimeout(resolve, 100);
        } else {
          resolve(true);
        }
      });
    });

    // Wait for any pending promises
    await this.page.evaluate(() => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  /**
   * Debug helper: Check for UI issues
   */
  async checkForUIIssues() {
    const issues = [];

    // Check for elements outside viewport
    const overflowing = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter((el: any) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.right > window.innerWidth ||
            rect.left < 0 ||
            el.scrollWidth > el.clientWidth
          );
        })
        .map((el: any) => ({
          tag: el.tagName,
          class: el.className,
          overflow: el.scrollWidth > el.clientWidth,
        }));
    });

    if (overflowing.length > 0) {
      issues.push({ type: 'overflow', elements: overflowing });
    }

    // Check for invisible but space-taking elements
    const invisible = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter((el: any) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.opacity === '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden'
          );
        })
        .map((el: any) => ({
          tag: el.tagName,
          class: el.className,
        }));
    });

    if (invisible.length > 0) {
      issues.push({ type: 'invisible-space', elements: invisible });
    }

    return issues;
  }
}