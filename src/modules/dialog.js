/**
 * Shared modal dialog scaffolding for Summarize The Web
 *
 * Every dialog (settings, editors, inspection) uses the same shell: a host
 * element with a shadow root for CSS isolation, a fixed backdrop wrapper,
 * close-on-backdrop-click, close-on-Escape and initial focus.
 */

import { UI_ATTR } from './config.js';
import { setHTML } from './utils.js';

/**
 * Create a modal dialog inside a shadow root.
 * @param {Object} options
 * @param {string} options.css - Stylesheet for the shadow root (must style .wrap)
 * @param {string} options.bodyHTML - Markup rendered inside the .wrap backdrop
 * @param {Function} [options.onClose] - Called after the dialog is removed, on any close path
 * @param {boolean} [options.closeOnBackdrop=true] - Close when the backdrop is clicked
 * @param {boolean} [options.closeOnEscape=true] - Close when Escape is pressed
 * @param {boolean} [options.focusWrap=true] - Focus the backdrop wrapper so key events land in the shadow root
 * @returns {{ host: HTMLElement, shadow: ShadowRoot, wrap: HTMLElement, close: Function }}
 */
export function createDialog({ css, bodyHTML, onClose = null, closeOnBackdrop = true, closeOnEscape = true, focusWrap = true }) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = css;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    setHTML(wrap, bodyHTML);

    shadow.append(style, wrap);
    document.body.appendChild(host);

    const close = () => {
        host.remove();
        onClose?.();
    };

    if (closeOnBackdrop) {
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    }
    if (closeOnEscape) {
        shadow.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
    }

    wrap.setAttribute('tabindex', '-1');
    if (focusWrap) wrap.focus();

    return { host, shadow, wrap, close };
}
