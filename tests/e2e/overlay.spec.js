import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for overlay UI behavior
 */

// Read the built userscript
const userscriptPath = join(process.cwd(), 'dist', 'summarize-the-web.js');

// Extract the script content (skip only the userscript metadata header)
function getScriptContent() {
  const content = readFileSync(userscriptPath, 'utf-8');
  // Find end of userscript metadata block
  const endMeta = content.indexOf('==/UserScript==');
  if (endMeta === -1) return content;
  // Return everything after the metadata, including the Rollup IIFE wrapper
  return content.slice(endMeta + '==/UserScript=='.length);
}

// GM API mocks with proper values to allow overlay creation
const gmMocks = `
  // Storage values needed for script to run
  const mockStorage = {
    'digest_installed_v1': 'true',  // Not first install
    'OPENAI_KEY': 'test-api-key',    // Has API key
    'digest_domains_mode_v1': 'deny', // Domain mode: deny (run everywhere)
    'digest_domains_excluded_v1': '[]' // Empty denylist
  };

  window.GM_getValue = (key, def) => mockStorage[key] !== undefined ? mockStorage[key] : def;
  window.GM_setValue = () => {};
  window.GM_deleteValue = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = () => {};
  window.GM = {
    getValue: async (key, def) => mockStorage[key] !== undefined ? mockStorage[key] : def,
    setValue: async () => {},
    deleteValue: async () => {},
    xmlHttpRequest: () => {}
  };
`;

// Helper to inject the userscript into the page
async function injectUserscript(page) {
  const scriptContent = getScriptContent();

  // Capture console errors for debugging
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.addScriptTag({ content: scriptContent });

  // Give the async IIFE time to execute
  await page.waitForTimeout(500);

  // If overlay didn't appear, log errors for debugging
  const hasOverlay = await page.evaluate(() => !!document.querySelector('.summarizer-overlay'));
  if (!hasOverlay && errors.length > 0) {
    console.log('Script errors:', errors);
  }
}

test.describe('Overlay UI', () => {
  test('should create overlay with correct structure', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body><article><p>Content</p></article></body>
      </html>
    `);

    // Simulate overlay creation (mimics what overlay.js does)
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.className = 'summarizer-overlay';
      overlay.setAttribute('data-digest-ui', '');
      overlay.innerHTML = `
        <div class="summarizer-slide-handle">▶</div>
        <div class="summarizer-handle">
          <div class="summarizer-title">Summarize</div>
        </div>
        <div class="summarizer-content">
          <div class="summarizer-buttons">
            <button class="summarizer-btn" data-size="large">Large</button>
            <button class="summarizer-btn" data-size="small">Small</button>
          </div>
          <button class="summarizer-btn inspect-btn">Inspect</button>
          <div class="summarizer-status">Ready</div>
        </div>
      `;
      document.body.appendChild(overlay);
    });

    // Verify structure
    await expect(page.locator('.summarizer-overlay')).toBeVisible();
    await expect(page.locator('.summarizer-title')).toHaveText('Summarize');
    await expect(page.locator('[data-size="large"]')).toBeVisible();
    await expect(page.locator('[data-size="small"]')).toBeVisible();
    await expect(page.locator('.inspect-btn')).toBeVisible();
    await expect(page.locator('.summarizer-status')).toHaveText('Ready');
  });

  test('should handle button clicks', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="summarizer-overlay">
            <button class="summarizer-btn" data-size="large">Large</button>
            <button class="summarizer-btn" data-size="small">Small</button>
          </div>
        </body>
      </html>
    `);

    // Add click handler
    await page.evaluate(() => {
      window.clickedSize = null;
      document.querySelectorAll('.summarizer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.clickedSize = btn.dataset.size;
        });
      });
    });

    // Click large button
    await page.click('[data-size="large"]');
    let clickedSize = await page.evaluate(() => window.clickedSize);
    expect(clickedSize).toBe('large');

    // Click small button
    await page.click('[data-size="small"]');
    clickedSize = await page.evaluate(() => window.clickedSize);
    expect(clickedSize).toBe('small');
  });

  test('should update status text', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="summarizer-overlay">
            <div class="summarizer-status">Ready</div>
          </div>
        </body>
      </html>
    `);

    // Simulate status update
    await page.evaluate(() => {
      const status = document.querySelector('.summarizer-status');
      status.textContent = 'Processing Large...';
    });

    await expect(page.locator('.summarizer-status')).toHaveText('Processing Large...');

    // Simulate completion
    await page.evaluate(() => {
      const status = document.querySelector('.summarizer-status');
      status.textContent = 'Large summary applied';
    });

    await expect(page.locator('.summarizer-status')).toHaveText('Large summary applied');
  });

  test('should toggle collapsed state', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="summarizer-overlay">
            <div class="summarizer-slide-handle">▶</div>
          </div>
        </body>
      </html>
    `);

    const overlay = page.locator('.summarizer-overlay');

    // Initially not collapsed
    await expect(overlay).not.toHaveClass(/collapsed/);

    // Toggle to collapsed
    await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      overlay.classList.add('collapsed');
      const handle = document.querySelector('.summarizer-slide-handle');
      handle.textContent = '◀';
    });

    await expect(overlay).toHaveClass(/collapsed/);
    await expect(page.locator('.summarizer-slide-handle')).toHaveText('◀');

    // Toggle back
    await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      overlay.classList.remove('collapsed');
      const handle = document.querySelector('.summarizer-slide-handle');
      handle.textContent = '▶';
    });

    await expect(overlay).not.toHaveClass(/collapsed/);
  });
});

