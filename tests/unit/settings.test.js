import { describe, it, expect, afterEach, vi } from 'vitest';
import { openSelectorEditor } from '../../src/modules/settings.js';

describe('openSelectorEditor', () => {
  afterEach(() => {
    // Clean up any dialogs left in the DOM
    document.body.innerHTML = '';
  });

  function openDialog(overrides = {}) {
    const defaults = {
      host: 'example.com',
      selectorsGlobal: ['article', '.post-content'],
      excludeGlobal: { self: ['.ad'], ancestors: ['.sidebar', 'nav'] },
      selectorsDomain: ['.custom-article'],
      excludeDomain: { self: ['.popup'], ancestors: ['.promo'] },
      defaultSelectors: ['article', 'main'],
      defaultExcludes: { self: [], ancestors: ['.comment', '.sidebar'] },
      onSave: vi.fn()
    };
    openSelectorEditor({ ...defaults, ...overrides });
    // The dialog is appended as a host element with shadow DOM
    const hostEl = document.body.querySelector('[data-digest-ui]');
    return { hostEl, shadow: hostEl?.shadowRoot };
  }

  describe('dialog structure', () => {
    it('creates a dialog in the DOM', () => {
      const { hostEl } = openDialog();
      expect(hostEl).not.toBeNull();
    });

    it('uses shadow DOM for CSS isolation', () => {
      const { shadow } = openDialog();
      expect(shadow).not.toBeNull();
    });

    it('has a modal with correct title', () => {
      const { shadow } = openDialog();
      const title = shadow.querySelector('h3');
      expect(title.textContent).toBe('Edit Selectors');
    });

    it('has Global and Domain tabs', () => {
      const { shadow } = openDialog();
      const tabs = shadow.querySelectorAll('.tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].textContent).toBe('Global');
      expect(tabs[1].textContent).toBe('example.com');
    });

    it('escapes HTML in hostname', () => {
      const { shadow } = openDialog({ host: '<script>alert(1)</script>' });
      const domainTab = shadow.querySelectorAll('.tab')[1];
      expect(domainTab.innerHTML).not.toContain('<script>');
      expect(domainTab.textContent).toContain('<script>');
    });

    it('has Save, Reset, and Cancel buttons', () => {
      const { shadow } = openDialog();
      expect(shadow.querySelector('.btn-save')).not.toBeNull();
      expect(shadow.querySelector('.btn-reset')).not.toBeNull();
      expect(shadow.querySelector('.btn-cancel')).not.toBeNull();
    });
  });

  describe('Global tab', () => {
    it('is active by default', () => {
      const { shadow } = openDialog();
      const globalPanel = shadow.querySelector('[data-panel="global"]');
      expect(globalPanel.classList.contains('active')).toBe(true);
    });

    it('populates global container selectors textarea', () => {
      const { shadow } = openDialog({ selectorsGlobal: ['article', '.post-content'] });
      const ta = shadow.querySelector('#g-selectors');
      expect(ta.value).toBe('article\n.post-content');
    });

    it('populates global excluded elements textarea', () => {
      const { shadow } = openDialog({ excludeGlobal: { self: ['.ad', '.banner'], ancestors: [] } });
      const ta = shadow.querySelector('#g-ex-self');
      expect(ta.value).toBe('.ad\n.banner');
    });

    it('populates global excluded containers textarea', () => {
      const { shadow } = openDialog({ excludeGlobal: { self: [], ancestors: ['.sidebar', 'nav'] } });
      const ta = shadow.querySelector('#g-ex-anc');
      expect(ta.value).toBe('.sidebar\nnav');
    });

    it('has three textareas for global settings', () => {
      const { shadow } = openDialog();
      const globalPanel = shadow.querySelector('[data-panel="global"]');
      const textareas = globalPanel.querySelectorAll('textarea');
      expect(textareas).toHaveLength(3);
    });

    it('all global textareas are editable', () => {
      const { shadow } = openDialog();
      const globalPanel = shadow.querySelector('[data-panel="global"]');
      const textareas = globalPanel.querySelectorAll('textarea');
      textareas.forEach(ta => {
        expect(ta.hasAttribute('readonly')).toBe(false);
      });
    });
  });

  describe('Domain tab', () => {
    function switchToDomainTab(shadow) {
      const domainTab = shadow.querySelectorAll('.tab')[1];
      domainTab.click();
    }

    it('becomes active when clicked', () => {
      const { shadow } = openDialog();
      switchToDomainTab(shadow);
      const domainPanel = shadow.querySelector('[data-panel="domain"]');
      expect(domainPanel.classList.contains('active')).toBe(true);
    });

    it('deactivates Global tab when Domain tab is clicked', () => {
      const { shadow } = openDialog();
      switchToDomainTab(shadow);
      const globalPanel = shadow.querySelector('[data-panel="global"]');
      expect(globalPanel.classList.contains('active')).toBe(false);
    });

    it('shows global selectors as read-only context', () => {
      const { shadow } = openDialog({ selectorsGlobal: ['article', 'main'] });
      const domainPanel = shadow.querySelector('[data-panel="domain"]');
      const readonlyTas = domainPanel.querySelectorAll('textarea.readonly');
      expect(readonlyTas.length).toBe(3);
      expect(readonlyTas[0].value).toBe('article\nmain');
      expect(readonlyTas[0].hasAttribute('readonly')).toBe(true);
    });

    it('populates domain-specific selectors textarea', () => {
      const { shadow } = openDialog({ selectorsDomain: ['.custom-article'] });
      const ta = shadow.querySelector('#d-selectors');
      expect(ta.value).toBe('.custom-article');
    });

    it('populates domain-specific excluded elements textarea', () => {
      const { shadow } = openDialog({ excludeDomain: { self: ['.popup'], ancestors: [] } });
      const ta = shadow.querySelector('#d-ex-self');
      expect(ta.value).toBe('.popup');
    });

    it('populates domain-specific excluded containers textarea', () => {
      const { shadow } = openDialog({ excludeDomain: { self: [], ancestors: ['.promo'] } });
      const ta = shadow.querySelector('#d-ex-anc');
      expect(ta.value).toBe('.promo');
    });

    it('has three editable textareas for domain additions', () => {
      const { shadow } = openDialog();
      const domainPanel = shadow.querySelector('[data-panel="domain"]');
      const editableTas = domainPanel.querySelectorAll('textarea.editable');
      expect(editableTas).toHaveLength(3);
      editableTas.forEach(ta => {
        expect(ta.hasAttribute('readonly')).toBe(false);
      });
    });

    it('has three read-only textareas showing global context', () => {
      const { shadow } = openDialog();
      const domainPanel = shadow.querySelector('[data-panel="domain"]');
      const readonlyTas = domainPanel.querySelectorAll('textarea.readonly');
      expect(readonlyTas).toHaveLength(3);
    });
  });

  describe('tab switching', () => {
    it('switches between tabs', () => {
      const { shadow } = openDialog();
      const [globalTab, domainTab] = shadow.querySelectorAll('.tab');
      const globalPanel = shadow.querySelector('[data-panel="global"]');
      const domainPanel = shadow.querySelector('[data-panel="domain"]');

      // Initially global is active
      expect(globalTab.classList.contains('active')).toBe(true);
      expect(globalPanel.classList.contains('active')).toBe(true);

      // Switch to domain
      domainTab.click();
      expect(domainTab.classList.contains('active')).toBe(true);
      expect(domainPanel.classList.contains('active')).toBe(true);
      expect(globalTab.classList.contains('active')).toBe(false);
      expect(globalPanel.classList.contains('active')).toBe(false);

      // Switch back to global
      globalTab.click();
      expect(globalTab.classList.contains('active')).toBe(true);
      expect(globalPanel.classList.contains('active')).toBe(true);
      expect(domainTab.classList.contains('active')).toBe(false);
      expect(domainPanel.classList.contains('active')).toBe(false);
    });
  });

  describe('save', () => {
    it('calls onSave with parsed data from all textareas', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { shadow } = openDialog({ onSave });

      // Edit global textareas
      shadow.querySelector('#g-selectors').value = 'article\n.content';
      shadow.querySelector('#g-ex-self').value = '.ad';
      shadow.querySelector('#g-ex-anc').value = '.sidebar\nnav';

      // Edit domain textareas
      shadow.querySelector('#d-selectors').value = '.local-article';
      shadow.querySelector('#d-ex-self').value = '.popup\n.modal';
      shadow.querySelector('#d-ex-anc').value = '.promo';

      shadow.querySelector('.btn-save').click();
      await vi.waitFor(() => expect(onSave).toHaveBeenCalled());

      const data = onSave.mock.calls[0][0];
      expect(data.global.selectors).toEqual(['article', '.content']);
      expect(data.global.excludeSelf).toEqual(['.ad']);
      expect(data.global.excludeAncestors).toEqual(['.sidebar', 'nav']);
      expect(data.domain.selectors).toEqual(['.local-article']);
      expect(data.domain.excludeSelf).toEqual(['.popup', '.modal']);
      expect(data.domain.excludeAncestors).toEqual(['.promo']);
    });

    it('strips blank lines and whitespace from values', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { shadow } = openDialog({ onSave });

      shadow.querySelector('#g-selectors').value = '  article  \n\n  .content  \n  ';
      shadow.querySelector('#g-ex-self').value = '';
      shadow.querySelector('#g-ex-anc').value = '\n\n';

      shadow.querySelector('.btn-save').click();
      await vi.waitFor(() => expect(onSave).toHaveBeenCalled());

      const data = onSave.mock.calls[0][0];
      expect(data.global.selectors).toEqual(['article', '.content']);
      expect(data.global.excludeSelf).toEqual([]);
      expect(data.global.excludeAncestors).toEqual([]);
    });
  });

  describe('reset defaults', () => {
    it('resets global tab textareas to defaults', () => {
      const defaultSelectors = ['article', 'main'];
      const defaultExcludes = { self: ['.ad-default'], ancestors: ['.comment', '.sidebar'] };
      const { shadow } = openDialog({ defaultSelectors, defaultExcludes });

      // Modify global values
      shadow.querySelector('#g-selectors').value = 'custom-stuff';
      shadow.querySelector('#g-ex-self').value = 'custom-ex';
      shadow.querySelector('#g-ex-anc').value = 'custom-anc';

      // Reset while on global tab
      shadow.querySelector('.btn-reset').click();

      expect(shadow.querySelector('#g-selectors').value).toBe('article\nmain');
      expect(shadow.querySelector('#g-ex-self').value).toBe('.ad-default');
      expect(shadow.querySelector('#g-ex-anc').value).toBe('.comment\n.sidebar');
    });

    it('clears domain tab textareas when on domain tab', () => {
      const { shadow } = openDialog({
        selectorsDomain: ['.custom'],
        excludeDomain: { self: ['.x'], ancestors: ['.y'] }
      });

      // Switch to domain tab
      shadow.querySelectorAll('.tab')[1].click();

      // Reset while on domain tab
      shadow.querySelector('.btn-reset').click();

      expect(shadow.querySelector('#d-selectors').value).toBe('');
      expect(shadow.querySelector('#d-ex-self').value).toBe('');
      expect(shadow.querySelector('#d-ex-anc').value).toBe('');
    });

    it('does not affect domain textareas when resetting global tab', () => {
      const { shadow } = openDialog({
        selectorsDomain: ['.custom'],
        excludeDomain: { self: ['.x'], ancestors: ['.y'] }
      });

      // Reset while on global tab (default)
      shadow.querySelector('.btn-reset').click();

      expect(shadow.querySelector('#d-selectors').value).toBe('.custom');
      expect(shadow.querySelector('#d-ex-self').value).toBe('.x');
      expect(shadow.querySelector('#d-ex-anc').value).toBe('.y');
    });
  });

  describe('close behavior', () => {
    it('removes dialog on Cancel click', () => {
      const { shadow } = openDialog();
      shadow.querySelector('.btn-cancel').click();
      expect(document.body.querySelector('[data-digest-ui]')).toBeNull();
    });

    it('removes dialog on Escape keydown', () => {
      const { shadow } = openDialog();
      shadow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.body.querySelector('[data-digest-ui]')).toBeNull();
    });

    it('removes dialog on backdrop click', () => {
      const { shadow } = openDialog();
      const wrap = shadow.querySelector('.wrap');
      wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(document.body.querySelector('[data-digest-ui]')).toBeNull();
    });

    it('does not close when clicking inside the modal', () => {
      const { shadow } = openDialog();
      const modal = shadow.querySelector('.modal');
      modal.click();
      expect(document.body.querySelector('[data-digest-ui]')).not.toBeNull();
    });

    it('does not call onSave when cancelled', () => {
      const onSave = vi.fn();
      const { shadow } = openDialog({ onSave });
      shadow.querySelector('.btn-cancel').click();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('empty state handling', () => {
    it('handles empty global selectors', () => {
      const { shadow } = openDialog({ selectorsGlobal: [] });
      expect(shadow.querySelector('#g-selectors').value).toBe('');
    });

    it('handles empty exclude objects', () => {
      const { shadow } = openDialog({
        excludeGlobal: { self: [], ancestors: [] },
        excludeDomain: { self: [], ancestors: [] }
      });
      expect(shadow.querySelector('#g-ex-self').value).toBe('');
      expect(shadow.querySelector('#g-ex-anc').value).toBe('');
      expect(shadow.querySelector('#d-ex-self').value).toBe('');
      expect(shadow.querySelector('#d-ex-anc').value).toBe('');
    });

    it('handles undefined self/ancestors in excludes', () => {
      const { shadow } = openDialog({
        excludeGlobal: {},
        excludeDomain: {}
      });
      expect(shadow.querySelector('#g-ex-self').value).toBe('');
      expect(shadow.querySelector('#g-ex-anc').value).toBe('');
      expect(shadow.querySelector('#d-ex-self').value).toBe('');
      expect(shadow.querySelector('#d-ex-anc').value).toBe('');
    });

    it('handles empty domain selectors', () => {
      const { shadow } = openDialog({ selectorsDomain: [] });
      expect(shadow.querySelector('#d-selectors').value).toBe('');
    });
  });

  describe('CSS styling', () => {
    it('uses segmented control style for tabs (background on container)', () => {
      const { shadow } = openDialog();
      const style = shadow.querySelector('style').textContent;
      expect(style).toMatch(/\.tabs\{[^}]*background/);
    });

    it('active tab has white background for segmented control look', () => {
      const { shadow } = openDialog();
      const style = shadow.querySelector('style').textContent;
      expect(style).toMatch(/\.tab\.active\{[^}]*background:#fff/);
    });

    it('modal wrapper uses flex-start alignment for top anchoring', () => {
      const { shadow } = openDialog();
      const style = shadow.querySelector('style').textContent;
      expect(style).toMatch(/\.wrap\{[^}]*align-items:flex-start/);
    });

    it('tab panels use display:none/block for dynamic height', () => {
      const { shadow } = openDialog();
      const style = shadow.querySelector('style').textContent;
      expect(style).toMatch(/\.tab-panel\{[^}]*display:none/);
      expect(style).toMatch(/\.tab-panel\.active\{[^}]*display:block/);
    });
  });
});
