import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { log, escapeHtml, parseLines, normalizeSpace, textTrim } from '../../src/modules/utils.js';

describe('Utility Functions', () => {
  describe('log', () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should not log when DEBUG is false', () => {
      log('Test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('2 > 1')).toBe('2 &gt; 1');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's mine")).toBe("It&#39;s mine");
    });

    it('should escape multiple special chars', () => {
      expect(escapeHtml('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should handle normal text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should convert non-string to string', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(null)).toBe('null');
    });
  });

  describe('parseLines', () => {
    it('should split by newlines', () => {
      expect(parseLines('line1\nline2\nline3')).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split by commas', () => {
      expect(parseLines('item1,item2,item3')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should split by semicolons', () => {
      expect(parseLines('item1;item2;item3')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle mixed separators', () => {
      expect(parseLines('item1\nitem2,item3;item4')).toEqual(['item1', 'item2', 'item3', 'item4']);
    });

    it('should trim whitespace from items', () => {
      expect(parseLines('  item1  \n  item2  ')).toEqual(['item1', 'item2']);
    });

    it('should filter out empty lines', () => {
      expect(parseLines('item1\n\n\nitem2')).toEqual(['item1', 'item2']);
    });

    it('should handle empty string', () => {
      expect(parseLines('')).toEqual([]);
    });

    it('should handle string with only separators', () => {
      expect(parseLines('\n,;')).toEqual([]);
    });
  });

  describe('normalizeSpace', () => {
    it('should collapse multiple spaces into one', () => {
      expect(normalizeSpace('hello    world')).toBe('hello world');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(normalizeSpace('  hello world  ')).toBe('hello world');
    });

    it('should handle newlines and tabs', () => {
      expect(normalizeSpace('hello\n\t  world')).toBe('hello world');
    });

    it('should handle multiple types of whitespace', () => {
      expect(normalizeSpace('  hello \n\n world \t test  ')).toBe('hello world test');
    });

    it('should handle empty string', () => {
      expect(normalizeSpace('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(normalizeSpace('   \n\t  ')).toBe('');
    });

    it('should handle normal text without extra spaces', () => {
      expect(normalizeSpace('hello world')).toBe('hello world');
    });
  });

  describe('textTrim', () => {
    it('should extract and normalize text content', () => {
      const node = { textContent: '  hello   world  ' };
      expect(textTrim(node)).toBe('hello world');
    });

    it('should handle empty textContent', () => {
      const node = { textContent: '' };
      expect(textTrim(node)).toBe('');
    });

    it('should handle null textContent', () => {
      const node = { textContent: null };
      expect(textTrim(node)).toBe('');
    });

    it('should handle node with nested whitespace', () => {
      const node = { textContent: 'hello\n\n  world\t\ttest' };
      expect(textTrim(node)).toBe('hello world test');
    });
  });
});
