# Visual Testing with Playwright

This directory contains visual regression tests using Playwright's built-in screenshot comparison capabilities.

## Quick Start

```bash
# Start development server and run visual tests
npm run test:visual

# Run tests with browser UI (great for debugging)
npm run test:visual:headed

# Update baseline screenshots when UI changes are intentional
npm run test:visual:update

# View detailed HTML test report
npm run test:visual:report
```

## How Visual Testing Works

1. **First Run**: Creates baseline screenshots stored in `tests/visual/`
2. **Subsequent Runs**: Compares new screenshots against baselines
3. **Failures**: Generates diff images showing exactly what changed
4. **Updates**: Use `--update-snapshots` to accept new visual changes

## Visual Test Architecture

### Anti-Flake Measures
- Disabled animations and transitions
- Consistent timezone (UTC) and locale (en-US)
- Masked dynamic content (timestamps, user avatars)
- Network idle waiting for complete loading
- Deterministic fonts and rendering

### Browser Coverage
Tests run across:
- Chromium (Chrome)
- Firefox
- WebKit (Safari)

### Test Organization

- `homepage.spec.ts` - Main page layout and responsive behavior
- `component-gallery.spec.ts` - Individual UI components
- `visual-helper.ts` - Utilities for stable screenshot capture

## Debugging Visual Failures

When a visual test fails:

1. **View the HTML Report**: `npm run test:visual:report`
2. **Check Diff Images**: Look for `*-diff.png` files highlighting changes
3. **Use Trace Viewer**: Click trace links in HTML report for step-by-step debugging
4. **Run Headed**: Use `npm run test:visual:headed` to see tests run in real browsers

## AI-Assisted Debugging

Playwright's HTML report includes "Copy Prompt" and "Fix with AI" features:
- Click these to get LLM-ready context with DOM snapshots, console logs, and network traces
- Perfect for Claude Code to auto-propose fixes

## Adding New Visual Tests

```typescript
import { test, expect } from '@playwright/test';
import { VisualHelper } from './visual-helper';

test('my component visual test', async ({ page }) => {
  const visualHelper = new VisualHelper(page);
  await page.goto('/my-component');

  // Stable screenshot with automatic masking
  await visualHelper.takeStableScreenshot(
    page.locator('.my-component'),
    'my-component.png'
  );
});
```

## Best Practices

### DO:
- Use `VisualHelper.takeStableScreenshot()` for automatic anti-flake measures
- Screenshot components individually rather than full pages when possible
- Use descriptive filenames that include component/page names
- Update baselines immediately when intentional UI changes are made

### DON'T:
- Screenshot content with user data or timestamps without masking
- Ignore visual test failures - they reveal real regressions
- Use `--update-snapshots` without reviewing what changed first
- Test dynamic content that changes between runs

## Accessibility Testing

Visual tests also include accessibility validation using @axe-core/playwright:
- Automatically checks WCAG compliance
- Fails tests on accessibility violations
- Provides detailed reports on issues found

## CI/CD Integration

Visual tests are designed to run in CI environments:
- Deterministic rendering across environments
- Headless-first configuration
- Retry logic for flaky network conditions
- Artifact collection (traces, videos, screenshots) on failure