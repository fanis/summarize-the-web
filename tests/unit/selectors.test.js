import { describe, it, expect, vi } from 'vitest';
import {
  globToRegExp,
  domainPatternToRegex,
  listMatchesHost,
  compiledSelectors,
  findMatchingSelectors,
  findMatchingExclusions,
  generateCSSSelector
} from '../../src/modules/selectors.js';
import { createTestDOM } from '../setup.js';

describe('Selector Utilities', () => {
  describe('globToRegExp', () => {
    it('should convert simple glob to regex', () => {
      const regex = globToRegExp('*.example.com');

      expect(regex.test('www.example.com')).toBe(true);
      expect(regex.test('sub.example.com')).toBe(true);
      expect(regex.test('example.com')).toBe(false);
    });

    it('should handle exact match without wildcards', () => {
      const regex = globToRegExp('example.com');

      expect(regex.test('example.com')).toBe(true);
      expect(regex.test('www.example.com')).toBe(false);
    });

    it('should handle question mark wildcard', () => {
      const regex = globToRegExp('example?.com');

      expect(regex.test('example1.com')).toBe(true);
      expect(regex.test('examplex.com')).toBe(true);
      expect(regex.test('example.com')).toBe(false);
    });

    it('should be case insensitive', () => {
      const regex = globToRegExp('EXAMPLE.COM');

      expect(regex.test('example.com')).toBe(true);
      expect(regex.test('EXAMPLE.COM')).toBe(true);
    });
  });

  describe('domainPatternToRegex', () => {
    it('should handle regex literal pattern', () => {
      const regex = domainPatternToRegex('/^example\\.com$/');

      expect(regex.test('example.com')).toBe(true);
      expect(regex.test('notexample.com')).toBe(false);
    });

    it('should return null for empty pattern', () => {
      expect(domainPatternToRegex('')).toBeNull();
      expect(domainPatternToRegex('   ')).toBeNull();
    });

    it('should return null for invalid regex', () => {
      expect(domainPatternToRegex('/[invalid/')).toBeNull();
    });

    it('should handle glob wildcards', () => {
      const regex = domainPatternToRegex('*.google.com');

      expect(regex.test('www.google.com')).toBe(true);
      expect(regex.test('mail.google.com')).toBe(true);
    });

    it('should handle exact domain with subdomain support', () => {
      const regex = domainPatternToRegex('example.com');

      expect(regex.test('example.com')).toBe(true);
      expect(regex.test('www.example.com')).toBe(true);
      expect(regex.test('sub.example.com')).toBe(true);
      expect(regex.test('notexample.com')).toBe(false);
    });
  });

  describe('listMatchesHost', () => {
    it('should match against exact domain', () => {
      const list = ['example.com', 'test.org'];

      expect(listMatchesHost(list, 'example.com')).toBe(true);
      expect(listMatchesHost(list, 'www.example.com')).toBe(true);
      expect(listMatchesHost(list, 'other.com')).toBe(false);
    });

    it('should match against glob patterns', () => {
      const list = ['*.google.com'];

      expect(listMatchesHost(list, 'www.google.com')).toBe(true);
      expect(listMatchesHost(list, 'mail.google.com')).toBe(true);
      expect(listMatchesHost(list, 'google.com')).toBe(false);
    });

    it('should return false for empty list', () => {
      expect(listMatchesHost([], 'example.com')).toBe(false);
    });

    it('should skip invalid patterns', () => {
      const list = ['', 'example.com'];

      expect(listMatchesHost(list, 'example.com')).toBe(true);
    });
  });

  describe('compiledSelectors', () => {
    it('should join selectors with comma', () => {
      const result = compiledSelectors(['article', '.content', '#main']);

      expect(result).toBe('article,.content,#main');
    });

    it('should filter out empty strings', () => {
      const result = compiledSelectors(['article', '', '.content', null, '#main']);

      expect(result).toBe('article,.content,#main');
    });

    it('should return empty string for empty array', () => {
      expect(compiledSelectors([])).toBe('');
    });
  });

  describe('findMatchingSelectors', () => {
    it('should find matching selectors', () => {
      const container = createTestDOM('<article class="post content" id="main">Test</article>');
      const el = container.querySelector('article');

      const matches = findMatchingSelectors(el, ['article', '.post', '#main', '.nonexistent']);

      expect(matches).toContain('article');
      expect(matches).toContain('.post');
      expect(matches).toContain('#main');
      expect(matches).not.toContain('.nonexistent');
    });

    it('should return empty array for no matches', () => {
      const container = createTestDOM('<div>Test</div>');
      const el = container.querySelector('div');

      const matches = findMatchingSelectors(el, ['article', '.post']);

      expect(matches).toEqual([]);
    });

    it('should skip invalid selectors', () => {
      const container = createTestDOM('<div class="test">Test</div>');
      const el = container.querySelector('div');

      const matches = findMatchingSelectors(el, ['.test', '[invalid']);

      expect(matches).toEqual(['.test']);
    });
  });

  describe('findMatchingExclusions', () => {
    it('should find matching self exclusions', () => {
      const container = createTestDOM('<nav class="sidebar">Test</nav>');
      const el = container.querySelector('nav');

      const matches = findMatchingExclusions(el, {
        self: ['nav', '.sidebar', '.nonexistent'],
        ancestors: []
      });

      expect(matches.self).toContain('nav');
      expect(matches.self).toContain('.sidebar');
      expect(matches.self).not.toContain('.nonexistent');
    });

    it('should find matching ancestor exclusions', () => {
      const container = createTestDOM('<nav><div class="menu"><span id="item">Test</span></div></nav>');
      const el = container.querySelector('#item');

      const matches = findMatchingExclusions(el, {
        self: [],
        ancestors: ['nav', '.menu', 'footer']
      });

      expect(matches.ancestors).toContain('nav');
      expect(matches.ancestors).toContain('.menu');
      expect(matches.ancestors).not.toContain('footer');
    });

    it('should return empty arrays for no matches', () => {
      const container = createTestDOM('<article>Test</article>');
      const el = container.querySelector('article');

      const matches = findMatchingExclusions(el, {
        self: ['nav', 'footer'],
        ancestors: ['header', 'aside']
      });

      expect(matches.self).toEqual([]);
      expect(matches.ancestors).toEqual([]);
    });
  });

  describe('generateCSSSelector', () => {
    it('should return ID selector if element has ID', () => {
      const container = createTestDOM('<div id="unique">Test</div>');
      const el = container.querySelector('#unique');

      const selector = generateCSSSelector(el);

      expect(selector).toBe('#unique');
    });

    it('should return tag with classes if no ID', () => {
      const container = createTestDOM('<article class="post featured">Test</article>');
      const el = container.querySelector('article');

      const selector = generateCSSSelector(el);

      expect(selector).toBe('article.post.featured');
    });

    it('should generate path selector for plain elements', () => {
      const container = createTestDOM('<div><span><em>Test</em></span></div>');
      const el = container.querySelector('em');

      const selector = generateCSSSelector(el);

      expect(selector).toContain('em');
    });
  });
});