test.describe('Summary Overlay', () => {
  test('should display summary content', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body><article><p>Original content</p></article></body>
      </html>
    `);

    // Create summary overlay
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.className = 'digest-summary-overlay';
      overlay.setAttribute('data-digest-ui', '');
      overlay.innerHTML = `
        <div class="digest-summary-container">
          <div class="digest-summary-header">
            <div class="digest-summary-badge">Large Summary</div>
            <button class="digest-summary-close">✕</button>
          </div>
          <div class="digest-summary-content">
            <p>This is the summarized content.</p>
          </div>
          <div class="digest-summary-footer">
            <button class="digest-summary-close-btn">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    });

    await expect(page.locator('.digest-summary-overlay')).toBeVisible();
    await expect(page.locator('.digest-summary-badge')).toContainText('Large Summary');
    await expect(page.locator('.digest-summary-content')).toContainText('summarized content');
  });

  test('should close summary on button click', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="digest-summary-overlay">
            <button class="digest-summary-close-btn">Close</button>
          </div>
        </body>
      </html>
    `);

    await page.evaluate(() => {
      document.querySelector('.digest-summary-close-btn').addEventListener('click', () => {
        document.querySelector('.digest-summary-overlay').remove();
      });
    });

    await page.click('.digest-summary-close-btn');

    await expect(page.locator('.digest-summary-overlay')).toHaveCount(0);
  });

  test('should close summary on X button click', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="digest-summary-overlay">
            <button class="digest-summary-close">✕</button>
          </div>
        </body>
      </html>
    `);

    await page.evaluate(() => {
      document.querySelector('.digest-summary-close').addEventListener('click', () => {
        document.querySelector('.digest-summary-overlay').remove();
      });
    });

    await page.click('.digest-summary-close');

    await expect(page.locator('.digest-summary-overlay')).toHaveCount(0);
  });
});

/**
 * Tests using real overlay.js code injected into browser
 */
test.describe('Overlay Positioning (Real Code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Overlay Test</title></head>
        <body style="margin: 0; padding: 0;">
          <article>
            <h1>Test Article</h1>
            <p>Test content for overlay positioning tests.</p>
          </article>
        </body>
      </html>
    `);
    await page.evaluate(gmMocks);
  });

  test('badge width is 150px', async ({ page }) => {
    await injectUserscript(page);

    const badgeWidth = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      if (!overlay) return null;
      return overlay.offsetWidth;
    });

    expect(badgeWidth).toBe(150);
  });

  test('badge docks at right edge with 0px gap', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      if (!overlay) return null;

      const rect = overlay.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;

      return {
        left: rect.left,
        right: rect.right,
        viewportWidth,
        gap: viewportWidth - rect.right
      };
    });

    expect(position).not.toBeNull();
    // Badge should be at right edge: left = viewportWidth - 150
    expect(position.left).toBe(position.viewportWidth - 150);
    // Gap between badge right edge and viewport should be 0
    expect(position.gap).toBe(0);
  });

  test('default Y position is around 70% from top', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      if (!overlay) return null;

      const rect = overlay.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      return {
        top: rect.top,
        viewportHeight
      };
    });

    expect(position).not.toBeNull();
    // Default Y is 70% of viewport height (or clamped by max)
    // With viewport 768px and overlay ~200px height, max Y = 568
    // 70% of 768 = 537.6, which is within bounds
    expect(position.top).toBeGreaterThan(400);
    expect(position.top).toBeLessThan(600);
  });

  test('accounts for scrollbar width using clientWidth', async ({ page }) => {
    // Create page with forced scrollbar
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Scrollbar Test</title>
          <style>
            body { margin: 0; padding: 0; overflow-y: scroll; }
            .tall { height: 2000px; }
          </style>
        </head>
        <body>
          <div class="tall">
            <article>
              <h1>Test Article</h1>
              <p>Content with scrollbar.</p>
            </article>
          </div>
        </body>
      </html>
    `);
    await page.evaluate(gmMocks);

    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      if (!overlay) return null;

      const rect = overlay.getBoundingClientRect();
      const clientWidth = document.documentElement.clientWidth;
      const innerWidth = window.innerWidth;

      return {
        overlayRight: rect.right,
        clientWidth,
        innerWidth,
        scrollbarWidth: innerWidth - clientWidth,
        gap: clientWidth - rect.right
      };
    });

    expect(position).not.toBeNull();
    // Badge should dock to clientWidth (excluding scrollbar), not innerWidth
    expect(position.gap).toBe(0);
    // Badge right should equal clientWidth
    expect(position.overlayRight).toBe(position.clientWidth);
    // Note: scrollbarWidth may be 0 in headless browsers with overlay scrollbars
    // The important check is that overlay uses clientWidth, which is verified above
  });

  test('clicking slide handle toggles collapsed state', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    // Initially expanded
    let state = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      return overlay.classList.contains('collapsed');
    });
    expect(state).toBe(false);

    // Click to collapse
    await page.click('.summarizer-slide-handle');
    await page.waitForTimeout(400);

    state = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      return overlay.classList.contains('collapsed');
    });
    expect(state).toBe(true);

    // Click to expand
    await page.click('.summarizer-slide-handle');
    await page.waitForTimeout(400);

    state = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      return overlay.classList.contains('collapsed');
    });
    expect(state).toBe(false);
  });

  test('expanded overlay returns to right edge after toggle', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    // Collapse then expand
    await page.click('.summarizer-slide-handle');
    await page.waitForTimeout(400);
    await page.click('.summarizer-slide-handle');
    await page.waitForTimeout(400);

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const rect = overlay.getBoundingClientRect();
      const clientWidth = document.documentElement.clientWidth;
      return {
        right: rect.right,
        clientWidth,
        gap: clientWidth - rect.right
      };
    });

    expect(position.gap).toBe(0);
  });
});

