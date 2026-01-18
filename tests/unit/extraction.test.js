import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractArticleBody, getTextToDigest, isExcluded, getSelectedText } from '../../src/modules/extraction.js';
import { DEFAULT_SELECTORS, DEFAULT_EXCLUDES, DEFAULT_MIN_TEXT_LENGTH } from '../../src/modules/config.js';
import { createTestDOM } from '../setup.js';

// Sample article text (must be > 100 chars for extraction to succeed)
const ARTICLE_TEXT = `This is a sample article with enough text to pass the minimum length check.
It contains multiple sentences and paragraphs to simulate real article content.
The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet.`;

const SHORT_TEXT = 'Too short';
const MIN_LENGTH = DEFAULT_MIN_TEXT_LENGTH;

describe('Extraction Module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('getSelectedText', () => {
    it('should return null when no selection', () => {
      // Mock empty selection
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => ''
      });

      const result = getSelectedText();

      expect(result).toBeNull();
    });

    it('should return error when selection is too short', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => 'Short text'
      });

      const result = getSelectedText(100);

      expect(result.error).toBe('selection_too_short');
      expect(result.actualLength).toBe(10);
      expect(result.minLength).toBe(100);
    });

    it('should return text when selection meets minLength', () => {
      const longText = 'A'.repeat(150);
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => longText
      });

      const result = getSelectedText(100);

      expect(result.error).toBeUndefined();
      expect(result.text).toBe(longText);
    });

    it('should use configurable minLength', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => 'Hello world'
      });

      // Should fail with default minLength
      const result1 = getSelectedText();
      expect(result1.error).toBe('selection_too_short');

      // Should succeed with low minLength
      const result2 = getSelectedText(5);
      expect(result2.error).toBeUndefined();
      expect(result2.text).toBe('Hello world');
    });
  });

  describe('isExcluded', () => {
    it('should return true for null element', () => {
      expect(isExcluded(null, { self: [], ancestors: [] })).toBe(true);
    });

    it('should exclude element matching self selector', () => {
      createTestDOM('<div class="sidebar">Content</div>');
      const el = document.querySelector('.sidebar');

      expect(isExcluded(el, { self: ['.sidebar'], ancestors: [] })).toBe(true);
    });

    it('should exclude element with matching ancestor', () => {
      createTestDOM('<nav><div class="menu"><span id="item">Text</span></div></nav>');
      const el = document.querySelector('#item');

      expect(isExcluded(el, { self: [], ancestors: ['nav'] })).toBe(true);
    });

    it('should not exclude element with no matches', () => {
      createTestDOM('<article><p id="content">Text</p></article>');
      const el = document.querySelector('#content');

      expect(isExcluded(el, { self: ['.sidebar'], ancestors: ['nav'] })).toBe(false);
    });

    it('should handle invalid selectors gracefully', () => {
      createTestDOM('<div class="test">Content</div>');
      const el = document.querySelector('.test');

      expect(isExcluded(el, { self: ['[invalid'], ancestors: [] })).toBe(false);
    });
  });

  describe('extractArticleBody', () => {
    describe('container detection', () => {
      it('should find article container with <article> tag', () => {
        createTestDOM(`<article>${ARTICLE_TEXT}</article>`);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('sample article');
      });

      it('should find container with itemprop="articleBody"', () => {
        createTestDOM(`<div itemprop="articleBody">${ARTICLE_TEXT}</div>`);

        const result = extractArticleBody(['[itemprop="articleBody"]'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('sample article');
      });

      it('should find container with .post-content class', () => {
        createTestDOM(`<div class="post-content">${ARTICLE_TEXT}</div>`);

        const result = extractArticleBody(['.post-content'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
      });

      it('should try selectors in order and use first match', () => {
        createTestDOM(`
          <main>Main content</main>
          <article>${ARTICLE_TEXT}</article>
        `);

        const result = extractArticleBody(['article', 'main'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('sample article');
      });

      it('should return error when no container found', () => {
        createTestDOM('<div>Random content</div>');

        const result = extractArticleBody(['.nonexistent'], { self: [], ancestors: [] });

        expect(result.error).toBe('no_container');
      });

      it('should handle invalid selectors gracefully', () => {
        createTestDOM(`<article>${ARTICLE_TEXT}</article>`);

        const result = extractArticleBody(['[invalid', 'article'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
      });
    });

    describe('text extraction with innerText', () => {
      it('should extract text from paragraphs', () => {
        createTestDOM(`
          <article>
            <p>First paragraph with enough content.</p>
            <p>Second paragraph with more content to read.</p>
            <p>Third paragraph completing the article text here.</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('First paragraph');
        expect(result.text).toContain('Second paragraph');
        expect(result.text).toContain('Third paragraph');
      });

      it('should extract text from headings (h1-h6)', () => {
        createTestDOM(`
          <article>
            <h1>Main Title</h1>
            <h2>Section Heading</h2>
            <h3>Subsection</h3>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('Main Title');
        expect(result.text).toContain('Section Heading');
        expect(result.text).toContain('Subsection');
      });

      it('should extract text from divs (non-semantic HTML)', () => {
        createTestDOM(`
          <article>
            <div>First div content here.</div>
            <div>Second div with text.</div>
            <div>${ARTICLE_TEXT}</div>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('First div content');
        expect(result.text).toContain('Second div');
      });

      it('should extract text from lists', () => {
        createTestDOM(`
          <article>
            <ul>
              <li>List item one</li>
              <li>List item two</li>
            </ul>
            <ol>
              <li>Ordered item one</li>
            </ol>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('List item one');
        expect(result.text).toContain('Ordered item one');
      });

      it('should extract text from blockquotes', () => {
        createTestDOM(`
          <article>
            <blockquote>A famous quote here.</blockquote>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('famous quote');
      });

      it('should extract text from tables', () => {
        createTestDOM(`
          <article>
            <table>
              <tr><th>Header</th></tr>
              <tr><td>Cell content</td></tr>
            </table>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.text).toContain('Header');
        expect(result.text).toContain('Cell content');
      });
    });

    describe('Gmail-style extraction', () => {
      it('should extract text from Gmail email body structure', () => {
        createTestDOM(`
          <div class="a3s aiL">
            <h3>Re: Meeting Notes</h3>
            <div>Hi team,</div>
            <div><br></div>
            <div>Here are the meeting notes from today:</div>
            <div>1. Project update completed</div>
            <div>2. Timeline adjusted</div>
            <div><br></div>
            <div>Thanks,</div>
            <div>John</div>
            <p>${ARTICLE_TEXT}</p>
          </div>
        `);

        const result = extractArticleBody(['.a3s.aiL'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('Meeting Notes');
        expect(result.text).toContain('Hi team');
        expect(result.text).toContain('Project update completed');
        expect(result.text).toContain('Thanks');
      });

      it('should handle Gmail quoted replies', () => {
        createTestDOM(`
          <div class="a3s aiL">
            <div>My response to your email.</div>
            <div class="gmail_quote">
              <div>Original message content here.</div>
            </div>
            <p>${ARTICLE_TEXT}</p>
          </div>
        `);

        const result = extractArticleBody(['.a3s.aiL'], { self: [], ancestors: [] });

        expect(result.text).toContain('My response');
        expect(result.text).toContain('Original message');
      });
    });

    describe('exclusion filtering', () => {
      it('should exclude elements matching self selectors', () => {
        createTestDOM(`
          <article>
            <p>${ARTICLE_TEXT}</p>
            <div class="advertisement">Buy our product!</div>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: ['.advertisement'],
          ancestors: []
        });

        expect(result.text).toContain('sample article');
        expect(result.text).not.toContain('Buy our product');
      });

      it('should exclude elements inside ancestor containers', () => {
        createTestDOM(`
          <article>
            <p>${ARTICLE_TEXT}</p>
            <aside class="sidebar">
              <p>Related articles sidebar content here.</p>
            </aside>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: [],
          ancestors: ['.sidebar']
        });

        expect(result.text).toContain('sample article');
        expect(result.text).not.toContain('Related articles');
      });

      it('should exclude navigation elements', () => {
        createTestDOM(`
          <article>
            <nav>
              <a href="#">Home</a>
              <a href="#">About</a>
            </nav>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: [],
          ancestors: ['nav']
        });

        expect(result.text).toContain('sample article');
        expect(result.text).not.toContain('Home');
        expect(result.text).not.toContain('About');
      });

      it('should exclude comments section', () => {
        createTestDOM(`
          <article>
            <p>${ARTICLE_TEXT}</p>
            <div class="comments">
              <div class="comment">Great article! Really enjoyed reading this.</div>
              <div class="comment">Thanks for sharing this information.</div>
            </div>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: [],
          ancestors: ['.comments']
        });

        expect(result.text).toContain('sample article');
        expect(result.text).not.toContain('Great article');
        expect(result.text).not.toContain('Thanks for sharing');
      });

      it('should exclude social share buttons', () => {
        createTestDOM(`
          <article>
            <p>${ARTICLE_TEXT}</p>
            <div class="social-share">
              <span>Share on Twitter</span>
              <span>Share on Facebook</span>
            </div>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: [],
          ancestors: ['.social-share']
        });

        expect(result.text).not.toContain('Share on Twitter');
      });

      it('should apply multiple exclusions', () => {
        createTestDOM(`
          <article>
            <nav><a>Menu</a></nav>
            <p>${ARTICLE_TEXT}</p>
            <aside class="sidebar">Sidebar content here</aside>
            <div class="comments">User comment here</div>
            <footer>Footer content here</footer>
          </article>
        `);

        const result = extractArticleBody(['article'], {
          self: [],
          ancestors: ['nav', '.sidebar', '.comments', 'footer']
        });

        expect(result.text).toContain('sample article');
        expect(result.text).not.toContain('Menu');
        expect(result.text).not.toContain('Sidebar content');
        expect(result.text).not.toContain('User comment');
        expect(result.text).not.toContain('Footer content');
      });
    });

    describe('with DEFAULT_SELECTORS and DEFAULT_EXCLUDES', () => {
      it('should extract from typical news article structure', () => {
        createTestDOM(`
          <header>Site Header</header>
          <nav>Navigation Menu</nav>
          <article>
            <h1>Breaking News Headline</h1>
            <p class="author-bio">By John Doe</p>
            <p>${ARTICLE_TEXT}</p>
            <div class="related">Related Articles</div>
          </article>
          <aside class="sidebar">Sidebar Ads</aside>
          <footer>Site Footer</footer>
        `);

        const result = extractArticleBody(DEFAULT_SELECTORS, DEFAULT_EXCLUDES);

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('Breaking News');
        expect(result.text).toContain('sample article');
        // These should be excluded by DEFAULT_EXCLUDES
        expect(result.text).not.toContain('Site Header');
        expect(result.text).not.toContain('Navigation Menu');
        expect(result.text).not.toContain('Sidebar Ads');
        expect(result.text).not.toContain('Site Footer');
      });

      it('should extract from blog post structure', () => {
        createTestDOM(`
          <div class="post-content">
            <h1>My Blog Post Title</h1>
            <p>${ARTICLE_TEXT}</p>
            <div class="comments">
              <p>Reader comment one here.</p>
              <p>Reader comment two here.</p>
            </div>
          </div>
        `);

        const result = extractArticleBody(DEFAULT_SELECTORS, DEFAULT_EXCLUDES);

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('Blog Post Title');
        expect(result.text).not.toContain('Reader comment');
      });
    });

    describe('title detection', () => {
      it('should find title with itemprop="headline"', () => {
        createTestDOM(`
          <article>
            <h1 itemprop="headline">The Main Headline</h1>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.title).not.toBeNull();
        expect(result.title.textContent).toBe('The Main Headline');
      });

      it('should find title with h1', () => {
        createTestDOM(`
          <article>
            <h1>Article Title Here</h1>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.title).not.toBeNull();
        expect(result.title.textContent).toBe('Article Title Here');
      });

      it('should find title with .article-title class', () => {
        createTestDOM(`
          <article>
            <div class="article-title">Custom Title Element</div>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.title).not.toBeNull();
        expect(result.title.textContent).toBe('Custom Title Element');
      });

      it('should not find title if too short', () => {
        createTestDOM(`
          <article>
            <h1>Short</h1>
            <p>${ARTICLE_TEXT}</p>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.title).toBeNull();
      });
    });

    describe('configurable minLength', () => {
      it('should use default minLength of 100', () => {
        createTestDOM(`<article><p>${SHORT_TEXT}</p></article>`);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBe('article_too_short');
        expect(result.minLength).toBe(MIN_LENGTH);
      });

      it('should accept custom minLength parameter', () => {
        createTestDOM(`<article><p>This is medium length text for testing.</p></article>`);

        // Should fail with high minLength
        const result1 = extractArticleBody(['article'], { self: [], ancestors: [] }, 500);
        expect(result1.error).toBe('article_too_short');
        expect(result1.minLength).toBe(500);

        // Should succeed with low minLength
        const result2 = extractArticleBody(['article'], { self: [], ancestors: [] }, 10);
        expect(result2.error).toBeUndefined();
        expect(result2.text).toContain('medium length');
      });

      it('should allow any text when minLength is 0', () => {
        createTestDOM(`<article><p>Hi</p></article>`);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] }, 0);

        expect(result.error).toBeUndefined();
        expect(result.text).toBe('Hi');
      });

      it('should include actualLength in error response', () => {
        createTestDOM(`<article><p>Exactly twenty chars</p></article>`);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] }, 100);

        expect(result.error).toBe('article_too_short');
        expect(result.actualLength).toBe(20);
        expect(result.minLength).toBe(100);
      });
    });

    describe('edge cases', () => {
      it('should return error for content below minimum length', () => {
        createTestDOM(`<article><p>${SHORT_TEXT}</p></article>`);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBe('article_too_short');
        expect(result.actualLength).toBeDefined();
        expect(result.minLength).toBe(MIN_LENGTH);
      });

      it('should return error for empty container', () => {
        createTestDOM('<article></article>');

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBe('no_text');
      });

      it('should return error for whitespace-only container', () => {
        createTestDOM('<article>   \n\t   </article>');

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBe('no_text');
      });

      it('should handle deeply nested content', () => {
        createTestDOM(`
          <article>
            <div><div><div><div>
              <p>${ARTICLE_TEXT}</p>
            </div></div></div></div>
          </article>
        `);

        const result = extractArticleBody(['article'], { self: [], ancestors: [] });

        expect(result.error).toBeUndefined();
        expect(result.text).toContain('sample article');
      });

      it('should not modify the original DOM', () => {
        createTestDOM(`
          <article>
            <p>${ARTICLE_TEXT}</p>
            <div class="ad">Advertisement</div>
          </article>
        `);

        extractArticleBody(['article'], { self: ['.ad'], ancestors: [] });

        // Original DOM should still have the ad
        expect(document.querySelector('.ad')).not.toBeNull();
        expect(document.querySelector('.ad').textContent).toBe('Advertisement');
      });
    });
  });

  describe('getTextToDigest', () => {
    beforeEach(() => {
      // Reset selection mock to return empty (no selection)
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => ''
      });
    });

    it('should return article text when no selection', () => {
      createTestDOM(`<article><p>${ARTICLE_TEXT}</p></article>`);

      const result = getTextToDigest(['article'], { self: [], ancestors: [] });

      expect(result.error).toBeUndefined();
      expect(result.source).toBe('article');
      expect(result.text).toContain('sample article');
    });

    it('should return error when no container found', () => {
      createTestDOM('<div>Random</div>');

      const result = getTextToDigest(['.nonexistent'], { self: [], ancestors: [] });

      expect(result.error).toBe('no_container');
      expect(result.source).toBe('article');
    });

    it('should include container reference', () => {
      createTestDOM(`<article id="main"><p>${ARTICLE_TEXT}</p></article>`);

      const result = getTextToDigest(['article'], { self: [], ancestors: [] });

      expect(result.container).not.toBeNull();
      expect(result.container.id).toBe('main');
    });

    it('should use configurable minLength', () => {
      createTestDOM(`<article><p>Short text here</p></article>`);

      const result = getTextToDigest(['article'], { self: [], ancestors: [] }, 500);

      expect(result.error).toBe('article_too_short');
      expect(result.minLength).toBe(500);
    });
  });
});
