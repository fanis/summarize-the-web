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

  describe('shortcut matching', () => {
    const event = (overrides = {}) => ({
      key: 'l',
      code: 'KeyL',
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      ...overrides
    });

    it('matches a plain letter shortcut via event.code', async () => {
      const { matchesShortcut } = await import('../../src/modules/overlay.js');
      const shortcut = { key: 'L', alt: true, shift: true, ctrl: false };

      expect(matchesShortcut(event({ altKey: true, shiftKey: true }), shortcut)).toBe(true);
    });

    it('matches even when event.key is an Alt-composed character (macOS)', async () => {
      const { matchesShortcut } = await import('../../src/modules/overlay.js');
      const shortcut = { key: 'L', alt: true, shift: true, ctrl: false };

      // On macOS, Alt+Shift+L produces "Ò" in event.key but code stays KeyL
      const macEvent = event({ key: 'Ò', altKey: true, shiftKey: true });
      expect(matchesShortcut(macEvent, shortcut)).toBe(true);
    });

    it('does not match when Meta/Cmd is also held', async () => {
      const { matchesShortcut } = await import('../../src/modules/overlay.js');
      const shortcut = { key: 'L', alt: true, shift: true, ctrl: false };

      expect(matchesShortcut(event({ altKey: true, shiftKey: true, metaKey: true }), shortcut)).toBe(false);
    });

    it('does not match when modifiers differ', async () => {
      const { matchesShortcut } = await import('../../src/modules/overlay.js');
      const shortcut = { key: 'L', alt: true, shift: true, ctrl: false };

      expect(matchesShortcut(event({ altKey: true }), shortcut)).toBe(false);
      expect(matchesShortcut(event({ shiftKey: true }), shortcut)).toBe(false);
    });

    it('returns false for null shortcut', async () => {
      const { matchesShortcut } = await import('../../src/modules/overlay.js');
      expect(matchesShortcut(event(), null)).toBe(false);
    });
  });

  describe('eventKeyName', () => {
    it('derives letters from event.code', async () => {
      const { eventKeyName } = await import('../../src/modules/overlay.js');
      expect(eventKeyName({ key: 'ò', code: 'KeyL' })).toBe('L');
    });

    it('derives digits from event.code', async () => {
      const { eventKeyName } = await import('../../src/modules/overlay.js');
      expect(eventKeyName({ key: '§', code: 'Digit5' })).toBe('5');
    });

    it('falls back to event.key for non-letter keys', async () => {
      const { eventKeyName } = await import('../../src/modules/overlay.js');
      expect(eventKeyName({ key: 'Enter', code: 'Enter' })).toBe('ENTER');
      expect(eventKeyName({ key: 'F5', code: 'F5' })).toBe('F5');
    });
  });

  describe('Badge shadow CSS', () => {
    it('includes collapsed state styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain(':host(.collapsed)');
    });

    it('includes fixed positioning on host', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('position: fixed');
    });

    it('includes settings button styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('.summarizer-settings-btn');
    });

    it('includes badge settings container styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('.summarizer-badge-settings');
    });

    it('includes digest footer layout styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('.summarizer-footer');
    });

    it('includes settings popover styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('.summarizer-settings-popover');
    });

    it('includes settings option styles with active state', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('.summarizer-settings-option');
      expect(getBadgeShadowCSS()).toContain('.summarizer-settings-option.active');
    });

    it('popover is hidden by default and shows when open class applied', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getBadgeShadowCSS();
      expect(css).toMatch(/\.summarizer-settings-popover\s*\{[^}]*display:\s*none/);
      expect(css).toMatch(/\.summarizer-settings-popover\.open\s*\{[^}]*display:\s*block/);
    });

    it('includes dark mode styles', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getBadgeShadowCSS();
      expect(css).toContain(':host(.summarizer-dark)');
      expect(css).toContain(':host(.summarizer-dark) .summarizer-settings-popover');
      expect(css).toContain(':host(.summarizer-dark) .summarizer-btn');
      expect(css).toContain(':host(.summarizer-dark) .summarizer-shortcut-input');
    });

    it('includes shortcut input styles with recording state', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getBadgeShadowCSS();
      expect(css).toContain('.summarizer-shortcut-input');
      expect(css).toContain('.summarizer-shortcut-row');
      expect(css).toContain('.summarizer-shortcut-input.recording');
    });

    it('includes selectors-btn styles with hover colors in both modes', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getBadgeShadowCSS();
      expect(css).toContain('.selectors-btn');
      expect(css).toContain('.selectors-btn,');
      expect(css).toContain(':host(.summarizer-dark) .summarizer-badge-settings .selectors-btn');
      expect(css).toMatch(/\.selectors-btn:hover[^}]*color:\s*#4338ca/);
      expect(css).toMatch(/:host\(\.summarizer-dark\)[^}]*\.selectors-btn:hover[^}]*color:\s*#a5b4fc/);
    });

    it('includes high z-index for overlay', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('z-index: 2147483646');
    });

    it('includes width matching BADGE_WIDTH', async () => {
      const { getBadgeShadowCSS, BADGE_WIDTH } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain(`width: ${BADGE_WIDTH}px`);
    });

    it('includes transition for smooth animations', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getBadgeShadowCSS()).toContain('transition');
    });

    it('includes dragging state without transition', async () => {
      const { getBadgeShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getBadgeShadowCSS();
      expect(css).toContain(':host(.dragging)');
      expect(css).toContain('transition: none');
    });
  });

  describe('Summary overlay shadow CSS', () => {
    it('includes the summary overlay styles', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toContain('.summarizer-summary-overlay');
    });

    it('uses CSS variable for font-size in summary content', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toMatch(/\.summarizer-summary-content[^}]*font-size:\s*var\(--summarizer-font-size/);
    });

    it('uses CSS variable for line-height in summary content', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toMatch(/\.summarizer-summary-content[^}]*line-height:\s*var\(--summarizer-line-height/);
    });

    it('provides fallback values for CSS variables', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getSummaryOverlayShadowCSS();
      // Fallback ensures styles work even if variables not set
      expect(css).toMatch(/--summarizer-font-size,\s*\d+px/);
      expect(css).toMatch(/--summarizer-line-height,\s*[\d.]+/);
    });

    it('sets overscroll-behavior contain on summary content to prevent scroll chaining', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toMatch(/\.summarizer-summary-content\s*\{[^}]*overscroll-behavior:\s*contain/);
    });

    it('includes summary header controls and settings styles', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      const css = getSummaryOverlayShadowCSS();
      expect(css).toContain('.summarizer-summary-header-controls');
      expect(css).toContain('.summarizer-summary-settings-btn');
      expect(css).toContain('.summarizer-summary-settings');
    });

    it('sets light text color for dark mode summary content', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      // #e5e7eb is a light gray suitable for dark backgrounds
      expect(getSummaryOverlayShadowCSS()).toMatch(/\.summarizer-summary-overlay\.summarizer-dark\s+\.summarizer-summary-content[^}]*color:\s*#e5e7eb/);
    });

    it('sets dark background for dark mode summary overlay', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toMatch(/\.summarizer-summary-overlay\.summarizer-dark[^.][^}]*background:/);
    });

    it('includes print styles hiding interactive controls', async () => {
      const { getSummaryOverlayShadowCSS } = await import('../../src/modules/overlay.js');
      expect(getSummaryOverlayShadowCSS()).toContain('@media print');
    });
  });

  describe('module exports', () => {
    it('exports all expected functions', async () => {
      vi.resetModules();
      const overlay = await import('../../src/modules/overlay.js');

      expect(typeof overlay.BADGE_WIDTH).toBe('number');
      expect(typeof overlay.getBadgeShadowCSS).toBe('function');
      expect(typeof overlay.getSummaryOverlayShadowCSS).toBe('function');
      expect(typeof overlay.createOverlay).toBe('function');
      expect(typeof overlay.updateOverlayStatus).toBe('function');
      expect(typeof overlay.showSummaryOverlay).toBe('function');
      expect(typeof overlay.removeSummaryOverlay).toBe('function');
      expect(typeof overlay.ensureOverlay).toBe('function');
      expect(typeof overlay.matchesShortcut).toBe('function');
      expect(typeof overlay.eventKeyName).toBe('function');
    });
  });

  describe('Body scroll locking', () => {
    function mockShadowRoot() {
      return {
        innerHTML: '',
        querySelector: vi.fn().mockReturnValue({
          style: { setProperty: vi.fn() },
          classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
          addEventListener: vi.fn()
        }),
        querySelectorAll: vi.fn().mockReturnValue([])
      };
    }

    function mockDocument(overlayEl, bodyStyle, htmlStyle) {
      return {
        getElementById: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue(overlayEl),
        head: { appendChild: vi.fn() },
        body: {
          appendChild: vi.fn(),
          style: bodyStyle,
          hasAttribute: vi.fn().mockReturnValue(false),
          setAttribute: vi.fn(),
          removeAttribute: vi.fn()
        },
        documentElement: { style: htmlStyle },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
    }

    it('locks body scroll when summary overlay is shown', async () => {
      const bodyStyle = { overflow: '' };
      const htmlStyle = { overflow: '' };
      const overlayEl = {
        setAttribute: vi.fn(),
        attachShadow: vi.fn().mockReturnValue(mockShadowRoot()),
        isConnected: false
      };
      global.document = mockDocument(overlayEl, bodyStyle, htmlStyle);
      global.window = { matchMedia: vi.fn().mockReturnValue({ matches: false }) };

      vi.resetModules();
      const { showSummaryOverlay } = await import('../../src/modules/overlay.js');
      const mockStorage = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
      await showSummaryOverlay('Test summary', 'digest_large', null, { value: true }, mockStorage);

      expect(bodyStyle.overflow).toBe('hidden');
      expect(htmlStyle.overflow).toBe('hidden');
    });

    it('restores body scroll when summary overlay is removed', async () => {
      const bodyStyle = { overflow: 'auto' };
      const htmlStyle = { overflow: 'visible' };
      const overlayEl = {
        setAttribute: vi.fn(),
        attachShadow: vi.fn().mockReturnValue(mockShadowRoot()),
        isConnected: true,
        remove: vi.fn()
      };
      global.document = mockDocument(overlayEl, bodyStyle, htmlStyle);
      global.window = { matchMedia: vi.fn().mockReturnValue({ matches: false }) };

      vi.resetModules();
      const { showSummaryOverlay, removeSummaryOverlay } = await import('../../src/modules/overlay.js');
      const mockStorage = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
      await showSummaryOverlay('Test summary', 'digest_large', null, { value: true }, mockStorage);

      // Body should now be locked
      expect(bodyStyle.overflow).toBe('hidden');
      expect(htmlStyle.overflow).toBe('hidden');

      removeSummaryOverlay();

      // Body overflow should be restored to original values
      expect(bodyStyle.overflow).toBe('auto');
      expect(htmlStyle.overflow).toBe('visible');
    });

    it('removes the Escape listener on removeSummaryOverlay', async () => {
      const bodyStyle = { overflow: '' };
      const htmlStyle = { overflow: '' };
      const overlayEl = {
        setAttribute: vi.fn(),
        attachShadow: vi.fn().mockReturnValue(mockShadowRoot()),
        isConnected: true,
        remove: vi.fn()
      };
      global.document = mockDocument(overlayEl, bodyStyle, htmlStyle);
      global.window = { matchMedia: vi.fn().mockReturnValue({ matches: false }) };

      vi.resetModules();
      const { showSummaryOverlay, removeSummaryOverlay } = await import('../../src/modules/overlay.js');
      const mockStorage = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
      await showSummaryOverlay('Test summary', 'digest_large', null, { value: true }, mockStorage);

      const escHandler = global.document.addEventListener.mock.calls.find(c => c[0] === 'keydown')?.[1];
      expect(escHandler).toBeDefined();

      removeSummaryOverlay();

      const removed = global.document.removeEventListener.mock.calls.find(c => c[0] === 'keydown')?.[1];
      expect(removed).toBe(escHandler);
    });
  });
});
