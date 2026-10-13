import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Default selectors and exclusions on real site structures.
 *
 * Each fixture in tests/fixtures/sites is the rendered DOM of a real article
 * with all text replaced by lorem ipsum (see generate.mjs there). The
 * article body text blocks carry data-fx-body and the headline
 * data-fx-neutral. The test summarizes the page with the built script and
 * the default rules, then measures the text sent to the API:
 *   recall    - share of the body text that was sent
 *   precision - share of the sent text that is body text (headline not counted)
 */

const scriptPath = process.env.SCRIPT_PATH || join(process.cwd(), 'dist', 'summarize-the-web.js');
const fixtureDir = join(process.cwd(), 'tests', 'fixtures', 'sites');

function getScriptContent() {
  const content = readFileSync(scriptPath, 'utf-8');
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

// Minimum scores for every site. A site whose structure the defaults cannot
// handle yet can get a lower precision floor here, with the reason.
const TARGET = { recall: 0.95, precision: 0.85 };
const BELOW_TARGET_PRECISION = {};

const fixtures = readdirSync(fixtureDir).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));

test.describe('Default rules on real site structures', () => {
  for (const site of fixtures) {
    test(site, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.setContent(readFileSync(join(fixtureDir, `${site}.html`), 'utf-8'));
      await page.evaluate(gmMocks);
      await page.addScriptTag({ content: getScriptContent() });
      await page.locator('.summarizer-btn[data-size="large"]').click();
      await page.waitForFunction(() => window.__sent !== null);

      const score = await page.evaluate(() => {
        const norm = (s) => s.replace(/\s+/g, ' ').trim();
        // The article text is the longest string in the request body
        const strings = [];
        const walk = (v) => typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(walk);
        walk(JSON.parse(window.__sent));
        const sent = norm(strings.sort((a, b) => b.length - a.length)[0]);

        const blocks = [...document.querySelectorAll('[data-fx-body]')].map(el => norm(el.innerText)).filter(t => t.length >= 20);
        const bodyChars = blocks.reduce((n, t) => n + t.length, 0);
        const foundChars = blocks.filter(t => sent.includes(t)).reduce((n, t) => n + t.length, 0);
        const neutral = [...document.querySelectorAll('[data-fx-neutral]')].map(el => norm(el.innerText)).filter(t => sent.includes(t));
        const counted = sent.length - neutral.reduce((n, t) => n + t.length, 0);
        return {
          recall: bodyChars ? foundChars / bodyChars : 0,
          precision: counted > 0 ? foundChars / counted : 0,
          sentChars: sent.length,
          bodyChars
        };
      });

      const fmt = (x) => x.toFixed(2);
      console.log(`SITE ${site}: recall ${fmt(score.recall)}, precision ${fmt(score.precision)}, sent ${score.sentChars} chars, body ${score.bodyChars} chars`);
      expect(score.recall, 'share of the article body sent').toBeGreaterThanOrEqual(TARGET.recall);
      expect(score.precision, 'share of the sent text that is article body')
        .toBeGreaterThanOrEqual(BELOW_TARGET_PRECISION[site] ?? TARGET.precision);
    });
  }
});
