/**
 * Generate structure-only fixtures of real article pages for tests/e2e/sites.spec.js.
 *
 * Loads each live article in Chromium and saves a reduced copy of the
 * rendered DOM: scripts, styles, media and CSS-hidden elements are removed,
 * every attribute except the ones selectors use is dropped, and every text
 * node is replaced with seeded lorem ipsum of the same length. The article
 * body text blocks (the site's `body` selector) are tagged data-fx-body and
 * the headline data-fx-neutral, so the test can measure what was extracted.
 *
 * Usage:
 *   node tests/fixtures/sites/generate.mjs              all sites
 *   node tests/fixtures/sites/generate.mjs bbc guardian some sites
 *   node tests/fixtures/sites/generate.mjs --inspect bbc  print body candidates
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_SELECTORS as DEFAULT_SELECTOR_LIST } from '../../../src/modules/config.js';

const DIR = dirname(fileURLToPath(import.meta.url));

// url: article to copy; body: selector for the article body text blocks
export const SITES = [
  { name: 'guardian', url: 'https://www.theguardian.com/us-news/2026/oct/13/geoffrey-hinton-trump-ai-tech', body: '.article-body-commercial-selector' },
  { name: 'bbc', url: 'https://www.bbc.com/news/articles/c9y7lgg2vdggo', body: 'main article [class*="LayoutBlock"]:has(> p)' },
  { name: 'cnn', url: 'https://edition.cnn.com/2026/10/12/us/six-flags-roller-coaster-death-georgia', body: '.article__content' },
  { name: 'arstechnica', url: 'https://arstechnica.com/ai/2026/10/inside-amazons-robotic-arms-race-and-what-it-means-for-the-future-of-human-work/', body: 'article .post-content' },
  { name: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Citro%C3%ABn_2CV', body: '#mw-content-text .mw-parser-output' },
  { name: 'substack', url: 'https://hannahritchie.substack.com/p/global-car-economy', body: '.available-content .body.markup' },
  { name: 'philenews', url: 'https://www.philenews.com/kosmos/article/1781548/sinagermos-sti-germania-eklise-to-aerodromio-tis-niremvergis-eurofighter-sinodefsan-ptisi-apo-tin-kerkira/', body: '.article-body' },
  { name: 'politis', url: 'https://www.politis.com.cy/politis-news/kosmos/1051209/h-oykrania-stamata-ta-plighmata-se-rosika-diilistiria-ghia-dyo-imeres-sinekhizontai-oi-epafes-ghia-energheiaki-ekekheiria-toy-tramp-leei-i-rosia', body: '.post-content-html' },
  { name: 'sigmalive', url: 'https://www.sigmalive.com/news/local/1333096/kikloforiako-komfouzio-ston-autokinitodromo-lemesou-pafoy-logho-odikwn-erghon', body: 'article .post-content' },
  { name: 'cyprus-mail', url: 'https://cyprus-mail.com/2026/10/13/cost-of-living-measures-risk-fuelling-inflation', body: '#articleBody' },
  { name: 'kathimerini', url: 'https://www.kathimerini.gr/economy/564519010/pierrakakis-ayxisi-toy-epidomatos-thermansis-kata-30/', body: '.entry-content' }
];


async function openArticle(browser, url) {
  const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  return { context, page };
}

// Print the deepest elements holding most of the paragraph text, and what the default selectors match
async function inspect(page) {
  return page.evaluate((selectors) => {
    const describe = (el) => {
      const parts = [];
      for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
        parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + [...n.classList].slice(0, 3).map(c => '.' + c).join(''));
      }
      return parts.join(' > ');
    };
    const paras = [...document.querySelectorAll('p')].filter(p => p.innerText.trim().length >= 60);
    const totals = new Map();
    let total = 0;
    for (const p of paras) {
      const len = p.innerText.trim().length;
      total += len;
      for (let a = p.parentElement; a && a !== document.documentElement; a = a.parentElement) totals.set(a, (totals.get(a) || 0) + len);
    }
    const holders = [...totals.entries()].filter(([, len]) => len >= total * 0.5)
      .sort((a, b) => describe(b[0]).split('>').length - describe(a[0]).split('>').length)
      .slice(0, 4).map(([el, len]) => `${Math.round(len / total * 100)}% ${describe(el)} (children: ${[...el.children].slice(0, 6).map(c => c.tagName.toLowerCase() + [...c.classList].slice(0, 2).map(x => '.' + x).join('')).join(', ')})`);
    const matches = selectors.map(s => {
      const els = [...document.querySelectorAll(s)];
      return els.length ? `${s}: ${els.length} match(es), longest ${Math.max(...els.map(e => e.innerText.trim().length))} chars` : null;
    }).filter(Boolean);
    const firstParents = paras.slice(0, 3).map(p => `${describe(p.parentElement)} :: ${p.innerText.trim().slice(0, 50)}`);
    return { paragraphs: paras.length, paragraphChars: total, holders, matches, firstParents };
  }, DEFAULT_SELECTOR_LIST);
}

// Build the structure-only copy of the rendered page
async function skeleton(page, site) {
  return page.evaluate(({ body }) => {
    // No default selector uses id, and ids often hold section titles
    const KEEP_ATTRS = new Set(['class', 'role', 'itemprop', 'itemtype', 'itemscope', 'lang', 'dir']);
    // Class tokens that carry page titles (e.g. Wikipedia's page-Citroën_2CV)
    const contentClass = (c) => /[^\x20-\x7e]/.test(c) || /^(root)?page-/.test(c);
    const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'IMG', 'PICTURE', 'SOURCE', 'VIDEO', 'AUDIO', 'CANVAS', 'LINK', 'META', 'OBJECT', 'EMBED', 'INPUT', 'SELECT', 'TEXTAREA']);
    const BLOCKS = 'p, li, h2, h3, h4, blockquote, pre, td, th, dd, dt';

    const bodyEls = new Set(body ? document.querySelectorAll(body) : []);
    const headline = document.querySelector('h1');

    // Seeded lorem ipsum, so a fixture is the same on every run for the same page
    let seed = 1;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
    const lorem = (length) => {
      let out = '';
      while (out.length < length) out += (out ? ' ' : '') + WORDS[Math.floor(rand() * WORDS.length)];
      return out.slice(0, length);
    };

    const copy = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const trimmed = text.trim();
        if (!trimmed) return document.createTextNode(text.includes('\n') ? '\n' : text ? ' ' : '');
        const lead = text.match(/^\s*/)[0] ? ' ' : '';
        const tail = text.match(/\s*$/)[0] ? ' ' : '';
        return document.createTextNode(lead + lorem(trimmed.length) + tail);
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const el = node;
      if (DROP_TAGS.has(el.tagName.toUpperCase())) return null;
      // CSS-hidden elements are never sent; without the site CSS they would show
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;

      const out = document.createElement(el.tagName.toLowerCase());
      for (const attr of el.attributes) {
        if (!KEEP_ATTRS.has(attr.name)) continue;
        const value = attr.name === 'class'
          ? attr.value.split(/\s+/).filter(c => c && !contentClass(c)).join(' ')
          : attr.value;
        if (value) out.setAttribute(attr.name, value);
      }
      if (el === headline) out.setAttribute('data-fx-neutral', '');
      const inBody = [...bodyEls].some(b => b.contains(el));
      if (inBody && el.matches(BLOCKS) && !el.parentElement.closest(BLOCKS)) out.setAttribute('data-fx-body', '');
      for (const child of el.childNodes) {
        const c = copy(child);
        if (c) out.appendChild(c);
      }
      return out;
    };

    const bodyCopy = copy(document.body);
    const lang = document.documentElement.getAttribute('lang') || 'en';
    return `<!DOCTYPE html>\n<html lang="${lang}">\n<head><meta charset="utf-8"><title>fixture</title></head>\n${bodyCopy.outerHTML}\n</html>\n`;
  }, { body: site.body });
}

async function main() {
  const args = process.argv.slice(2);
  const inspectMode = args[0] === '--inspect';
  const names = args.filter(a => !a.startsWith('--'));
  const sites = SITES.filter(s => names.length === 0 || names.includes(s.name));

  const browser = await chromium.launch();
  for (const site of sites) {
    const { context, page } = await openArticle(browser, site.url);
    try {
      if (inspectMode) {
        console.log(`=== ${site.name}`, JSON.stringify(await inspect(page), null, 2));
        continue;
      }
      if (!site.body) throw new Error('no body selector set');
      const bodyCount = await page.locator(site.body).count();
      if (bodyCount === 0) throw new Error(`body selector ${site.body} matches nothing`);
      const html = await skeleton(page, site);
      const header = `<!-- Structure-only fixture of ${site.url}, made ${new Date().toISOString().slice(0, 10)} by generate.mjs. All text is replaced with lorem ipsum; data-fx-body marks the article body (${site.body}). -->\n`;
      writeFileSync(join(DIR, `${site.name}.html`), header + html);
      console.log(`${site.name}: ${Math.round(html.length / 1024)} KB, body ${site.body} (${bodyCount})`);
    } catch (e) {
      console.log(`${site.name}: FAILED ${e.message}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
}

main();
