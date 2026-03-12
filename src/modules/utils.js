/**
 * Utility functions for Summarize The Web
 */

import { CFG, LOG_PREFIX } from './config.js';

/**
 * Debug logging
 */
export function log(...args) {
    if (!CFG.DEBUG) return;
    console.log(LOG_PREFIX, ...args);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

/**
 * Parse lines from textarea input
 */
export function parseLines(s) {
    return s.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
}

/**
 * Normalize whitespace in text
 */
export function normalizeSpace(s) {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Get trimmed text content from element
 */
export function textTrim(el) {
    return normalizeSpace(el.textContent || '');
}

/**
 * Set innerHTML safely, working around Trusted Types CSP on sites like Gmail.
 * Creates a Trusted Types policy if the browser enforces it, otherwise falls back to plain innerHTML.
 */
let trustedPolicy = null;
export function setHTML(el, html) {
    try {
        el.innerHTML = html;
    } catch {
        if (!trustedPolicy && typeof window.trustedTypes !== 'undefined') {
            trustedPolicy = window.trustedTypes.createPolicy('summarize-the-web', {
                createHTML: (s) => s
            });
        }
        if (trustedPolicy) {
            el.innerHTML = trustedPolicy.createHTML(html);
        }
    }
}
