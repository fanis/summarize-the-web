import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Summary overlay modal behavior, using the built userscript and a mocked API
 */

const userscriptPath = join(process.cwd(), 'dist', 'summarize-the-web.js');

function getScriptContent() {
  const content = readFileSync(userscriptPath, 'utf-8');
  const endMeta = content.indexOf('==/UserScript==');
  if (endMeta === -1) return content;
  return content.slice(endMeta + '==/UserScript=='.length);
}

const SUMMARY_TEXT = 'Summary paragraph one about the article.\n\nSummary paragraph two with more detail.';

// GM mocks: API key set, run everywhere, and a canned Responses API reply
const gmMocks = `
  const mockStorage = {
    'digest_installed_v1': 'true',
    'OPENAI_KEY': 'test-api-key',
    'digest_domains_mode_v1': 'deny',
    'digest_domains_excluded_v1': '[]'
  };
  const reply = (opts) => setTimeout(() => opts.onload({
    status: 200,
    responseText: JSON.stringify({ status: 'completed', output_text: ${JSON.stringify(SUMMARY_TEXT)} })
  }), 10);

  window.GM_getValue = (key, def) => mockStorage[key] !== undefined ? mockStorage[key] : def;
  window.GM_setValue = () => {};
  window.GM_deleteValue = () => {};
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = reply;
  window.GM = {
    getValue: async (key, def) => mockStorage[key] !== undefined ? mockStorage[key] : def,
    setValue: async () => {},
    deleteValue: async () => {},
    xmlHttpRequest: reply
  };
`;

const paragraphs = Array.from({ length: 12 }, (_, i) =>
  `<p>Page article paragraph ${i + 1}. This text belongs to the page behind the modal and must not be selectable while the summary is open.</p>`
).join('');

async function openSummary(page) {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>Summary Overlay Test</title></head>
      <body style="margin: 0; padding: 0;">
        <a id="page-link" href="#clicked" style="position: fixed; left: 10px; bottom: 10px;">Page link</a>
        <article><h1>Test Article</h1>${paragraphs}</article>
      </body>
    </html>
  `);
  await page.evaluate(gmMocks);
  await page.addScriptTag({ content: getScriptContent() });
  await page.locator('.summarizer-btn[data-size="large"]').click();
  await expect(page.locator('.summarizer-summary-content')).toContainText('Summary paragraph one');
}

const summaryOpen = (page) => page.locator('.summarizer-summary-overlay');

// A point on a page paragraph's text that lies left of the centered modal
async function pageTextPoint(page) {
  return page.evaluate(() => {
    const modalLeft = document.querySelector('[data-digest-ui]:last-of-type')
      .shadowRoot.querySelector('.summarizer-summary-overlay').getBoundingClientRect().left;
    for (const p of document.querySelectorAll('article p')) {
      const r = p.getClientRects()[0];
      if (r && r.top > 0 && r.bottom < innerHeight && r.left + 10 < modalLeft) {
        return { x: r.left + 10, y: r.top + r.height / 2, modalLeft };
      }
    }
    return null;
  });
}

test.describe('Summary overlay modal', () => {
  test('backdrop covers the page outside the summary', async ({ page }) => {
    await openSummary(page);
    // elementFromPoint returns the shadow host when the hit lands inside the overlay's shadow root
    const hit = await page.evaluate(() => {
      const el = document.elementFromPoint(5, 700);
      return el?.shadowRoot?.elementFromPoint(5, 700)?.className ?? el?.tagName;
    });
    expect(hit).toBe('summarizer-summary-backdrop');  });

  test('drag-select from the summary onto the backdrop does not select page text or close the summary', async ({ page }) => {
    await openSummary(page);
    const target = await pageTextPoint(page);
    expect(target).not.toBeNull();
    const box = await page.locator('.summarizer-summary-content p').first().boundingBox();
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();

    const selected = await page.evaluate(() => window.getSelection().toString());
    expect(selected).not.toContain('Page article paragraph');
    await expect(summaryOpen(page)).toHaveCount(1);
  });

  test('drag-select on the backdrop does not select page text', async ({ page }) => {
    await openSummary(page);
    const target = await pageTextPoint(page);
    expect(target).not.toBeNull();
    await page.mouse.move(target.x - 8, target.y);
    await page.mouse.down();
    await page.mouse.move(target.modalLeft - 5, target.y + 40, { steps: 10 });
    await page.mouse.up();

    const selected = await page.evaluate(() => window.getSelection().toString());
    expect(selected).not.toContain('Page article paragraph');
  });

  test('clicking the backdrop closes the summary without clicking page links', async ({ page }) => {
    await openSummary(page);
    const linkBox = await page.evaluate(() => {
      const r = document.getElementById('page-link').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(linkBox.x, linkBox.y);

    expect(await page.evaluate(() => location.hash)).toBe('');
    await expect(summaryOpen(page)).toHaveCount(0);
  });

  test('Ctrl+A selects the summary text only', async ({ page }) => {
    await openSummary(page);
    await page.keyboard.press('Control+A');

    const selected = await page.evaluate(() => window.getSelection().toString());
    expect(selected).toContain('Summary paragraph one');
    expect(selected).toContain('Summary paragraph two');
    expect(selected).not.toContain('Page article paragraph');
  });
});
