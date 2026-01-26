import { describe, it, expect } from 'vitest';
import {
  SUMMARY_FONT_SIZES,
  SUMMARY_LINE_HEIGHTS,
  STORAGE_KEYS,
  THEME_OPTIONS,
  DEFAULT_SHORTCUTS
} from '../../src/modules/config.js';

describe('Config Module', () => {
  describe('SUMMARY_FONT_SIZES', () => {
    it('has small, default, and large keys', () => {
      expect(SUMMARY_FONT_SIZES).toHaveProperty('small');
      expect(SUMMARY_FONT_SIZES).toHaveProperty('default');
      expect(SUMMARY_FONT_SIZES).toHaveProperty('large');
    });

    it('has correct pixel values', () => {
      expect(SUMMARY_FONT_SIZES.small).toBe(15);
      expect(SUMMARY_FONT_SIZES.default).toBe(17);
      expect(SUMMARY_FONT_SIZES.large).toBe(20);
    });

    it('values increase from small to large', () => {
      expect(SUMMARY_FONT_SIZES.small).toBeLessThan(SUMMARY_FONT_SIZES.default);
      expect(SUMMARY_FONT_SIZES.default).toBeLessThan(SUMMARY_FONT_SIZES.large);
    });
  });

  describe('SUMMARY_LINE_HEIGHTS', () => {
    it('has compact, default, and comfortable keys', () => {
      expect(SUMMARY_LINE_HEIGHTS).toHaveProperty('compact');
      expect(SUMMARY_LINE_HEIGHTS).toHaveProperty('default');
      expect(SUMMARY_LINE_HEIGHTS).toHaveProperty('comfortable');
    });

    it('has correct line-height values', () => {
      expect(SUMMARY_LINE_HEIGHTS.compact).toBe(1.5);
      expect(SUMMARY_LINE_HEIGHTS.default).toBe(1.8);
      expect(SUMMARY_LINE_HEIGHTS.comfortable).toBe(2.1);
    });

    it('values increase from compact to comfortable', () => {
      expect(SUMMARY_LINE_HEIGHTS.compact).toBeLessThan(SUMMARY_LINE_HEIGHTS.default);
      expect(SUMMARY_LINE_HEIGHTS.default).toBeLessThan(SUMMARY_LINE_HEIGHTS.comfortable);
    });
  });

  describe('STORAGE_KEYS for display settings', () => {
    it('has SUMMARY_FONT_SIZE key', () => {
      expect(STORAGE_KEYS.SUMMARY_FONT_SIZE).toBe('digest_summary_font_size_v1');
    });

    it('has SUMMARY_LINE_HEIGHT key', () => {
      expect(STORAGE_KEYS.SUMMARY_LINE_HEIGHT).toBe('digest_summary_line_height_v1');
    });

    it('has THEME key', () => {
      expect(STORAGE_KEYS.THEME).toBe('digest_theme_v1');
    });
  });

  describe('THEME_OPTIONS', () => {
    it('contains light, dark, and auto options', () => {
      expect(THEME_OPTIONS).toContain('light');
      expect(THEME_OPTIONS).toContain('dark');
      expect(THEME_OPTIONS).toContain('auto');
    });

    it('has exactly 3 options', () => {
      expect(THEME_OPTIONS).toHaveLength(3);
    });
  });

  describe('DEFAULT_SHORTCUTS', () => {
    it('has large and small shortcuts', () => {
      expect(DEFAULT_SHORTCUTS).toHaveProperty('large');
      expect(DEFAULT_SHORTCUTS).toHaveProperty('small');
    });

    it('large shortcut is Alt+Shift+L', () => {
      expect(DEFAULT_SHORTCUTS.large.key).toBe('L');
      expect(DEFAULT_SHORTCUTS.large.alt).toBe(true);
      expect(DEFAULT_SHORTCUTS.large.shift).toBe(true);
      expect(DEFAULT_SHORTCUTS.large.ctrl).toBe(false);
    });

    it('small shortcut is Alt+Shift+S', () => {
      expect(DEFAULT_SHORTCUTS.small.key).toBe('S');
      expect(DEFAULT_SHORTCUTS.small.alt).toBe(true);
      expect(DEFAULT_SHORTCUTS.small.shift).toBe(true);
      expect(DEFAULT_SHORTCUTS.small.ctrl).toBe(false);
    });
  });

  describe('STORAGE_KEYS for shortcuts', () => {
    it('has SHORTCUT_LARGE key', () => {
      expect(STORAGE_KEYS.SHORTCUT_LARGE).toBe('digest_shortcut_large_v1');
    });

    it('has SHORTCUT_SMALL key', () => {
      expect(STORAGE_KEYS.SHORTCUT_SMALL).toBe('digest_shortcut_small_v1');
    });
  });
});
