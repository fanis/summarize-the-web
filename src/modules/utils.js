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
let trustedPolicyFailed = false;
export function setHTML(el, html) {
    try {
        el.innerHTML = html;
    } catch {
        if (!trustedPolicy && !trustedPolicyFailed && typeof window.trustedTypes !== 'undefined') {
            try {
                trustedPolicy = window.trustedTypes.createPolicy('summarize-the-web', {
                    createHTML: (s) => s
                });
            } catch {
                // createPolicy itself throws when the CSP's trusted-types
                // directive allowlists other names, or when the policy name
                // was already registered (script injected twice).
                trustedPolicyFailed = true;
            }
        }
        if (trustedPolicy) {
            try {
                el.innerHTML = trustedPolicy.createHTML(html);
            } catch {}
        }
    }
}

/**
 * Fast non-cryptographic hash (FNV-1a, 32-bit) used for cache keys.
 * Returned as base-36 for compact storage.
 */
export function hashText(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

/**
 * Register a userscript menu command across managers.
 * Greasemonkey 4 only provides GM.registerMenuCommand; note that optional
 * chaining alone (GM_registerMenuCommand?.()) still throws a ReferenceError
 * when the legacy identifier is not declared, so a typeof guard is required.
 * @returns {boolean} - Whether a menu API was available
 */
export function registerMenuCommand(label, fn) {
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand(label, fn);
            return true;
        }
    } catch {}
    try {
        if (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function') {
            GM.registerMenuCommand(label, fn);
            return true;
        }
    } catch {}
    return false;
}
