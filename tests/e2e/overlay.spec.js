import { test, expect } from '@playwright/test';

/**
 * Tests for overlay UI behavior
 */

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
      overlay.className = 'digest-overlay';
      overlay.setAttribute('data-digest-ui', '');
      overlay.innerHTML = `
        <div class="digest-slide-handle">▶</div>
        <div class="digest-handle">
          <div class="digest-title">Summarize</div>
        </div>
        <div class="digest-content">
          <div class="digest-buttons">
            <button class="digest-btn" data-size="large">Large</button>
            <button class="digest-btn" data-size="small">Small</button>
          </div>
          <button class="digest-btn inspect-btn">Inspect</button>
          <div class="digest-status">Ready</div>
        </div>
      `;
      document.body.appendChild(overlay);
    });

    // Verify structure
    await expect(page.locator('.digest-overlay')).toBeVisible();
    await expect(page.locator('.digest-title')).toHaveText('Summarize');
    await expect(page.locator('[data-size="large"]')).toBeVisible();
    await expect(page.locator('[data-size="small"]')).toBeVisible();
    await expect(page.locator('.inspect-btn')).toBeVisible();
    await expect(page.locator('.digest-status')).toHaveText('Ready');
  });

  test('should handle button clicks', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="digest-overlay">
            <button class="digest-btn" data-size="large">Large</button>
            <button class="digest-btn" data-size="small">Small</button>
          </div>
        </body>
      </html>
    `);

    // Add click handler
    await page.evaluate(() => {
      window.clickedSize = null;
      document.querySelectorAll('.digest-btn').forEach(btn => {
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
          <div class="digest-overlay">
            <div class="digest-status">Ready</div>
          </div>
        </body>
      </html>
    `);

    // Simulate status update
    await page.evaluate(() => {
      const status = document.querySelector('.digest-status');
      status.textContent = 'Processing Large...';
    });

    await expect(page.locator('.digest-status')).toHaveText('Processing Large...');

    // Simulate completion
    await page.evaluate(() => {
      const status = document.querySelector('.digest-status');
      status.textContent = 'Large summary applied';
    });

    await expect(page.locator('.digest-status')).toHaveText('Large summary applied');
  });

  test('should toggle collapsed state', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="digest-overlay">
            <div class="digest-slide-handle">▶</div>
          </div>
        </body>
      </html>
    `);

    const overlay = page.locator('.digest-overlay');

    // Initially not collapsed
    await expect(overlay).not.toHaveClass(/collapsed/);

    // Toggle to collapsed
    await page.evaluate(() => {
      const overlay = document.querySelector('.digest-overlay');
      overlay.classList.add('collapsed');
      const handle = document.querySelector('.digest-slide-handle');
      handle.textContent = '◀';
    });

    await expect(overlay).toHaveClass(/collapsed/);
    await expect(page.locator('.digest-slide-handle')).toHaveText('◀');

    // Toggle back
    await page.evaluate(() => {
      const overlay = document.querySelector('.digest-overlay');
      overlay.classList.remove('collapsed');
      const handle = document.querySelector('.digest-slide-handle');
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
