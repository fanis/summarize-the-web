import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Article extraction in a rendered page, using the built userscript and a
 * mocked API that records the request text
 */

const userscriptPath = join(process.cwd(), 'dist', 'summarize-the-web.js');

function getScriptContent() {
  const content = readFileSync(userscriptPath, 'utf-8');
  const endMeta = content.indexOf('==/UserScript==');
  if (endMeta === -1) return content;
  return content.slice(endMeta + '==/UserScript=='.length);
}

const gmMocks = `
  const mockStorage = {
    'digest_installed_v1': 'true',
    'OPENAI_KEY': 'test-api-key',
    'digest_model_v1': 'gpt-6-luna',
    'digest_domains_mode_v1': 'deny',
    'digest_domains_excluded_v1': '[]'
  };
  window.__sent = null;
  const reply = (opts) => {
    window.__sent = opts.data;
    setTimeout(() => opts.onload({ status: 200, responseText: JSON.stringify({ status: 'completed', output_text: 'Summary.' }) }), 10);
  };
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

// Summarize the page and return all string values of the API request body
async function summarizeAndGetRequestText(page) {
  await page.locator('.summarizer-btn[data-size="large"]').click();
  await page.waitForFunction(() => window.__sent !== null);
  return page.evaluate(() => {
    const strings = [];
    const walk = (v) => typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(walk);
    walk(JSON.parse(window.__sent));
    return strings.join('\n');
  });
}

const filler = 'This sentence makes the article long enough to pass the minimum text length check.';

test.describe('Article extraction (Real Code)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Extraction Test</title></head>
        <body>
          <article>
            <p>First paragraph ends here.</p><p>Second paragraph starts here. ${filler}</p>
            <script>var injected = "SCRIPT_TEXT";</script>
            <style>.x { color: red; } /* STYLE_TEXT */</style>
            <p style="display: none">HIDDEN_TEXT</p>
            <div class="sidebar" style="color: red;">SIDEBAR_TEXT</div>
            <div class="ad">AD_TEXT</div>
            <p>${filler}</p>
          </article>
        </body>
      </html>
    `);
    await page.evaluate(gmMocks);
    await page.addScriptTag({ content: getScriptContent() });
  });

  test('keeps paragraph breaks between adjacent paragraphs', async ({ page }) => {
    const text = await summarizeAndGetRequestText(page);
    expect(text).toContain('First paragraph ends here.');
    expect(text).not.toContain('here.Second');
    expect(text).toMatch(/ends here\.\s+Second paragraph/);
  });

  test('leaves out script, style and hidden text', async ({ page }) => {
    const text = await summarizeAndGetRequestText(page);
    expect(text).not.toContain('SCRIPT_TEXT');
    expect(text).not.toContain('STYLE_TEXT');
    expect(text).not.toContain('HIDDEN_TEXT');
  });

  test('leaves out excluded elements and restores their style attribute', async ({ page }) => {
    const text = await summarizeAndGetRequestText(page);
    expect(text).not.toContain('SIDEBAR_TEXT');
    expect(text).not.toContain('AD_TEXT');

    const styles = await page.evaluate(() => ({
      sidebar: document.querySelector('.sidebar').getAttribute('style'),
      ad: document.querySelector('.ad').getAttribute('style')
    }));
    expect(styles).toEqual({ sidebar: 'color: red;', ad: null });
  });
});
