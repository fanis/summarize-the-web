import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for overlay.js module
 *
 * Tests constants and basic logic. For layout/positioning tests,
 * see tests/e2e/overlay.spec.js which uses real browser rendering.
 *
 * Note: Most overlay behavior requires DOM manipulation that's better
 * tested in E2E tests with a real browser. These unit tests focus on
 * exported constants and simple functions that can be tested in isolation.
 */

describe('Overlay Module', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    vi.resetModules();
  });

  describe('BADGE_WIDTH constant', () => {
    it('equals 150', async () => {
      const { BADGE_WIDTH } = await import('../../src/modules/overlay.js');
      expect(BADGE_WIDTH).toBe(150);
    });

    it('is a number', async () => {
      const { BADGE_WIDTH } = await import('../../src/modules/overlay.js');
      expect(typeof BADGE_WIDTH).toBe('number');
    });
  });

  describe('ensureCSS', () => {
    it('creates style element when not present', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(global.document.createElement).toHaveBeenCalledWith('style');
      expect(createdElement.id).toBe('summarizer-style');
      expect(global.document.head.appendChild).toHaveBeenCalledWith(createdElement);
    });

    it('skips creation when style already exists', async () => {
      global.document = {
        getElementById: vi.fn().mockReturnValue({ id: 'summarizer-style' }),
        createElement: vi.fn()
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(global.document.createElement).not.toHaveBeenCalled();
    });

    it('includes summarizer-overlay class in CSS', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain('.summarizer-overlay');
      expect(createdElement.textContent).toContain('position: fixed');
    });

    it('includes collapsed state styles', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain('.summarizer-overlay.collapsed');
    });

    it('includes summary overlay styles', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain('.summarizer-summary-overlay');
    });
  });

  describe('getOverlay', () => {
    it('returns null initially', async () => {
      vi.resetModules();
      const { getOverlay } = await import('../../src/modules/overlay.js');

      expect(getOverlay()).toBeNull();
    });
  });

  describe('Display settings CSS', () => {
    let createdElement;

    beforeEach(async () => {
      createdElement = { id: '', textContent: '' };
      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: { appendChild: vi.fn() }
      };
      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();
    });

    it('includes CSS custom property for font size', () => {
      expect(createdElement.textContent).toContain('--summarizer-font-size');
    });

    it('includes CSS custom property for line height', () => {
      expect(createdElement.textContent).toContain('--summarizer-line-height');
    });

    it('includes settings button styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-settings-btn');
    });

    it('includes badge settings container styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-badge-settings');
    });

    it('includes digest footer layout styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-footer');
    });

    it('includes settings popover styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-settings-popover');
    });

    it('includes settings option styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-settings-option');
    });

    it('includes active state for settings options', () => {
      expect(createdElement.textContent).toContain('.summarizer-settings-option.active');
    });

    it('popover is hidden by default', () => {
      expect(createdElement.textContent).toMatch(/\.summarizer-settings-popover\s*\{[^}]*display:\s*none/);
    });

    it('popover shows when open class applied', () => {
      expect(createdElement.textContent).toMatch(/\.summarizer-settings-popover\.open\s*\{[^}]*display:\s*block/);
    });

    it('includes dark mode class for overlay', () => {
      expect(createdElement.textContent).toContain('.summarizer-overlay.summarizer-dark');
    });

    it('includes dark mode class for summary overlay', () => {
      expect(createdElement.textContent).toContain('.summarizer-summary-overlay.summarizer-dark');
    });

    it('includes dark mode styles for settings popover', () => {
      expect(createdElement.textContent).toContain('.summarizer-dark .summarizer-settings-popover');
    });

    it('includes dark mode styles for buttons', () => {
      expect(createdElement.textContent).toContain('.summarizer-dark .summarizer-btn');
    });

    it('includes shortcut input styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-shortcut-input');
    });

    it('includes shortcut row styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-shortcut-row');
    });

    it('includes shortcut recording state', () => {
      expect(createdElement.textContent).toContain('.summarizer-shortcut-input.recording');
    });

    it('includes dark mode styles for shortcuts', () => {
      expect(createdElement.textContent).toContain('.summarizer-dark .summarizer-shortcut-input');
    });

    it('includes summary header controls styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-summary-header-controls');
    });

    it('includes summary settings button styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-summary-settings-btn');
    });

    it('includes summary settings container styles', () => {
      expect(createdElement.textContent).toContain('.summarizer-summary-settings');
    });

    it('includes selectors-btn styles', () => {
      expect(createdElement.textContent).toContain('.selectors-btn');
    });

    it('includes selectors-btn in shared action button rules', () => {
      // selectors-btn should be included alongside inspect-btn and highlight-btn
      expect(createdElement.textContent).toContain('.selectors-btn,');
    });

    it('includes dark mode styles for selectors-btn', () => {
      expect(createdElement.textContent).toContain('.summarizer-dark .summarizer-badge-settings .selectors-btn');
    });
  });

  describe('CSS specifications', () => {
    it('CSS includes high z-index for overlay', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      // Verify z-index is very high to stay on top
      expect(createdElement.textContent).toContain('z-index: 2147483646');
    });

    it('CSS includes width matching BADGE_WIDTH', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS, BADGE_WIDTH } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain(`width: ${BADGE_WIDTH}px`);
    });

    it('CSS includes transition for smooth animations', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain('transition');
    });

    it('CSS includes dragging state without transition', async () => {
      const createdElement = {
        id: '',
        textContent: ''
      };

      global.document = {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(createdElement),
        head: {
          appendChild: vi.fn()
        }
      };

      vi.resetModules();
      const { ensureCSS } = await import('../../src/modules/overlay.js');
      ensureCSS();

      expect(createdElement.textContent).toContain('.summarizer-overlay.dragging');
      expect(createdElement.textContent).toContain('transition: none');
    });
  });

  describe('module exports', () => {
    it('exports all expected functions', async () => {
      vi.resetModules();
      const overlay = await import('../../src/modules/overlay.js');

      expect(typeof overlay.BADGE_WIDTH).toBe('number');
      expect(typeof overlay.ensureCSS).toBe('function');
      expect(typeof overlay.createOverlay).toBe('function');
      expect(typeof overlay.updateOverlayStatus).toBe('function');
      expect(typeof overlay.showSummaryOverlay).toBe('function');
      expect(typeof overlay.removeSummaryOverlay).toBe('function');
      expect(typeof overlay.ensureOverlay).toBe('function');
      expect(typeof overlay.getOverlay).toBe('function');
    });
  });
});
