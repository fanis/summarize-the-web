import { describe, it, expect, afterEach } from 'vitest';
import { showSummaryHighlight, exitSummaryHighlight } from '../../src/modules/inspection.js';
import { createTestDOM } from '../setup.js';

describe('Inspection Module', () => {
  describe('showSummaryHighlight', () => {
    afterEach(() => {
      exitSummaryHighlight();
      document.body.innerHTML = '';
    });

    const message = () => document.getElementById('stw-highlight-message')?.textContent ?? '';

    // Hacker News comment markup: the first paragraph is a bare text node
    const hnComment = (n, extra = '') => `
      <div class="comment">
        <div class="commtext">Comment ${n} opens with a bare text node that is long enough.${extra}</div>
        <div class="reply"><p>reply link text</p></div>
      </div>`;
    const GLOBAL_EXCLUDE = { self: [], ancestors: ['.comment'] };
    const site = { selectors: ['.commtext'], exclude: { self: [], ancestors: [] } };

    it('reports every match of a site selector and marks text the summary will include', () => {
      createTestDOM([1, 2, 3].map(n => hnComment(n)).join(''));

      showSummaryHighlight(['.commtext'], GLOBAL_EXCLUDE, 50, site);

      expect(message()).toContain('Container: .commtext x 3');
      expect(message()).toContain('3 included (green), 0 excluded (red)');
    });

    it('marks excluded elements inside an included container', () => {
      createTestDOM(hnComment(1, '<p class="ad">Advertisement paragraph text</p>'));

      showSummaryHighlight(['.commtext'], { self: ['.ad'], ancestors: ['.comment'] }, 20, site);

      expect(message()).toContain('1 included (green), 1 excluded (red)');
    });

    it('still marks text elements inside a container that has its own text', () => {
      createTestDOM(`<main><span>Byline text in an inline element</span><p>First paragraph of the article body.</p><p>Second paragraph of the article body.</p></main>`);

      showSummaryHighlight(['main'], { self: [], ancestors: [] }, 20);

      expect(message()).toContain('3 included (green), 0 excluded (red)');
    });

    it('does not mark text excluded only by an ancestor outside the container', () => {
      createTestDOM(`<div class="comment"><div class="commtext"><p>First paragraph inside a paragraph element.</p><p>Second paragraph inside a paragraph element.</p></div></div>`);

      showSummaryHighlight(['.commtext'], GLOBAL_EXCLUDE, 20, site);

      expect(message()).toContain('2 included (green), 0 excluded (red)');
    });
  });
});