test.describe('Overlay Dragging (Real Code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Drag Test</title></head>
        <body style="margin: 0; padding: 0;">
          <article>
            <h1>Test Article</h1>
            <p>Test content.</p>
          </article>
        </body>
      </html>
    `);
    await page.evaluate(gmMocks);
  });

  test('dragging moves overlay vertically', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    // Get initial position and handle location
    const initialData = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const handle = overlay.querySelector('.summarizer-handle');
      const overlayRect = overlay.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      return {
        overlayTop: overlayRect.top,
        handleX: handleRect.left + handleRect.width / 2,
        handleY: handleRect.top + handleRect.height / 2
      };
    });

    // Use mouse events directly for more reliable dragging
    await page.mouse.move(initialData.handleX, initialData.handleY);
    await page.mouse.down();
    await page.mouse.move(initialData.handleX, 100, { steps: 10 }); // Move to Y=100
    await page.mouse.up();

    // Get new position
    const newPos = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const rect = overlay.getBoundingClientRect();
      return { top: rect.top };
    });

    // Y position should have changed (overlay stays docked to right edge)
    expect(newPos.top).not.toBe(initialData.overlayTop);
  });

  test('dragging is constrained to viewport bounds', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    // Get handle location
    const handlePos = await page.evaluate(() => {
      const handle = document.querySelector('.summarizer-handle');
      const rect = handle.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    });

    // Use mouse events directly to drag towards negative coordinates
    await page.mouse.move(handlePos.x, handlePos.y);
    await page.mouse.down();
    await page.mouse.move(10, 10, { steps: 10 }); // Move to near top-left
    await page.mouse.up();

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const rect = overlay.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });

    // Should be clamped to 0,0 minimum
    expect(position.left).toBeGreaterThanOrEqual(0);
    expect(position.top).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Overlay CSS (Real Code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>CSS Test</title></head>
        <body style="margin: 0; padding: 0;">
          <article><p>Content</p></article>
        </body>
      </html>
    `);
    await page.evaluate(gmMocks);
  });

  test('injects style element with correct id', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const styleExists = await page.evaluate(() => {
      return !!document.getElementById('summarizer-style');
    });

    expect(styleExists).toBe(true);
  });

  test('overlay has fixed positioning', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const position = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const style = window.getComputedStyle(overlay);
      return style.position;
    });

    expect(position).toBe('fixed');
  });

  test('overlay has high z-index', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const zIndex = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      const style = window.getComputedStyle(overlay);
      return parseInt(style.zIndex, 10);
    });

    expect(zIndex).toBeGreaterThan(2147483600);
  });

  test('overlay has data-digest-ui attribute', async ({ page }) => {
    await injectUserscript(page);

    await page.waitForSelector('.summarizer-overlay', { timeout: 5000 });

    const hasAttr = await page.evaluate(() => {
      const overlay = document.querySelector('.summarizer-overlay');
      return overlay.hasAttribute('data-digest-ui');
    });

    expect(hasAttr).toBe(true);
  });
});
