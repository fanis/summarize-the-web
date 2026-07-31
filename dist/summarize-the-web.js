// ==UserScript==
// @name         Summarize The Web
// @namespace    https://fanis.dev/userscripts
// @author       Fanis Hatzidakis
// @license      PolyForm-Internal-Use-1.0.0; https://polyformproject.org/licenses/internal-use/1.0.0/
// @version      2.9.0
// @description  Summarize web articles via OpenAI API. Modular architecture with configurable selectors and inspection mode.
// @match        *://*/*
// @exclude      about:*
// @exclude      moz-extension:*
// @run-at       document-end
// @noframes
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_deleteValue
// @grant        GM.deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM.registerMenuCommand
// @connect      api.openai.com
// ==/UserScript==

// SPDX-License-Identifier: PolyForm-Internal-Use-1.0.0
// Copyright (c) 2025 Fanis Hatzidakis
// License: PolyForm Internal Use License 1.0.0
// Summary: Free for personal and internal business use. No redistribution, resale,
// or offering as a service without a separate commercial license from the author.
// Full text: https://polyformproject.org/licenses/internal-use/1.0.0/


(function () {
    'use strict';

    /**
     * Configuration constants and settings for Summarize The Web
     */

    const CFG = {
        model: 'gpt-5-nano',
        DEBUG: false,
    };

    const UI_ATTR = 'data-digest-ui';
    const LOG_PREFIX = '[summarize-the-web]';

    // Available models with pricing
    // Pricing source: https://developers.openai.com/api/docs/pricing (as of 2026-07-31)
    // Note: OpenAI renamed "priority processing" to "Fast mode" on 2026-07-30;
    // service_tier "priority" remains a valid API alias. Storage keys below keep
    // the -priority suffix so existing user selections are preserved.
    const MODEL_OPTIONS = {
        'gpt-5-nano': {
            name: 'GPT-5 Nano',
            apiModel: 'gpt-5-nano',
            description: 'Ultra-affordable - Best value for most articles',
            inputPer1M: 0.05,
            outputPer1M: 0.40,
            recommended: true,
            priority: false
        },
        'gpt-5.6-luna': {
            name: 'GPT-5.6 Luna',
            apiModel: 'gpt-5.6-luna',
            description: 'Newest generation at low cost - Quality step up from Nano',
            inputPer1M: 0.20,
            outputPer1M: 1.20,
            recommended: false,
            priority: false
        },
        'gpt-4.1-nano-priority': {
            name: 'GPT-4.1 Nano Fast',
            apiModel: 'gpt-4.1-nano',
            description: 'Cheapest fast-processing option (older generation)',
            inputPer1M: 0.20,
            outputPer1M: 0.80,
            recommended: false,
            priority: true
        },
        'gpt-5-mini-priority': {
            name: 'GPT-5 Mini Fast',
            apiModel: 'gpt-5-mini',
            description: 'Better quality + faster processing',
            inputPer1M: 0.45,
            outputPer1M: 3.60,
            recommended: false,
            priority: true
        },
        'gpt-5.6-terra-priority': {
            name: 'GPT-5.6 Terra Fast',
            apiModel: 'gpt-5.6-terra',
            description: 'Newest flagship tier + faster processing (most expensive)',
            inputPer1M: 4.00,
            outputPer1M: 24.00,
            recommended: false,
            priority: true
        }
    };

    // Identifier for the user-defined model entry in MODEL_OPTIONS
    const CUSTOM_MODEL_ID = 'custom';

    // Valid reasoning effort values for the custom model definition
    const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'];

    // Storage keys
    const STORAGE_KEYS = {
        OPENAI_KEY: 'OPENAI_KEY',
        CUSTOM_MODEL: 'digest_custom_model_v1',
        DOMAINS_MODE: 'digest_domains_mode_v1',
        DOMAINS_DENY: 'digest_domains_excluded_v1',
        DOMAINS_ALLOW: 'digest_domains_enabled_v1',
        DEBUG: 'digest_debug_v1',
        SIMPLIFICATION_STRENGTH: 'digest_simplification_v1',
        AUTO_SIMPLIFY: 'digest_auto_simplify_v1',
        CUSTOM_PROMPT: 'digest_custom_prompt_v1',
        OVERLAY_POS: 'digest_overlay_pos_v1',
        OVERLAY_COLLAPSED: 'digest_overlay_collapsed_v1',
        FIRST_INSTALL: 'digest_installed_v1',
        API_TOKENS: 'digest_api_tokens_v1',
        PRICING: 'digest_pricing_v1',
        CACHE: 'digest_cache_v2',
        MODEL: 'digest_model_v1',
        // Article extraction selectors
        SELECTORS_GLOBAL: 'digest_selectors_v1',
        EXCLUDES_GLOBAL: 'digest_excludes_v1',
        DOMAIN_SELECTORS: 'digest_domain_selectors_v1',
        DOMAIN_EXCLUDES: 'digest_domain_excludes_v1',
        MIN_TEXT_LENGTH: 'digest_min_text_length_v1',
        JUST_ENABLED: 'digest_just_enabled_v1',
        // Display settings
        SUMMARY_FONT_SIZE: 'digest_summary_font_size_v1',
        SUMMARY_LINE_HEIGHT: 'digest_summary_line_height_v1',
        THEME: 'digest_theme_v1',
        SHORTCUT_LARGE: 'digest_shortcut_large_v1',
        SHORTCUT_SMALL: 'digest_shortcut_small_v1',
    };

    // Default keyboard shortcuts
    const DEFAULT_SHORTCUTS = {
        large: { key: 'L', alt: true, shift: true, ctrl: false },
        small: { key: 'S', alt: true, shift: true, ctrl: false }
    };

    // Summary display settings
    const SUMMARY_FONT_SIZES = {
        small: 15,
        default: 17,
        large: 20
    };

    const SUMMARY_LINE_HEIGHTS = {
        compact: 1.5,
        default: 1.8,
        comfortable: 2.1
    };

    // Minimum text length for extraction (in characters)
    const DEFAULT_MIN_TEXT_LENGTH = 100;

    // Default prompts
    const DEFAULT_PROMPTS = {
        summary_large: 'You will receive INPUT as article text. Summarize and simplify the content to approximately 50% of the original length. Make the language clearer and more direct while staying in the SAME language as input. CRITICAL: Do NOT change facts, numbers, names, quotes, or the actual meaning/details of the content. If the text contains direct quotes inside quotation marks, keep that quoted text VERBATIM. Preserve all factual information, statistics, proper nouns, and direct quotes exactly as they appear. Maintain paragraph structure where appropriate. Return ONLY the simplified text without any formatting, code blocks, or JSON.',
        summary_small: 'You will receive INPUT as article text. Create a concise summary at approximately 20% of the original length while staying in the SAME language as input. Focus on the most important points and key facts. CRITICAL: Do NOT change facts, numbers, names, or core meaning. Preserve important quotes, statistics, and proper nouns exactly as they appear. Condense the content aggressively to achieve the 20% length target while maintaining readability. Return ONLY the summary text without any formatting, code blocks, or JSON.'
    };

    // Simplification style levels
    const SIMPLIFICATION_LEVELS = ['Conservative', 'Balanced', 'Aggressive'];

    // Style instructions appended to prompts
    const STYLE_INSTRUCTIONS = {
        'Conservative': ' Minimize rephrasing. Preserve original wording and sentence structure where possible.',
        'Balanced': '',
        'Aggressive': ' Maximize simplification. Use simpler vocabulary and shorter sentences.'
    };

    // Default article container selectors (ordered by specificity)
    const DEFAULT_SELECTORS = [
        '[itemprop="articleBody"]',
        'article[itemtype*="Article"]',
        '.article-body',
        '.post-content',
        '.entry-content',
        '[class*="article-content"]',
        ':is(div, section, article)[class*="post-body"]',
        // WordPress page builders / themes
        '.elementor-widget-theme-post-content',
        '.wp-block-post-content',
        '.td-post-content',
        '[class*="et_pb_post_content"]',
        // Ghost (Casper and derived themes)
        '.gh-content',
        '.post-full-content',
        // Substack
        '.available-content',
        // Drupal 8+
        '.field--name-body',
        // Shopify blogs (Dawn and BEM-style themes)
        '.article-template__content',
        '.article__content',
        // Greek news sites
        '[class*="articleContainer"] .cnt',
        '[class*="articleContainer"]',
        '.story-content',
        '.story-body',
        // Generic fallbacks
        'article',
        'main',
        '[role="main"]'
    ];

    // Default exclusions (elements to skip when extracting text)
    const DEFAULT_EXCLUDES = {
        self: [],
        ancestors: [
            '.comment', '.comments', '.sidebar', '.navigation', '.menu',
            '.footer', '.header', 'nav', 'aside', '.related', '.recommended',
            '.advertisement', '.ad', '.social-share', '.author-bio'
        ]
    };

    // Default API pricing
    const DEFAULT_PRICING = {
        model: 'gpt-5-nano',
        inputPer1M: 0.05,
        outputPer1M: 0.40,
        lastUpdated: '2026-07-31',
        source: 'https://developers.openai.com/api/docs/pricing'
    };

    // Cache settings
    const CACHE_LIMIT = 50;
    const CACHE_TRIM_TO = 30;

    // Max output tokens per summary mode
    const MAX_OUTPUT_TOKENS = {
        large: 4000,
        small: 2000
    };

    /**
     * Utility functions for Summarize The Web
     */


    /**
     * Debug logging
     */
    function log(...args) {
        if (!CFG.DEBUG) return;
        console.log(LOG_PREFIX, ...args);
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(s) {
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
    function parseLines(s) {
        return s.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
    }

    /**
     * Normalize whitespace in text
     */
    function normalizeSpace(s) {
        return s.replace(/\s+/g, ' ').trim();
    }

    /**
     * Get trimmed text content from element
     */
    function textTrim(el) {
        return normalizeSpace(el.textContent || '');
    }

    /**
     * Set innerHTML safely, working around Trusted Types CSP on sites like Gmail.
     * Creates a Trusted Types policy if the browser enforces it, otherwise falls back to plain innerHTML.
     */
    let trustedPolicy = null;
    let trustedPolicyFailed = false;
    function setHTML(el, html) {
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
    function hashText(s) {
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
    function registerMenuCommand(label, fn) {
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

    /**
     * Storage module with GM → localStorage → memory fallback
     * Handles userscript storage across different environments
     */

    class Storage {
        constructor() {
            this.memory = new Map();
            this.namespace = '__webdigest__';
        }

        /**
         * Get value from storage with fallback chain
         * @param {string} key - Storage key
         * @param {any} defaultValue - Default value if not found
         * @returns {Promise<any>}
         */
        async get(key, defaultValue = '') {
            // Try GM.getValue (async)
            try {
                if (typeof GM?.getValue === 'function') {
                    const value = await GM.getValue(key);
                    if (value != null) return value;
                }
            } catch {}

            // Try GM_getValue (sync, legacy)
            try {
                if (typeof GM_getValue === 'function') {
                    const value = GM_getValue(key);
                    if (value != null) return value;
                }
            } catch {}

            // Try localStorage
            try {
                const bag = JSON.parse(localStorage.getItem(this.namespace) || '{}');
                if (key in bag) return bag[key];
            } catch {}

            // Try memory fallback
            if (this.memory.has(key)) {
                return this.memory.get(key);
            }

            return defaultValue;
        }

        /**
         * Set value in storage with fallback chain
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         * @returns {Promise<boolean>} - Success status
         */
        async set(key, value) {
            let success = false;

            // Try GM.setValue (async)
            try {
                if (typeof GM?.setValue === 'function') {
                    await GM.setValue(key, value);
                    success = true;
                }
            } catch {}

            // Try GM_setValue (sync, legacy)
            if (!success) {
                try {
                    if (typeof GM_setValue === 'function') {
                        GM_setValue(key, value);
                        success = true;
                    }
                } catch {}
            }

            // Try localStorage
            if (!success) {
                try {
                    const bag = JSON.parse(localStorage.getItem(this.namespace) || '{}');
                    bag[key] = value;
                    localStorage.setItem(this.namespace, JSON.stringify(bag));
                    success = true;
                } catch {}
            }

            // Fallback to memory
            if (!success) {
                this.memory.set(key, value);
            }

            return success;
        }

        /**
         * Delete value from storage
         * @param {string} key - Storage key
         * @returns {Promise<boolean>} - Success status
         */
        async delete(key) {
            let success = false;

            // Try GM.deleteValue (async)
            try {
                if (typeof GM?.deleteValue === 'function') {
                    await GM.deleteValue(key);
                    success = true;
                }
            } catch {}

            // Try GM_deleteValue (sync, legacy)
            try {
                if (typeof GM_deleteValue === 'function') {
                    GM_deleteValue(key);
                    success = true;
                }
            } catch {}

            // Try localStorage
            try {
                const bag = JSON.parse(localStorage.getItem(this.namespace) || '{}');
                if (key in bag) {
                    delete bag[key];
                    localStorage.setItem(this.namespace, JSON.stringify(bag));
                    success = true;
                }
            } catch {}

            // Always delete from memory
            this.memory.delete(key);

            return success;
        }
    }

    /**
     * Selector and domain matching utilities
     */

    /**
     * Convert glob pattern to RegExp
     * @param {string} glob - Glob pattern (e.g., "*.example.com")
     * @returns {RegExp}
     */
    function globToRegExp(glob) {
        const esc = s => s.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
        const g = esc(glob).replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
        return new RegExp(`^${g}$`, 'i');
    }

    /**
     * Convert domain pattern to regex, handling wildcards and regex literals
     * @param {string} pattern - Domain pattern
     * @returns {RegExp|null}
     */
    function domainPatternToRegex(pattern) {
        pattern = pattern.trim();
        if (!pattern) return null;

        // Handle regex literal: /pattern/
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
            try {
                return new RegExp(pattern.slice(1, -1), 'i');
            } catch {
                return null;
            }
        }

        // Handle glob patterns with wildcards
        if (pattern.includes('*') || pattern.includes('?')) {
            return globToRegExp(pattern.replace(/^\.*\*?\./, '*.'));
        }

        // Exact match with subdomain support
        const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\.)${esc}$`, 'i');
    }

    /**
     * Check if hostname matches any pattern in list
     * @param {string[]} list - List of domain patterns
     * @param {string} hostname - Hostname to check
     * @returns {boolean}
     */
    function listMatchesHost(list, hostname) {
        for (const pattern of list) {
            const regex = domainPatternToRegex(pattern);
            if (regex && regex.test(hostname)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check whether an element is excluded by the given rules: the element
     * itself matches a `self` selector, or any ancestor matches an `ancestors`
     * selector. Invalid selectors are skipped.
     * @param {Element} el - Element to check
     * @param {Object} EXCLUDE - Object with self and ancestors selector arrays
     * @returns {boolean}
     */
    function isExcludedElement(el, EXCLUDE) {
        if (EXCLUDE.self) {
            for (const sel of EXCLUDE.self) {
                try {
                    if (el.matches(sel)) return true;
                } catch {}
            }
        }
        if (EXCLUDE.ancestors) {
            for (const sel of EXCLUDE.ancestors) {
                try {
                    if (el.closest(sel)) return true;
                } catch {}
            }
        }
        return false;
    }

    /**
     * Compile selector list into CSS selector string
     * @param {string[]} selectors - Array of CSS selectors
     * @returns {string} - Comma-separated selector string
     */
    function compiledSelectors(selectors) {
        return selectors.filter(Boolean).join(',');
    }

    /**
     * Check if element matches any selector in list
     * @param {Element} el - Element to check
     * @param {string[]} selectorList - List of CSS selectors
     * @returns {string[]} - Matching selectors
     */
    function findMatchingSelectors(el, selectorList) {
        const matches = [];
        for (const sel of selectorList) {
            try {
                if (el.matches(sel)) {
                    matches.push(sel);
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }
        return matches;
    }

    /**
     * Check if element matches any exclusion pattern
     * @param {Element} el - Element to check
     * @param {Object} excludeObj - Object with self and ancestors arrays
     * @returns {Object} - Matching exclusions
     */
    function findMatchingExclusions(el, excludeObj) {
        const matches = { self: [], ancestors: [] };

        if (excludeObj.self) {
            for (const sel of excludeObj.self) {
                try {
                    if (el.matches(sel)) {
                        matches.self.push(sel);
                    }
                } catch (e) {
                    // Invalid selector, skip
                }
            }
        }

        if (excludeObj.ancestors) {
            for (const sel of excludeObj.ancestors) {
                try {
                    if (el.closest(sel)) {
                        matches.ancestors.push(sel);
                    }
                } catch (e) {
                    // Invalid selector, skip
                }
            }
        }

        return matches;
    }

    /**
     * Generate a CSS selector for an element
     * @param {Element} el - Element to generate selector for
     * @returns {string} - CSS selector
     */
    function generateCSSSelector(el) {
        if (el.id) {
            return `#${CSS.escape(el.id)}`;
        }

        if (el.classList.length > 0) {
            const classes = Array.from(el.classList).map(c => `.${CSS.escape(c)}`).join('');
            return `${el.tagName.toLowerCase()}${classes}`;
        }

        let path = [];
        let current = el;
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                selector = `#${CSS.escape(current.id)}`;
                path.unshift(selector);
                break;
            }

            let sibling = current;
            let nth = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.tagName === current.tagName) nth++;
            }

            if (nth > 1 || current.nextElementSibling) {
                selector += `:nth-child(${nth})`;
            }

            path.unshift(selector);
            current = current.parentElement;

            if (path.length > 3) break;
        }

        return path.join(' > ');
    }

    /**
     * OpenAI API functions for Summarize The Web
     */


    // API token usage tracking
    let API_TOKENS = {
        digest: { input: 0, output: 0, calls: 0 }
    };

    // API Pricing configuration
    let PRICING = { ...DEFAULT_PRICING };

    // Set to the stored model id when the user's saved selection no longer exists
    // in MODEL_OPTIONS, so the UI can notify them about the fallback
    let MODEL_FALLBACK = '';

    /**
     * Build a MODEL_OPTIONS entry from a user-defined model definition
     */
    function buildCustomModelOption(def) {
        return {
            name: `Custom (${def.apiModel})`,
            apiModel: def.apiModel,
            description: 'User-defined model and pricing',
            inputPer1M: def.inputPer1M,
            outputPer1M: def.outputPer1M,
            recommended: false,
            priority: !!def.priority,
            reasoning: REASONING_EFFORTS.includes(def.reasoning) ? def.reasoning : '',
            custom: true
        };
    }

    function isValidCustomModelDef(def) {
        return def && typeof def.apiModel === 'string' && def.apiModel.trim() !== '' &&
            Number.isFinite(def.inputPer1M) && def.inputPer1M >= 0 &&
            Number.isFinite(def.outputPer1M) && def.outputPer1M >= 0;
    }

    /**
     * Initialize API tracking from storage
     */
    async function initApiTracking(storage) {
        const [tokensRaw, pricingRaw, modelRaw, customRaw] = await Promise.all([
            storage.get(STORAGE_KEYS.API_TOKENS, ''),
            storage.get(STORAGE_KEYS.PRICING, ''),
            storage.get(STORAGE_KEYS.MODEL, ''),
            storage.get(STORAGE_KEYS.CUSTOM_MODEL, '')
        ]);

        try {
            if (tokensRaw) API_TOKENS = JSON.parse(tokensRaw);
        } catch {}

        try {
            if (pricingRaw) PRICING = JSON.parse(pricingRaw);
        } catch {}

        // Register the user-defined custom model, if configured
        try {
            if (customRaw) {
                const def = JSON.parse(customRaw);
                if (isValidCustomModelDef(def)) {
                    MODEL_OPTIONS[CUSTOM_MODEL_ID] = buildCustomModelOption(def);
                }
            }
        } catch {}

        // Apply saved model preference; fall back to the default model when the
        // stored selection no longer exists in MODEL_OPTIONS (flagging it via
        // MODEL_FALLBACK), and keep PRICING in sync with the active model
        let modelId = CFG.model;
        if (modelRaw) {
            if (MODEL_OPTIONS[modelRaw]) {
                modelId = modelRaw;
            } else {
                MODEL_FALLBACK = modelRaw;
            }
        }
        CFG.model = modelId;
        PRICING.model = modelId;
        PRICING.inputPer1M = MODEL_OPTIONS[modelId].inputPer1M;
        PRICING.outputPer1M = MODEL_OPTIONS[modelId].outputPer1M;
    }

    /**
     * Build API headers
     */
    function apiHeaders(key) {
        return {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };
    }

    /**
     * Make XHR POST request (for userscript cross-origin)
     */
    function xhrPost(url, data, headers = {}) {
        return new Promise((resolve, reject) => {
            const api = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
            api({
                method: 'POST',
                url,
                data,
                headers,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) return resolve(r.responseText);
                    const err = new Error(`HTTP ${r.status}`);
                    err.status = r.status;
                    err.body = r.responseText || '';
                    reject(err);
                },
                onerror: (e) => { const err = new Error((e && e.error) || 'Network error'); err.status = 0; reject(err); },
                timeout: 60000,
                ontimeout: () => { const err = new Error('Request timeout'); err.status = 0; reject(err); },
            });
        });
    }

    /**
     * Make XHR GET request
     */
    function xhrGet(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const api = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
            api({
                method: 'GET',
                url,
                headers,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) return resolve(r.responseText);
                    const err = new Error(`HTTP ${r.status}`);
                    err.status = r.status;
                    err.body = r.responseText || '';
                    reject(err);
                },
                onerror: (e) => { const err = new Error((e && e.error) || 'Network error'); err.status = 0; reject(err); },
                timeout: 30000,
                ontimeout: () => { const err = new Error('Request timeout'); err.status = 0; reject(err); },
            });
        });
    }

    /**
     * Extract output text from API response
     */
    function extractOutputText(data) {
        if (typeof data.output_text === 'string') return data.output_text;
        if (Array.isArray(data.output)) {
            const parts = [];
            for (const msg of data.output) {
                if (Array.isArray(msg.content)) {
                    for (const c of msg.content) {
                        if (typeof c.text === 'string') parts.push(c.text);
                        else if (c.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
                    }
                }
            }
            if (parts.length) return parts.join('');
        }
        if (Array.isArray(data.choices)) return data.choices.map((ch) => ch.message?.content || '').join('\n');
        return '';
    }

    // Debounced token-stat persistence; flushed on page hide so a navigation
    // right after a summary doesn't lose the update.
    let pendingTokenSave = null;
    let tokenStorage = null;
    let tokenFlushRegistered = false;

    function flushPendingTokenSave() {
        if (!pendingTokenSave) return;
        clearTimeout(pendingTokenSave);
        pendingTokenSave = null;
        tokenStorage?.set(STORAGE_KEYS.API_TOKENS, JSON.stringify(API_TOKENS));
    }

    /**
     * Update API token usage stats
     */
    function updateApiTokens(storage, type, usage) {
        if (!usage) return;

        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;

        if (inputTokens === 0 && outputTokens === 0) {
            log('WARNING: No token data found in usage object:', usage);
            return;
        }

        API_TOKENS[type].input += inputTokens;
        API_TOKENS[type].output += outputTokens;
        API_TOKENS[type].calls += 1;

        log(`${type} tokens: +${inputTokens} input, +${outputTokens} output (total: ${API_TOKENS[type].input + API_TOKENS[type].output})`);

        tokenStorage = storage;
        if (!tokenFlushRegistered) {
            tokenFlushRegistered = true;
            window.addEventListener('pagehide', flushPendingTokenSave);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') flushPendingTokenSave();
            });
        }

        clearTimeout(pendingTokenSave);
        pendingTokenSave = setTimeout(() => {
            pendingTokenSave = null;
            storage.set(STORAGE_KEYS.API_TOKENS, JSON.stringify(API_TOKENS));
            log('API tokens updated and saved:', API_TOKENS);
        }, 1000);
    }

    /**
     * Reset API token stats
     */
    async function resetApiTokens(storage) {
        API_TOKENS = {
            digest: { input: 0, output: 0, calls: 0 }
        };
        await storage.set(STORAGE_KEYS.API_TOKENS, JSON.stringify(API_TOKENS));
        log('API token stats reset');
    }

    /**
     * Calculate estimated API cost
     */
    function calculateApiCost() {
        const inputCost = API_TOKENS.digest.input * PRICING.inputPer1M / 1_000_000;
        const outputCost = API_TOKENS.digest.output * PRICING.outputPer1M / 1_000_000;
        return inputCost + outputCost;
    }

    /**
     * Call OpenAI API to digest text
     */
    async function digestText(storage, text, mode, prompt, styleLevel, cacheGet, cacheSet, openKeyDialog) {
        const KEY = await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
        if (!KEY) {
            openKeyDialog('OpenAI API key missing.');
            throw Object.assign(new Error('API key missing'), { status: 401 });
        }

        // Check cache first
        const cached = await cacheGet(text, mode);
        if (cached) {
            log(`Using cached summary for ${mode} mode`);
            return cached.result;
        }

        const safeInput = text.replace(/[\u2028\u2029]/g, ' ');

        // Get the actual API model name (not the UI identifier)
        const apiModelName = MODEL_OPTIONS[CFG.model]?.apiModel || CFG.model;

        // Append style instructions to prompt
        const styleInstruction = STYLE_INSTRUCTIONS[styleLevel] || '';
        const fullPrompt = prompt + styleInstruction;

        const requestBody = {
            model: apiModelName,
            max_output_tokens: mode.includes('small') ? MAX_OUTPUT_TOKENS.small : MAX_OUTPUT_TOKENS.large,
            instructions: fullPrompt,
            input: safeInput
        };

        // Reasoning effort: custom models use their configured value (empty means
        // send no reasoning parameter); built-in GPT-5 models are reasoning models,
        // so minimize reasoning for summarization
        const modelOption = MODEL_OPTIONS[CFG.model];
        if (modelOption?.custom) {
            if (modelOption.reasoning) {
                requestBody.reasoning = { effort: modelOption.reasoning };
            }
        } else if (apiModelName.startsWith('gpt-5')) {
            requestBody.reasoning = { effort: 'minimal' };
        }

        // Add service_tier for priority models
        if (MODEL_OPTIONS[CFG.model]?.priority) {
            requestBody.service_tier = 'priority';
        }

        const body = JSON.stringify(requestBody);

        const resText = await xhrPost('https://api.openai.com/v1/responses', body, apiHeaders(KEY));
        const payload = JSON.parse(resText);
        log('API response status:', payload.status, 'usage:', payload.usage);

        if (payload.usage) {
            updateApiTokens(storage, 'digest', payload.usage);
        }

        // Check for incomplete response
        if (payload.status === 'incomplete') {
            const reason = payload.incomplete_details?.reason || 'unknown';
            let errorMsg = 'API response incomplete';
            if (reason === 'max_output_tokens') {
                const reasoningTokens = payload.usage?.output_tokens_details?.reasoning_tokens || 0;
                if (reasoningTokens > 0) {
                    errorMsg = `Model used all tokens on reasoning (${reasoningTokens} tokens). Try a different model or increase max_output_tokens in config.js`;
                } else {
                    errorMsg = 'Response exceeded max_output_tokens limit. Try selecting less text or increase the limit in config.js';
                }
            }
            throw Object.assign(new Error(errorMsg), { status: 400, isIncomplete: true });
        }

        const outStr = extractOutputText(payload);
        log('Extracted output:', outStr ? outStr.substring(0, 100) + '...' : 'null');
        if (!outStr) throw Object.assign(new Error('No output from API. The model returned an empty response.'), { status: 400 });

        // Strip markdown code fences if present
        const cleaned = outStr.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

        // Try to parse as JSON (API might return array or plain text)
        let result;
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                result = parsed.join('\n\n');
            } else if (typeof parsed === 'string') {
                result = parsed;
            } else {
                result = cleaned;
            }
        } catch (e) {
            result = cleaned;
        }

        await cacheSet(text, mode, result);
        return result;
    }

    /**
     * Handle API errors with friendly messages
     */
    function friendlyApiError(err, openKeyDialog, openInfo) {
        log('API error:', err?.status, err?.message);
        const s = err?.status || 0;
        if (s === 401) { openKeyDialog('Unauthorized (401). Please enter a valid OpenAI key.'); return; }
        if (s === 429) { openInfo('Rate limited by API (429). Try again in a minute.'); return; }
        if (err.isIncomplete) { openInfo(err.message); return; }
        if (s === 400) { openInfo(err.message || 'Bad request (400). The API could not parse the text. Try selecting less text.'); return; }
        openInfo(`Unknown error${s ? ' (' + s + ')' : ''}. Check your network or try again.`);
    }

    /**
     * Cache management for Summarize The Web
     *
     * Summaries are keyed by mode + a hash of the article text, so the stored
     * blob stays small. Loading is lazy: pages that never summarize don't pay
     * the JSON.parse cost, and writes happen immediately on set() (no polling).
     */


    // Storage key of the pre-hash cache format (entries keyed by the full
    // article text). Deleted on first load; superseded by STORAGE_KEYS.CACHE.
    const LEGACY_CACHE_KEY = 'digest_cache_v1';

    class DigestCache {
        constructor(storage) {
            this.storage = storage;
            this.cache = {};
            this.dirty = false;
            this.loaded = null;
        }

        /**
         * Load cache from storage. Idempotent and lazy: get/set/getSize call it
         * automatically, so callers don't need to initialize eagerly.
         */
        init() {
            if (!this.loaded) {
                this.loaded = (async () => {
                    try {
                        const stored = await this.storage.get(STORAGE_KEYS.CACHE, '{}');
                        this.cache = JSON.parse(stored);
                    } catch {
                        this.cache = {};
                    }
                    // Best-effort cleanup of the legacy full-text cache blob.
                    try { await this.storage.delete(LEGACY_CACHE_KEY); } catch {}
                })();
            }
            return this.loaded;
        }

        /**
         * Generate cache key (mode + text length + content hash)
         */
        key(text, mode) {
            return `${mode}:${text.length}:${hashText(text)}`;
        }

        /**
         * Get cached result
         */
        async get(text, mode) {
            await this.init();
            return this.cache[this.key(text, mode)];
        }

        /**
         * Set cached result (persists immediately)
         */
        async set(text, mode, result) {
            await this.init();
            this.cache[this.key(text, mode)] = { result, timestamp: Date.now() };
            this.dirty = true;

            // Trim cache if needed
            const keys = Object.keys(this.cache);
            if (keys.length > CACHE_LIMIT) {
                const sorted = keys
                    .map(k => ({ key: k, time: this.cache[k].timestamp || 0 }))
                    .sort((a, b) => b.time - a.time);
                const keep = sorted.slice(0, CACHE_TRIM_TO).map(x => x.key);
                const newCache = {};
                keep.forEach(k => { newCache[k] = this.cache[k]; });
                this.cache = newCache;
            }

            await this.save();
        }

        /**
         * Clear entire cache
         */
        async clear() {
            this.cache = {};
            this.dirty = false;
            this.loaded = Promise.resolve();
            await this.storage.delete(STORAGE_KEYS.CACHE);
            log('cache cleared');
        }

        /**
         * Save cache to storage
         */
        async save() {
            if (!this.dirty) return;
            this.dirty = false;
            await this.storage.set(STORAGE_KEYS.CACHE, JSON.stringify(this.cache));
        }

        /**
         * Get cache size (loads the cache if needed)
         */
        async getSize() {
            await this.init();
            return Object.keys(this.cache).length;
        }

        /**
         * Get cache size of the already-loaded cache (sync)
         */
        get size() {
            return Object.keys(this.cache).length;
        }
    }

    /**
     * Shared modal dialog scaffolding for Summarize The Web
     *
     * Every dialog (settings, editors, inspection) uses the same shell: a host
     * element with a shadow root for CSS isolation, a fixed backdrop wrapper,
     * close-on-backdrop-click, close-on-Escape and initial focus.
     */


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
    function createDialog({ css, bodyHTML, onClose = null, closeOnBackdrop = true, closeOnEscape = true, focusWrap = true }) {
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

    /**
     * Settings dialogs and management for Summarize The Web
     */


    /**
     * Build a validator callback that tests an OpenAI key via GET /v1/models.
     * Shared by the key editor, the missing-key dialog and the welcome flow.
     */
    function makeKeyValidator(storage, { success = 'Validation OK (HTTP 200)', empty = 'No key to test' } = {}) {
        return async (val) => {
            const key = val || await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
            if (!key) { openInfo(empty); return; }
            try {
                await xhrGet('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
                openInfo(success);
            } catch (e) {
                openInfo(`Validation failed: ${e.message || e}`);
            }
        };
    }

    const KEY_HINT = 'Stored locally (GM → localStorage → memory). Validate sends GET /v1/models.';

    /**
     * Polymorphic editor for lists, secrets, domains, and info display
     */
    function openEditor({ title, hint = 'One item per line', mode = 'list', initial = [], globalItems = [], onSave, onValidate, onClose }) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:680px;width:92%;border-radius:10px;
               box-shadow:0 10px 40px rgba(0,0,0,.35);padding:16px 16px 12px;box-sizing:border-box}
        .modal h3{margin:0 0 8px;font:600 16px/1.2 system-ui,sans-serif}
        .section-label{font:600 13px/1.2 system-ui,sans-serif;margin:8px 0 4px;color:#444}
        textarea{width:100%;height:220px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:13px/1.4 ui-monospace,Consolas,monospace;border:1px solid #ccc;border-radius:4px}
        textarea.readonly{background:#f5f5f5;color:#666;height:120px}
        textarea.editable{height:180px}
        .row{display:flex;gap:8px;align-items:center}
        input[type=password],input[type=text]{flex:1;padding:10px;border-radius:8px;border:1px solid #ccc;
                 font:14px/1.3 ui-monospace,Consolas,monospace;box-sizing:border-box}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
        .actions button{padding:8px 12px;border-radius:8px;border:1px solid #d0d0d0;background:#f6f6f6;cursor:pointer}
        .actions .save{background:#667eea;color:#fff;border-color:#667eea}
        .actions .test{background:#34a853;color:#fff;border-color:#34a853}
        .hint{margin:8px 0 0;color:#666;font:12px/1.2 system-ui,sans-serif}
    `;

        const listText = (items) => escapeHtml(Array.isArray(items) ? items.join('\n') : String(items));

        const bodyList = `<textarea spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">${listText(initial)}</textarea>`;
        const bodyDomain = `
        <div class="section-label">Global settings (read-only):</div>
        <textarea class="readonly" readonly spellcheck="false">${listText(globalItems)}</textarea>
        <div class="section-label">Domain-specific additions (editable):</div>
        <textarea class="editable" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">${listText(initial)}</textarea>
    `;
        const bodySecret = `
        <div class="row">
            <input id="sec" type="password" placeholder="sk-..." autocomplete="off" />
            <button id="toggle" title="Show/Hide">👁</button>
        </div>`;
        const bodyInfo = `<textarea class="readonly" readonly spellcheck="false" style="height:auto;min-height:60px;max-height:300px;">${listText(initial)}</textarea>`;

        let bodyContent, actionsContent;
        if (mode === 'info') {
            bodyContent = bodyInfo;
            actionsContent = '<button class="cancel">Close</button>';
        } else if (mode === 'secret') {
            bodyContent = bodySecret;
            actionsContent = (onValidate ? '<button class="test">Validate</button>' : '') + '<button class="save">Save</button><button class="cancel">Cancel</button>';
        } else if (mode === 'domain') {
            bodyContent = bodyDomain;
            actionsContent = '<button class="save">Save</button><button class="cancel">Cancel</button>';
        } else {
            bodyContent = bodyList;
            actionsContent = '<button class="save">Save</button><button class="cancel">Cancel</button>';
        }

        const { shadow, close } = createDialog({
            css,
            onClose,
            bodyHTML: `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <h3>${escapeHtml(title)}</h3>
            ${bodyContent}
            <div class="actions">
                ${actionsContent}
            </div>
            <p class="hint">${escapeHtml(hint)}</p>
        </div>`
        });

        if (mode === 'info') {
            shadow.querySelector('.cancel').addEventListener('click', close);
            shadow.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); close(); }
            });
        } else if (mode === 'secret') {
            const inp = shadow.querySelector('#sec');
            const btnSave = shadow.querySelector('.save');
            const btnToggle = shadow.querySelector('#toggle');
            if (typeof initial === 'string' && initial) inp.value = initial;
            btnToggle.addEventListener('click', () => { inp.type = (inp.type === 'password') ? 'text' : 'password'; inp.focus(); });
            btnSave.addEventListener('click', async () => {
                const v = inp.value.trim();
                if (!v) return;
                await onSave?.(v);
                btnSave.textContent = 'Saved';
                btnSave.style.background = '#34a853';
                btnSave.style.borderColor = '#34a853';
                setTimeout(close, 1000);
            });
            shadow.querySelector('.cancel').addEventListener('click', close);
            shadow.querySelector('.test')?.addEventListener('click', async () => { await onValidate?.(inp.value.trim()); });
            shadow.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSave.click(); }
            });
            inp.focus();
        } else {
            const ta = shadow.querySelector(mode === 'domain' ? 'textarea.editable' : 'textarea');
            const btnSave = shadow.querySelector('.save');
            btnSave.addEventListener('click', async () => { const lines = parseLines(ta.value); await onSave?.(lines); close(); });
            shadow.querySelector('.cancel').addEventListener('click', close);
            shadow.addEventListener('keydown', e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSave.click(); }
            });
            ta.focus();
            ta.selectionStart = ta.selectionEnd = ta.value.length;
        }
    }

    /**
     * Show info dialog
     */
    function openInfo(message) {
        openEditor({ title: 'Summarize The Web', mode: 'info', initial: message, hint: 'Press Enter or Escape to close.' });
    }

    /**
     * Open the API key editor with the currently stored key (menu entry point)
     */
    async function openApiKeyEditor(storage) {
        const current = await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
        openEditor({
            title: 'OpenAI API key',
            mode: 'secret',
            initial: current,
            hint: KEY_HINT,
            onSave: async (val) => { await storage.set(STORAGE_KEYS.OPENAI_KEY, val); },
            onValidate: makeKeyValidator(storage)
        });
    }

    /**
     * Show API key dialog (missing/invalid key flow; deduplicated per page)
     */
    function openKeyDialog(storage, extra, apiKeyDialogShown) {
        if (apiKeyDialogShown.value) {
            return;
        }
        apiKeyDialogShown.value = true;

        openEditor({
            title: extra || 'OpenAI API key',
            mode: 'secret',
            initial: '',
            hint: KEY_HINT,
            // Reset on every close path (save, cancel, Escape, backdrop) so the
            // dialog can reappear if the key is still missing later.
            onClose: () => { apiKeyDialogShown.value = false; },
            onSave: async (val) => { await storage.set(STORAGE_KEYS.OPENAI_KEY, val); },
            onValidate: makeKeyValidator(storage)
        });
    }

    /**
     * Show welcome dialog (first install)
     */
    function openWelcomeDialog(storage) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:580px;width:94%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.4);padding:24px;box-sizing:border-box}
        .modal h2{margin:0 0 16px;font:700 20px/1.3 system-ui,sans-serif;color:#1a1a1a}
        .modal p{margin:0 0 12px;font:14px/1.6 system-ui,sans-serif;color:#444}
        .modal .steps{background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;
                       font:13px/1.5 system-ui,sans-serif}
        .modal .steps ol{margin:8px 0 0;padding-left:20px}
        .modal .steps li{margin:6px 0}
        .modal .steps a{color:#667eea;text-decoration:none}
        .modal .steps a:hover{text-decoration:underline}
        .actions{display:flex;gap:12px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;font:600 14px system-ui,sans-serif;
             cursor:pointer;transition:all 0.15s ease}
        .btn.primary{background:#667eea;color:#fff}
        .btn.primary:hover{background:#5568d3}
        .btn.secondary{background:#e8eaed;color:#1a1a1a}
        .btn.secondary:hover{background:#dadce0}
    `;

        let continued = false;

        const { shadow, close } = createDialog({
            css,
            // Cancel semantics apply to every close path (button, Escape,
            // backdrop) except the explicit "Set Up API Key" continuation.
            onClose: async () => {
                if (continued) return;
                await storage.set(STORAGE_KEYS.FIRST_INSTALL, 'true');
                openInfo('You can set up your API key anytime via the userscript menu:\n"Set / Validate OpenAI API key"');
            },
            bodyHTML: `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Welcome">
            <h2>Welcome to Summarize The Web!</h2>
            <p>This userscript helps you summarize and simplify web articles using AI.</p>
            <p>To get started, you'll need an OpenAI API key:</p>
            <div class="steps">
                <ol>
                    <li>Visit <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API Keys</a></li>
                    <li>Sign in or create an account</li>
                    <li>Click "Create new secret key"</li>
                    <li>Copy the key and paste it in the next dialog</li>
                </ol>
            </div>
            <p style="font-size:13px;color:#666;margin-top:16px"><strong>Domain control:</strong> By default, all websites are disabled. After setup, you can enable websites one by one via the menu.</p>
            <p style="font-size:13px;color:#666">The script uses GPT-5 Nano (cost-effective). Your key is stored locally and never shared.</p>
            <div class="actions">
                <button class="btn secondary cancel">Maybe Later</button>
                <button class="btn primary continue">Set Up API Key</button>
            </div>
        </div>`
        });

        shadow.querySelector('.continue').addEventListener('click', () => {
            continued = true;
            close();
            openEditor({
                title: 'OpenAI API key',
                mode: 'secret',
                initial: '',
                hint: 'Paste your API key here. Click Validate to test it, then Save.',
                onSave: async (val) => {
                    await storage.set(STORAGE_KEYS.OPENAI_KEY, val);
                    await storage.set(STORAGE_KEYS.DOMAINS_MODE, 'deny');
                    await storage.set(STORAGE_KEYS.FIRST_INSTALL, 'true');
                    openInfo('API key saved! The script will now work on all websites. Reload any page to see it in action.');
                },
                onValidate: makeKeyValidator(storage, {
                    success: 'Validation OK! Click Save to continue.',
                    empty: 'Please enter your API key first'
                })
            });
        });

        shadow.querySelector('.cancel').addEventListener('click', close);
    }

    /**
     * Show simplification style dialog
     */
    function openSimplificationStyleDialog(storage, currentLevel, setSimplification) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:520px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box}
        h3{margin:0 0 8px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .subtitle{margin:0 0 20px;font:13px/1.4 system-ui,sans-serif;color:#666}
        .option{padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;
                cursor:pointer;transition:all 0.2s}
        .option:hover{border-color:#667eea;background:#f8f9ff}
        .option.selected{border-color:#667eea;background:#667eea;color:#fff}
        .option-title{font:600 15px/1.2 system-ui,sans-serif;margin-bottom:6px}
        .option-desc{font:13px/1.4 system-ui,sans-serif;opacity:0.85}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
    `;

        const descriptions = {
            'Conservative': 'Minimal rephrasing - preserves original style and structure',
            'Balanced': 'Moderate simplification - good balance of clarity and faithfulness (Recommended)',
            'Aggressive': 'Maximum simplification - more creative rephrasing for easier reading'
        };

        const optionsHtml = SIMPLIFICATION_LEVELS.map(level => `
        <div class="option ${level === currentLevel ? 'selected' : ''}" data-level="${level}">
            <div class="option-title">${level}</div>
            <div class="option-desc">${descriptions[level]}</div>
        </div>
    `).join('');

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal">
            <h3>Simplification Style</h3>
            <p class="subtitle">Controls how the AI simplifies language. Large/Small buttons control the target length.</p>
            ${optionsHtml}
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Clear Cache</button>
            </div>
        </div>`
        });

        let selectedLevel = currentLevel;

        const options = shadow.querySelectorAll('.option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedLevel = opt.dataset.level;
            });
        });

        const btnSave = shadow.querySelector('.btn-save');
        btnSave.addEventListener('click', async () => {
            if (!SIMPLIFICATION_LEVELS.includes(selectedLevel)) return;
            await setSimplification(selectedLevel);
            btnSave.textContent = 'Saved!';
            btnSave.style.background = '#34a853';
            setTimeout(close, 800);
        });

        shadow.querySelector('.btn-cancel').addEventListener('click', close);
    }

    /**
     * Show model selection dialog
     */
    function openModelSelectionDialog(storage, currentModel, onSelect) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box}
        h3{margin:0 0 8px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .subtitle{margin:0 0 20px;font:13px/1.4 system-ui,sans-serif;color:#666}
        .option{padding:16px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;
                cursor:pointer;transition:all 0.2s;position:relative}
        .option:hover{border-color:#667eea;background:#f8f9ff}
        .option.selected{border-color:#667eea;background:#667eea;color:#fff}
        .option-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px}
        .option-title{font:600 16px/1.2 system-ui,sans-serif}
        .option-badge{font:600 10px/1.2 system-ui,sans-serif;padding:4px 8px;
                      border-radius:4px;background:#34a853;color:#fff;text-transform:uppercase}
        .option.selected .option-badge{background:rgba(255,255,255,0.3)}
        .option-desc{font:13px/1.5 system-ui,sans-serif;opacity:0.85;margin-bottom:8px}
        .option-pricing{font:12px/1.3 system-ui,sans-serif;opacity:0.7;font-family:ui-monospace,monospace}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
        .custom-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
        .custom-fields label{font:12px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;gap:4px}
        .custom-fields .custom-full{grid-column:1/-1}
        .custom-fields .custom-fast{flex-direction:row;align-items:center;gap:8px;grid-column:1/-1}
        .custom-fields input[type=text],.custom-fields input[type=number],.custom-fields select{
            padding:8px;border:2px solid #e0e0e0;border-radius:6px;width:100%;
            font:13px system-ui,sans-serif;color:#1a1a1a;background:#fff;box-sizing:border-box}
        .custom-fields input:focus,.custom-fields select:focus{outline:none;border-color:#667eea}
        .custom-error{margin-top:8px;font:600 12px system-ui,sans-serif;color:#d93025}
        .option.selected .custom-error{color:#ffd7d4}
    `;

        const optionsHtml = Object.keys(MODEL_OPTIONS).filter(id => id !== CUSTOM_MODEL_ID).map(modelId => {
            const model = MODEL_OPTIONS[modelId];
            const isSelected = modelId === currentModel;
            const badge = model.recommended ? '<span class="option-badge">Recommended</span>' : '';
            return `
            <div class="option ${isSelected ? 'selected' : ''}" data-model="${modelId}">
                <div class="option-header">
                    <div class="option-title">${model.name}</div>
                    ${badge}
                </div>
                <div class="option-desc">${model.description}</div>
                <div class="option-pricing">$${model.inputPer1M.toFixed(2)}/1M input • $${model.outputPer1M.toFixed(2)}/1M output</div>
            </div>
        `;
        }).join('');

        const custom = MODEL_OPTIONS[CUSTOM_MODEL_ID];
        const customHtml = `
        <div class="option ${currentModel === CUSTOM_MODEL_ID ? 'selected' : ''}" data-model="${CUSTOM_MODEL_ID}">
            <div class="option-header">
                <div class="option-title">Custom model</div>
            </div>
            <div class="option-desc">Use any OpenAI model ID with the pricing you enter (see the OpenAI pricing page)</div>
            <div class="custom-fields">
                <label class="custom-full">Model ID
                    <input type="text" class="custom-id" placeholder="e.g. gpt-5.6-sol" value="${custom ? escapeHtml(custom.apiModel) : ''}">
                </label>
                <label>$ per 1M input tokens
                    <input type="number" class="custom-in" min="0" step="0.01" value="${custom ? custom.inputPer1M : ''}">
                </label>
                <label>$ per 1M output tokens
                    <input type="number" class="custom-out" min="0" step="0.01" value="${custom ? custom.outputPer1M : ''}">
                </label>
                <label class="custom-full">Reasoning effort
                    <select class="custom-reasoning">
                        <option value="">Model default (no parameter sent)</option>
                        ${REASONING_EFFORTS.map(effort => `
                            <option value="${effort}" ${custom && custom.reasoning === effort ? 'selected' : ''}>
                                ${effort.charAt(0).toUpperCase() + effort.slice(1)}
                            </option>
                        `).join('')}
                    </select>
                </label>
                <label class="custom-fast">
                    <input type="checkbox" class="custom-priority" ${custom && custom.priority ? 'checked' : ''}>
                    Fast mode (faster processing, enter the Fast tier prices)
                </label>
            </div>
            <div class="custom-error"></div>
        </div>
    `;

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal">
            <h3>AI Model Selection</h3>
            <p class="subtitle">Choose the OpenAI model for summarization. Higher-tier models provide better quality but cost more.</p>
            ${optionsHtml}
            ${customHtml}
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Reload</button>
            </div>
        </div>`
        });

        let selectedModel = currentModel;

        const options = shadow.querySelectorAll('.option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedModel = opt.dataset.model;
            });
        });

        const btnSave = shadow.querySelector('.btn-save');
        btnSave.addEventListener('click', async () => {
            if (selectedModel === CUSTOM_MODEL_ID) {
                const apiModel = shadow.querySelector('.custom-id').value.trim();
                const inputPer1M = parseFloat(shadow.querySelector('.custom-in').value);
                const outputPer1M = parseFloat(shadow.querySelector('.custom-out').value);
                const priority = shadow.querySelector('.custom-priority').checked;
                const reasoningValue = shadow.querySelector('.custom-reasoning').value;
                const reasoning = REASONING_EFFORTS.includes(reasoningValue) ? reasoningValue : '';
                const errEl = shadow.querySelector('.custom-error');
                if (!apiModel) {
                    errEl.textContent = 'Enter a model ID.';
                    return;
                }
                if (!Number.isFinite(inputPer1M) || inputPer1M < 0 || !Number.isFinite(outputPer1M) || outputPer1M < 0) {
                    errEl.textContent = 'Enter non-negative input and output prices per 1M tokens.';
                    return;
                }
                const def = { apiModel, inputPer1M, outputPer1M, priority, reasoning };
                await storage.set(STORAGE_KEYS.CUSTOM_MODEL, JSON.stringify(def));
                MODEL_OPTIONS[CUSTOM_MODEL_ID] = buildCustomModelOption(def);
            }
            if (!MODEL_OPTIONS[selectedModel]) return;
            await onSelect(selectedModel);
            btnSave.textContent = 'Saved! Reloading...';
            btnSave.style.background = '#34a853';
            setTimeout(() => location.reload(), 800);
        });

        shadow.querySelector('.btn-cancel').addEventListener('click', close);
    }

    /**
     * Show a small self-dismissing toast with an optional action link
     */
    function showToast(message, { actionLabel, onAction, timeoutMs = 15000 } = {}) {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
        .toast{position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;
               background:#1a1a1a;color:#fff;border-radius:10px;padding:14px 32px 14px 16px;
               box-shadow:0 6px 24px rgba(0,0,0,.35);font:13px/1.5 system-ui,sans-serif}
        .toast a{color:#a5b4fc;cursor:pointer;text-decoration:underline;font-weight:600;white-space:nowrap}
        .close{position:absolute;top:8px;right:10px;cursor:pointer;opacity:.6;font:16px/1 system-ui,sans-serif}
        .close:hover{opacity:1}
    `;
        const div = document.createElement('div');
        div.className = 'toast';
        setHTML(div, '<span class="close">&times;</span><span class="msg"></span>');
        div.querySelector('.msg').textContent = message;

        const dismiss = () => host.remove();

        if (actionLabel && onAction) {
            const link = document.createElement('a');
            link.textContent = actionLabel;
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                dismiss();
                onAction();
            });
            div.querySelector('.msg').append(' ');
            div.querySelector('.msg').appendChild(link);
        }

        div.querySelector('.close').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });

        shadow.append(style, div);
        document.body.appendChild(host);
        setTimeout(dismiss, timeoutMs);
    }

    /**
     * Show custom prompts dialog
     */
    function openCustomPromptDialog(storage, currentPrompts, onSave) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;overflow-y:auto}
        .modal{background:#fff;max-width:700px;width:94%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box;
               margin:20px;max-height:90vh;overflow-y:auto}
        h3{margin:0 0 16px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .section{margin:16px 0}
        .section-label{font:600 12px/1.2 system-ui,sans-serif;margin:0 0 6px;color:#555;
                       text-transform:uppercase;letter-spacing:0.5px}
        textarea{width:100%;height:100px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:12px/1.4 ui-monospace,Consolas,monospace;border:2px solid #e0e0e0;
                 border-radius:8px}
        textarea:focus{outline:none;border-color:#667eea}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;
                 position:sticky;bottom:0;background:#fff;padding-top:12px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-reset{background:#ff6b6b;color:#fff}
        .btn-reset:hover{background:#ee5a52}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
        .hint{margin:6px 0 0;color:#999;font:11px/1.3 system-ui,sans-serif}
    `;

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal">
            <h3>Custom Summary Prompts</h3>
            <div class="section">
                <div class="section-label">Large Summary (50%)</div>
                <textarea id="summary-large-prompt">${escapeHtml(currentPrompts.summary_large || DEFAULT_PROMPTS.summary_large)}</textarea>
                <p class="hint">Summarizes content to approximately 50% of original length</p>
            </div>
            <div class="section">
                <div class="section-label">Small Summary (20%)</div>
                <textarea id="summary-small-prompt">${escapeHtml(currentPrompts.summary_small || DEFAULT_PROMPTS.summary_small)}</textarea>
                <p class="hint">Creates a concise summary at approximately 20% of original length</p>
            </div>
            <div class="actions">
                <button class="btn btn-reset">Reset to Default</button>
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Clear Cache</button>
            </div>
        </div>`
        });

        const summaryLarge = shadow.querySelector('#summary-large-prompt');
        const summarySmall = shadow.querySelector('#summary-small-prompt');
        const btnSave = shadow.querySelector('.btn-save');
        const btnReset = shadow.querySelector('.btn-reset');

        btnSave.addEventListener('click', async () => {
            const prompts = {
                summary_large: summaryLarge.value.trim() || DEFAULT_PROMPTS.summary_large,
                summary_small: summarySmall.value.trim() || DEFAULT_PROMPTS.summary_small
            };
            await onSave(prompts);
            btnSave.textContent = 'Saved!';
            btnSave.style.background = '#34a853';
            setTimeout(close, 1000);
        });

        btnReset.addEventListener('click', () => {
            summaryLarge.value = DEFAULT_PROMPTS.summary_large;
            summarySmall.value = DEFAULT_PROMPTS.summary_small;
            btnReset.textContent = 'Reset!';
            setTimeout(() => { btnReset.textContent = 'Reset to Default'; }, 1000);
        });

        shadow.querySelector('.btn-cancel').addEventListener('click', close);
    }

    /**
     * Show usage statistics dialog
     */
    function showStats(cacheSize) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);
             display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:92%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.4);padding:20px;box-sizing:border-box;
               max-height:80vh;overflow-y:auto}
        h3{margin:0 0 16px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .section{background:#f8f9fa;padding:14px;border-radius:8px;margin:12px 0;
                 border-left:3px solid #667eea}
        .section h4{margin:0 0 10px;font:600 15px/1.2 system-ui,sans-serif;color:#667eea}
        .stat-row{display:flex;justify-content:space-between;padding:6px 0;
                  font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid #e9ecef}
        .stat-row:last-child{border-bottom:none}
        .stat-label{color:#495057;font-weight:500}
        .stat-value{color:#212529;font-weight:600}
        .cost-highlight{background:#e8f4fd;padding:12px;border-radius:6px;margin:12px 0;
                        border-left:3px solid #667eea}
        .cost-label{font:13px/1.2 system-ui,sans-serif;color:#666;margin-bottom:4px}
        .cost-value{font:24px/1.2 system-ui,sans-serif;font-weight:700;color:#667eea}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-close{background:#667eea;color:#fff}
        .btn-close:hover{background:#5568d3}
        .note{font:11px/1.4 system-ui,sans-serif;color:#6c757d;margin-top:12px;
              padding:8px;background:#fff3cd;border-radius:4px;border-left:3px solid #ffc107}
    `;

        const totalTokens = API_TOKENS.digest.input + API_TOKENS.digest.output;
        const totalCalls = API_TOKENS.digest.calls;
        const estimatedCost = calculateApiCost();

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal">
            <h3>Usage Statistics</h3>

            <div class="cost-highlight">
                <div class="cost-label">Estimated Total Cost</div>
                <div class="cost-value">$${estimatedCost.toFixed(4)}</div>
            </div>

            <div class="section">
                <h4>API Usage (All Time)</h4>
                <div class="stat-row">
                    <span class="stat-label">Total API Calls</span>
                    <span class="stat-value">${totalCalls.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Tokens</span>
                    <span class="stat-value">${totalTokens.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Input Tokens</span>
                    <span class="stat-value">${API_TOKENS.digest.input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Output Tokens</span>
                    <span class="stat-value">${API_TOKENS.digest.output.toLocaleString()}</span>
                </div>
            </div>

            <div class="section">
                <h4>Cache Statistics</h4>
                <div class="stat-row">
                    <span class="stat-label">Cached Digests</span>
                    <span class="stat-value">${cacheSize} entries</span>
                </div>
            </div>

            <div class="section">
                <h4>Current Model Configuration</h4>
                <div class="stat-row">
                    <span class="stat-label">Model</span>
                    <span class="stat-value">${MODEL_OPTIONS[PRICING.model]?.name || PRICING.model}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Input Cost</span>
                    <span class="stat-value">$${PRICING.inputPer1M.toFixed(2)} / 1M tokens</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Output Cost</span>
                    <span class="stat-value">$${PRICING.outputPer1M.toFixed(2)} / 1M tokens</span>
                </div>
            </div>

            <div class="note">
                Usage stats persist across page loads. Use "Reset API usage stats" from the menu to clear counters.
            </div>

            <div class="actions">
                <button class="btn btn-close">Close</button>
            </div>
        </div>`
        });

        shadow.querySelector('.btn-close').addEventListener('click', close);
    }

    /**
     * Show domain list editor dialog
     */
    function openDomainEditor(storage, mode, DOMAIN_ALLOW, DOMAIN_DENY) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:20px;box-sizing:border-box}
        h3{margin:0 0 12px;font:600 18px/1.2 system-ui,sans-serif}
        textarea{width:100%;height:240px;resize:vertical;padding:12px;box-sizing:border-box;
                 font:13px/1.4 ui-monospace,Consolas,monospace;border:2px solid #e0e0e0;
                 border-radius:8px}
        textarea:focus{outline:none;border-color:#667eea}
        .hint{margin:12px 0;color:#666;font:12px/1.4 system-ui,sans-serif}
        .actions{display:flex;gap:8px;justify-content:flex-end}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
    `;

        const list = mode === 'allow' ? DOMAIN_ALLOW : DOMAIN_DENY;
        const title = mode === 'allow' ? 'Allowlist (Enabled Domains)' : 'Denylist (Disabled Domains)';
        const hint = mode === 'allow'
            ? 'In ALLOW mode, the script only runs on these domains. One pattern per line. Supports wildcards (*.example.com) and regex (/pattern/).'
            : 'In DENY mode, the script is disabled on these domains. One pattern per line. Supports wildcards (*.example.com) and regex (/pattern/).';

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal">
            <h3>${escapeHtml(title)}</h3>
            <textarea>${escapeHtml(list.join('\n'))}</textarea>
            <p class="hint">${escapeHtml(hint)}</p>
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Reload</button>
            </div>
        </div>`
        });

        const textarea = shadow.querySelector('textarea');

        shadow.querySelector('.btn-save').addEventListener('click', async () => {
            const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
            if (mode === 'allow') {
                await storage.set(STORAGE_KEYS.DOMAINS_ALLOW, JSON.stringify(lines));
            } else {
                await storage.set(STORAGE_KEYS.DOMAINS_DENY, JSON.stringify(lines));
            }
            location.reload();
        });

        shadow.querySelector('.btn-cancel').addEventListener('click', close);
    }

    /**
     * Show unified selector editor dialog (global + domain-specific, tabbed)
     */
    function openSelectorEditor({ host, selectorsGlobal, excludeGlobal, selectorsDomain, excludeDomain, defaultSelectors, defaultExcludes, onSave }) {
        const css = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.4);
              display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 0}
        .modal{background:linear-gradient(135deg,#f8f9ff 0%,#fff5f7 100%);max-width:700px;width:96%;
               border-radius:16px;box-shadow:0 10px 40px rgba(102,126,234,0.35);
               display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;
               border:3px solid #667eea;max-height:calc(100vh - 80px)}
        .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:16px 20px;
                display:flex;align-items:center;justify-content:space-between}
        .header-title{font:600 16px/1.2 system-ui,sans-serif;color:#fff}
        .header-close{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);
                      color:#fff;font-size:20px;font-weight:600;width:32px;height:32px;
                      border-radius:8px;cursor:pointer;display:flex;align-items:center;
                      justify-content:center;transition:all 0.2s;padding:0;line-height:1}
        .header-close:hover{background:rgba(255,255,255,0.3);transform:scale(1.05)}
        .content{padding:20px;overflow-y:auto;flex:1}
        .tabs{display:inline-flex;margin:0 0 16px;background:rgba(102,126,234,0.15);border-radius:8px;padding:4px}
        .tab{padding:8px 16px;border:none;background:none;cursor:pointer;
             font:600 13px/1.2 system-ui,sans-serif;color:#667eea;border-radius:6px;
             transition:all 0.15s;white-space:nowrap}
        .tab:hover{background:rgba(255,255,255,0.5)}
        .tab.active{background:#fff;color:#667eea;box-shadow:0 2px 8px rgba(102,126,234,0.25)}
        .tab-panel{display:none}
        .tab-panel.active{display:block}
        .section{margin:0 0 16px;padding:12px;background:rgba(255,255,255,0.8);border-radius:8px;
                 border:1px solid rgba(102,126,234,0.15)}
        .section:last-child{margin-bottom:0}
        .section-label{font:600 13px system-ui,sans-serif;margin:0 0 8px;color:#667eea;
                       text-transform:uppercase;letter-spacing:0.5px}
        .section-hint{font:11px/1.3 system-ui,sans-serif;color:#888;margin:4px 0 0}
        textarea{width:100%;height:100px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:12px/1.4 ui-monospace,Consolas,monospace;border:1px solid rgba(102,126,234,0.2);
                 border-radius:6px;background:#fff}
        textarea:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
        textarea.readonly{background:#f0f0f5;color:#666;height:70px;cursor:default}
        textarea.editable{height:80px}
        .context-label{font:500 10px/1.2 system-ui,sans-serif;color:#888;margin:10px 0 4px;
                       text-transform:uppercase;letter-spacing:0.3px}
        .footer{padding:16px 20px;background:rgba(102,126,234,0.05);
                border-top:1px solid rgba(102,126,234,0.15);display:flex;gap:8px;justify-content:flex-end}
        .btn{padding:10px 16px;border-radius:8px;border:none;cursor:pointer;
             font:600 13px system-ui,sans-serif;transition:all 0.15s ease}
        .btn-save{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;
                  box-shadow:0 4px 12px rgba(102,126,234,0.3)}
        .btn-save:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(102,126,234,0.4)}
        .btn-reset{background:#ea4335;color:#fff}
        .btn-reset:hover{background:#d33426}
        .btn-cancel{background:#e8eaed;color:#1a1a1a}
        .btn-cancel:hover{background:#dadce0}
    `;

        const globalSelectors = (selectorsGlobal || []).join('\n');
        const globalExSelf = (excludeGlobal.self || []).join('\n');
        const globalExAnc = (excludeGlobal.ancestors || []).join('\n');
        const domSelectors = (selectorsDomain || []).join('\n');
        const domExSelf = (excludeDomain.self || []).join('\n');
        const domExAnc = (excludeDomain.ancestors || []).join('\n');

        const { shadow, close } = createDialog({
            css,
            bodyHTML: `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Edit Selectors">
            <div class="header">
                <span class="header-title">Edit Selectors</span>
                <button class="header-close" aria-label="Close">×</button>
            </div>
            <div class="content">
                <div class="tabs">
                    <button class="tab active" data-tab="global">Global</button>
                    <button class="tab" data-tab="domain">${escapeHtml(host)}</button>
                </div>

                <div class="tab-panel active" data-panel="global">
                    <div class="section">
                        <div class="section-label">Container Selectors</div>
                        <textarea id="g-selectors" spellcheck="false">${escapeHtml(globalSelectors)}</textarea>
                        <div class="section-hint">CSS selectors for finding article containers. One per line.</div>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Elements (self)</div>
                        <textarea id="g-ex-self" spellcheck="false">${escapeHtml(globalExSelf)}</textarea>
                        <div class="section-hint">Elements matching these selectors are skipped. One per line.</div>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Containers (ancestors)</div>
                        <textarea id="g-ex-anc" spellcheck="false">${escapeHtml(globalExAnc)}</textarea>
                        <div class="section-hint">Text inside these containers is excluded. One per line.</div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="domain">
                    <div class="section">
                        <div class="section-label">Container Selectors</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalSelectors)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-selectors" class="editable" spellcheck="false">${escapeHtml(domSelectors)}</textarea>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Elements (self)</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalExSelf)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-ex-self" class="editable" spellcheck="false">${escapeHtml(domExSelf)}</textarea>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Containers (ancestors)</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalExAnc)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-ex-anc" class="editable" spellcheck="false">${escapeHtml(domExAnc)}</textarea>
                    </div>
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-reset">Reset Defaults</button>
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save &amp; Reload</button>
            </div>
        </div>`
        });

        let activeTab = 'global';

        // Tab switching
        const tabs = shadow.querySelectorAll('.tab');
        const panels = shadow.querySelectorAll('.tab-panel');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                activeTab = tab.dataset.tab;
                tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
                panels.forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
            });
        });

        const toLines = (val) => val.split('\n').map(l => l.trim()).filter(Boolean);

        const btnSave = shadow.querySelector('.btn-save');
        const btnReset = shadow.querySelector('.btn-reset');

        btnSave.addEventListener('click', async () => {
            const data = {
                global: {
                    selectors: toLines(shadow.querySelector('#g-selectors').value),
                    excludeSelf: toLines(shadow.querySelector('#g-ex-self').value),
                    excludeAncestors: toLines(shadow.querySelector('#g-ex-anc').value)
                },
                domain: {
                    selectors: toLines(shadow.querySelector('#d-selectors').value),
                    excludeSelf: toLines(shadow.querySelector('#d-ex-self').value),
                    excludeAncestors: toLines(shadow.querySelector('#d-ex-anc').value)
                }
            };
            await onSave(data);
            btnSave.textContent = '✓ Saved!';
            setTimeout(() => location.reload(), 800);
        });

        btnReset.addEventListener('click', () => {
            if (activeTab === 'global') {
                shadow.querySelector('#g-selectors').value = (defaultSelectors || []).join('\n');
                shadow.querySelector('#g-ex-self').value = (defaultExcludes.self || []).join('\n');
                shadow.querySelector('#g-ex-anc').value = (defaultExcludes.ancestors || []).join('\n');
            } else {
                shadow.querySelector('#d-selectors').value = '';
                shadow.querySelector('#d-ex-self').value = '';
                shadow.querySelector('#d-ex-anc').value = '';
            }
            btnReset.textContent = 'Reset!';
            setTimeout(() => { btnReset.textContent = 'Reset Defaults'; }, 1000);
        });

        shadow.querySelector('.btn-cancel').addEventListener('click', close);
        shadow.querySelector('.header-close').addEventListener('click', close);
    }

    /**
     * Article extraction logic for Summarize The Web
     */


    /**
     * Get selected text from the page
     * @param {number} minLength - Minimum text length required
     * @returns {Object|null} - { text } or { error, actualLength } or null if no selection
     */
    function getSelectedText(minLength = 100) {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (!text) {
            return null;
        }
        if (text.length < minLength) {
            return { error: 'selection_too_short', actualLength: text.length, minLength };
        }
        return { text };
    }

    /**
     * Clean container text by removing UI and excluded elements
     * @param {Element} container - Container element
     * @param {Object} EXCLUDE - Exclusion rules
     * @returns {string} - Cleaned text
     */
    function cleanContainerText(container, EXCLUDE) {
        const clone = container.cloneNode(true);

        // Remove UI elements
        clone.querySelectorAll(`[${UI_ATTR}]`).forEach(el => el.remove());

        // Remove excluded elements (self)
        if (EXCLUDE.self) {
            for (const sel of EXCLUDE.self) {
                try {
                    clone.querySelectorAll(sel).forEach(el => el.remove());
                } catch {}
            }
        }

        // Remove excluded containers (ancestors)
        if (EXCLUDE.ancestors) {
            for (const sel of EXCLUDE.ancestors) {
                try {
                    clone.querySelectorAll(sel).forEach(el => el.remove());
                } catch {}
            }
        }

        return (clone.innerText ?? clone.textContent ?? '').trim();
    }

    // Text blocks counted by the density fallback. Only leaf blocks are counted
    // (a blockquote wrapping a <p> is skipped in favor of the <p>) so nested
    // structures don't inflate totals.
    const TEXT_BLOCK_SELECTOR = 'p, li, blockquote, pre';

    /**
     * Guess the article container by text density, for pages where no configured
     * selector matches (unrecognized themes, div-soup page builders). Sums the
     * length of every leaf text block into each of its ancestors, then descends
     * from <body> to the deepest element that still holds at least 80% of that
     * text — the tightest wrapper around the main body of the page.
     * @param {number} minLength - Minimum total block text required to guess
     * @param {number} [bodyLength] - Page text length, for the percent stat
     * @returns {Object|null} - Candidate entry { candidate, selector, length, percent }
     *   with selector set to '(auto-detected)', or null if there isn't enough text
     */
    function guessArticleContainer(minLength = 100, bodyLength = 0) {
        if (!bodyLength) {
            bodyLength = (document.body.innerText ?? document.body.textContent ?? '').trim().length || 1;
        }

        const totals = new Map();
        let counted = 0;

        for (const block of document.querySelectorAll(TEXT_BLOCK_SELECTOR)) {
            if (block.querySelector(TEXT_BLOCK_SELECTOR)) continue;
            if (block.closest(`nav, aside, header, footer, [${UI_ATTR}]`)) continue;

            const len = (block.innerText ?? block.textContent ?? '').trim().length;
            // Ignore stubs (menu items, buttons, captions)
            if (len < 25) continue;

            counted += len;
            for (let anc = block.parentElement; anc && anc !== document.documentElement; anc = anc.parentElement) {
                totals.set(anc, (totals.get(anc) || 0) + len);
            }
        }

        if (counted < minLength) return null;

        let container = document.body;
        let descended = true;
        while (descended) {
            descended = false;
            for (const child of container.children) {
                if ((totals.get(child) || 0) >= counted * 0.8) {
                    container = child;
                    descended = true;
                    break;
                }
            }
        }

        const rawText = (container.innerText ?? container.textContent ?? '').trim();
        return {
            candidate: container,
            selector: '(auto-detected)',
            length: rawText.length,
            percent: Math.round((rawText.length / bodyLength) * 100)
        };
    }

    /**
     * Find and rank article container candidates. Shared by extraction and the
     * summary-highlight inspection view so the dominance heuristic lives in one
     * place. Falls back to a text-density guess when no selector matches
     * anything usable.
     * @param {string[]} SELECTORS - CSS selectors to find containers
     * @param {number} minLength - Minimum text length for a significant container
     * @returns {Object|null} - { selected, candidates } where selected holds one
     *   entry (single container) or several (non-nested containers to combine),
     *   or null when no selector matched and the density fallback found nothing.
     */
    function selectContainers(SELECTORS, minLength = 100) {
        // Get total page text for comparison
        const bodyText = (document.body.innerText ?? document.body.textContent ?? '').trim();
        const bodyLength = bodyText.length || 1; // Avoid division by zero

        // Collect all matching candidates with their text stats
        const candidates = [];
        for (const selector of SELECTORS) {
            try {
                const candidate = document.querySelector(selector);
                if (!candidate) continue;

                const rawText = (candidate.innerText ?? candidate.textContent ?? '').trim();
                const percent = Math.round((rawText.length / bodyLength) * 100);

                candidates.push({ candidate, selector, length: rawText.length, percent });
            } catch (e) {
                // Invalid selector, skip
            }
        }

        if (candidates.length === 0) {
            const guess = guessArticleContainer(minLength, bodyLength);
            return guess ? { selected: [guess], candidates: [guess] } : null;
        }

        // Sort by text length descending
        candidates.sort((a, b) => b.length - a.length);
        const best = candidates[0];

        // Every configured match is below the minimum (e.g. an empty <article>
        // teaser) — a density guess that finds more text is a better bet.
        if (best.length < minLength) {
            const guess = guessArticleContainer(minLength, bodyLength);
            if (guess && guess.length > best.length) {
                return { selected: [guess], candidates: [guess, ...candidates] };
            }
        }

        // Check if one container is dominant (>70% of page, and next best is <50% of best)
        const dominated = best.percent > 70 && (candidates.length < 2 || candidates[1].percent < best.percent * 0.5);
        if (dominated) {
            return { selected: [best], candidates };
        }

        // Multiple significant containers - combine non-nested ones
        const significant = candidates.filter(c => c.percent >= 15 && c.length > minLength);
        const nonNested = significant.filter((c, i) =>
            !significant.some((other, j) => i !== j &&
                (other.candidate.contains(c.candidate) || c.candidate.contains(other.candidate))
            )
        );

        return { selected: nonNested.length > 1 ? nonNested : [best], candidates };
    }

    /**
     * Extract article body using configured selectors
     * @param {string[]} SELECTORS - CSS selectors to find container
     * @param {Object} EXCLUDE - Exclusion rules
     * @param {number} minLength - Minimum text length required
     * @returns {Object|null} - { text, container, title } or { error, ... } or null
     */
    function extractArticleBody(SELECTORS, EXCLUDE, minLength = 100) {
        const selection = selectContainers(SELECTORS, minLength);
        if (!selection) {
            log('No article container found');
            return { error: 'no_container' };
        }
        const { selected, candidates } = selection;

        // Log top candidates for debugging
        const topCandidates = candidates.slice(0, 5).filter(c => c.length > 0);
        if (topCandidates.length > 1) {
            log('Container candidates:', topCandidates.map(c => `${c.selector} (${c.percent}%)`).join(', '));
        }

        if (selected.length > 1) {
            // Combine cleaned text from multiple containers
            const combinedText = selected.map(c => cleanContainerText(c.candidate, EXCLUDE)).join('\n\n');
            log('Combined', selected.length, 'containers:', selected.map(c => c.selector).join(', '));

            if (combinedText.length < minLength) {
                log(`Combined text too short: ${combinedText.length} < ${minLength}`);
                return { error: 'article_too_short', actualLength: combinedText.length, minLength };
            }

            log(`Extracted ${combinedText.length} characters from combined containers`);
            return { text: combinedText, elements: null, container: selected[0].candidate, title: null };
        }

        const best = selected[0];
        const container = best.candidate;
        log('Selected container:', best.selector, 'with', best.length, 'chars', `(${best.percent}% of page)`);

        // Try to find article title
        let title = null;
        const titleSelectors = [
            '[itemprop="headline"]',
            'h1',
            'h2',
            '.article-title',
            '.post-title',
            '.entry-title',
            '[class*="article-title"]',
            '[class*="post-title"]'
        ];

        for (const selector of titleSelectors) {
            const el = container.querySelector(selector);
            if (el && el.textContent.trim().length > 10 && el.textContent.trim().length < 300) {
                title = el;
                break;
            }
        }

        // Get cleaned text from container
        const text = cleanContainerText(container, EXCLUDE);

        if (!text) {
            log('No text found in container');
            return { error: 'no_text' };
        }

        if (text.length < minLength) {
            log(`Text too short: ${text.length} < ${minLength}`);
            return { error: 'article_too_short', actualLength: text.length, minLength };
        }

        log(`Extracted ${text.length} characters from container`);

        return {
            text: text,
            elements: null,
            container: container,
            title: title
        };
    }

    /**
     * Get text to digest (selection or article body)
     * @param {string[]} SELECTORS - CSS selectors to find container
     * @param {Object} EXCLUDE - Exclusion rules
     * @param {number} minLength - Minimum text length required
     * @returns {Object} - { text, source, ... } or { error, ... }
     */
    function getTextToDigest(SELECTORS, EXCLUDE, minLength = 100) {
        // First check if user has selected text
        const selected = getSelectedText(minLength);
        if (selected) {
            if (selected.error) {
                return { error: selected.error, actualLength: selected.actualLength, minLength, source: 'selection' };
            }
            return { text: selected.text, elements: null, source: 'selection' };
        }

        // Otherwise extract article body
        const article = extractArticleBody(SELECTORS, EXCLUDE, minLength);
        if (article.error) {
            return { error: article.error, actualLength: article.actualLength, minLength, source: 'article' };
        }

        return { text: article.text, elements: article.elements, source: 'article', container: article.container };
    }

    /**
     * Inspection mode functionality for debugging article container detection
     *
     * Functions here take an inspection context object (ctx) holding the merged
     * selector configuration for the current page:
     *   { SELECTORS, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN,
     *     EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE,
     *     storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo }
     */


    let inspectionOverlay = null;
    let inspectedElement = null;
    let summaryHighlightActive = false;
    let highlightedElements = [];

    /**
     * Find the most specific/deepest meaningful element at coordinates
     */
    function findMostSpecificElement(x, y, SELECTORS) {
        const elements = document.elementsFromPoint(x, y);
        const filtered = elements.filter(el => !el.closest(`[${UI_ATTR}]`));
        if (!filtered.length) return null;

        const selectors = compiledSelectors(SELECTORS);

        for (const el of filtered) {
            const hasDirectText = Array.from(el.childNodes).some(
                node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
            );

            const matchesSelector = selectors && el.matches?.(selectors);
            const isContentElement = /^(DIV|ARTICLE|SECTION|MAIN|P|SPAN)$/i.test(el.tagName);
            const hasTextContent = el.textContent.trim().length > 0;

            if (hasDirectText || matchesSelector || (isContentElement && hasTextContent)) {
                return el;
            }
        }

        for (const el of filtered) {
            if (el.textContent.trim().length > 0) {
                return el;
            }
        }

        return filtered[0];
    }

    /**
     * Enter inspection mode
     * @param {Object} ctx - Inspection context (see module doc comment)
     */
    function enterInspectionMode(ctx) {
        if (inspectionOverlay) return;

        const overlay = document.createElement('div');
        overlay.setAttribute(UI_ATTR, '');
        overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483645;
        background: rgba(0, 0, 0, 0.3);
        font-family: system-ui, sans-serif;
        pointer-events: none;
    `;

        const message = document.createElement('div');
        message.setAttribute(UI_ATTR, '');
        message.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px;
        border-radius: 8px; font-size: 14px; font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 2147483646;
        pointer-events: none;
    `;
        message.textContent = 'Inspection Mode - Click any element to analyze. ESC to exit.';

        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'crosshair';

        document.body.appendChild(overlay);
        document.body.appendChild(message);
        inspectionOverlay = { overlay, message, originalCursor };

        let currentHighlight = null;
        const onMouseMove = (e) => {
            const target = findMostSpecificElement(e.clientX, e.clientY, ctx.SELECTORS);
            if (!target) return;

            if (currentHighlight && currentHighlight !== target) {
                currentHighlight.style.outline = currentHighlight._origOutline || '';
                currentHighlight.style.outlineOffset = currentHighlight._origOutlineOffset || '';
                delete currentHighlight._origOutline;
                delete currentHighlight._origOutlineOffset;
            }

            if (currentHighlight !== target) {
                currentHighlight = target;
                currentHighlight._origOutline = currentHighlight.style.outline;
                currentHighlight._origOutlineOffset = currentHighlight.style.outlineOffset;
                currentHighlight.style.outline = '2px dashed #667eea';
                currentHighlight.style.outlineOffset = '2px';
            }
        };

        const onClick = (e) => {
            const target = findMostSpecificElement(e.clientX, e.clientY, ctx.SELECTORS);
            if (!target) return;

            e.preventDefault();
            e.stopPropagation();

            inspectedElement = target;

            if (currentHighlight) {
                currentHighlight.style.outline = currentHighlight._origOutline || '';
                currentHighlight.style.outlineOffset = currentHighlight._origOutlineOffset || '';
                delete currentHighlight._origOutline;
                delete currentHighlight._origOutlineOffset;
            }

            inspectedElement._origOutline = inspectedElement.style.outline;
            inspectedElement._origOutlineOffset = inspectedElement.style.outlineOffset;
            inspectedElement.style.outline = '3px solid #ea4335';
            inspectedElement.style.outlineOffset = '2px';

            exitInspectionMode();
            showDiagnosticDialog(inspectedElement, ctx);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                exitInspectionMode();
            }
        };

        document.body.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown);

        inspectionOverlay.onMouseMove = onMouseMove;
        inspectionOverlay.onClick = onClick;
        inspectionOverlay.onKeyDown = onKeyDown;
        inspectionOverlay.currentHighlight = () => currentHighlight;
    }

    /**
     * Exit inspection mode
     */
    function exitInspectionMode() {
        if (!inspectionOverlay) return;

        const { overlay, message, onMouseMove, onClick, onKeyDown, currentHighlight, originalCursor } = inspectionOverlay;

        const el = currentHighlight?.();
        if (el) {
            el.style.outline = el._origOutline || '';
            el.style.outlineOffset = el._origOutlineOffset || '';
            delete el._origOutline;
            delete el._origOutlineOffset;
        }

        document.body.style.cursor = originalCursor;

        document.body.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown);

        overlay.remove();
        message.remove();

        inspectionOverlay = null;
    }

    /**
     * Find ancestor that matches a selector list
     */
    function findMatchingAncestor(el, selectors) {
        for (const sel of selectors) {
            try {
                const ancestor = el.closest(sel);
                if (ancestor && ancestor !== el) {
                    return { selector: sel, element: ancestor };
                }
            } catch {}
        }
        return null;
    }

    /**
     * Diagnose element for article container detection
     */
    function diagnoseElement(el, ctx) {
        const { SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE } = ctx;

        const text = textTrim(el);
        const selector = generateCSSSelector(el);

        const globalSelectors = findMatchingSelectors(el, SELECTORS_GLOBAL);
        const domainSelectors = findMatchingSelectors(el, SELECTORS_DOMAIN);
        const globalExclusions = findMatchingExclusions(el, EXCLUDE_GLOBAL);
        const domainExclusions = findMatchingExclusions(el, EXCLUDE_DOMAIN);

        const isExcluded = isExcludedElement(el, EXCLUDE);

        const isMatched = globalSelectors.length > 0 || domainSelectors.length > 0;
        const isProcessed = isMatched && !isExcluded;

        // Check if element is INSIDE a matched container (even if not directly matched)
        const allSelectors = [...SELECTORS_GLOBAL, ...SELECTORS_DOMAIN];
        const ancestorMatch = !isMatched ? findMatchingAncestor(el, allSelectors) : null;
        const isInsideContainer = ancestorMatch !== null;
        const isIncludedInSummary = !isExcluded && (isMatched || isInsideContainer);

        // Count text-containing children
        const textElements = el.querySelectorAll('p, li, blockquote, figcaption, dd, dt');
        const filteredTextElements = Array.from(textElements).filter(e => e.textContent.trim().length >= 40);

        return {
            element: el,
            selector,
            text: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
            fullTextLength: text.length,
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList).join(' '),
            id: el.id,
            globalSelectors,
            domainSelectors,
            globalExclusions,
            domainExclusions,
            isExcluded,
            isMatched,
            isProcessed,
            textElementCount: filteredTextElements.length,
            // Fields for "included via container"
            isInsideContainer,
            ancestorMatch,
            isIncludedInSummary
        };
    }

    /**
     * Show diagnostic dialog
     */
    function showDiagnosticDialog(el, ctx) {
        const diag = diagnoseElement(el, ctx);

        const css = `
        .wrap { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.4);
                display: flex; align-items: center; justify-content: center; }
        .modal { background: linear-gradient(135deg, #f8f9ff 0%, #fff5f7 100%); max-width: 700px; width: 96%;
                 max-height: 90vh; border-radius: 16px; box-shadow: 0 10px 40px rgba(102, 126, 234, 0.35);
                 display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
                 border: 3px solid #667eea; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px 20px;
                  display: flex; align-items: center; justify-content: space-between; }
        .header-title { font: 600 16px/1.2 system-ui, sans-serif; color: #fff; }
        .header-close { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                        color: #fff; font-size: 20px; font-weight: 600; width: 32px; height: 32px;
                        border-radius: 8px; cursor: pointer; display: flex; align-items: center;
                        justify-content: center; transition: all 0.2s; padding: 0; line-height: 1; }
        .header-close:hover { background: rgba(255,255,255,0.3); transform: scale(1.05); }
        .content { padding: 20px; overflow-y: auto; flex: 1; }
        .section { margin: 0 0 16px; padding: 12px; background: rgba(255,255,255,0.8); border-radius: 8px;
                   border: 1px solid rgba(102, 126, 234, 0.15); }
        .section:last-child { margin-bottom: 0; }
        .section-title { font: 600 13px system-ui, sans-serif; margin: 0 0 8px; color: #667eea;
                         text-transform: uppercase; letter-spacing: 0.5px; }
        .info-row { margin: 4px 0; font: 13px/1.5 system-ui, sans-serif; color: #555; }
        .info-label { font-weight: 600; color: #333; }
        .status { display: inline-block; padding: 8px 16px; border-radius: 8px; font: 600 13px system-ui, sans-serif;
                  margin: 0 0 16px; }
        .status.processed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.not-processed { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.excluded { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
        .list { margin: 8px 0 0; padding-left: 20px; }
        .list li { margin: 4px 0; font: 13px/1.5 system-ui, sans-serif; }
        .list li.match { color: #155724; }
        .list li.no-match { color: #666; }
        .list li.problem { color: #721c24; font-weight: 600; }
        .code { background: #e8eaed; padding: 2px 6px; border-radius: 4px;
                font: 12px ui-monospace, Consolas, monospace; color: #333; }
        .footer { padding: 16px 20px; background: rgba(102, 126, 234, 0.05);
                  border-top: 1px solid rgba(102, 126, 234, 0.15); }
        .footer-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .footer-secondary { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
                            padding-bottom: 12px; border-bottom: 1px solid rgba(102, 126, 234, 0.15); }
        .btn { padding: 10px 16px; border-radius: 8px; border: none;
               font: 600 13px system-ui, sans-serif; cursor: pointer; transition: all 0.15s ease; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;
                       box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }
        .btn.primary:hover:not(:disabled) { transform: translateY(-2px);
                                             box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4); }
        .btn.secondary { background: #e8eaed; color: #1a1a1a; }
        .btn.secondary:hover:not(:disabled) { background: #dadce0; }
        .btn.success { background: #34a853; color: #fff; }
        .btn.success:hover:not(:disabled) { background: #2d8e47; }
        .btn.danger { background: #ea4335; color: #fff; }
        .btn.danger:hover:not(:disabled) { background: #d33426; }
        .btn.small { padding: 6px 12px; font-size: 12px; }
    `;

        let statusClass, statusText;
        if (diag.isExcluded) {
            statusClass = 'excluded';
            statusText = 'EXCLUDED - Element or ancestor matches an exclusion pattern';
        } else if (diag.isProcessed) {
            statusClass = 'processed';
            statusText = 'MATCHED - This element matches article container selectors';
        } else if (diag.isInsideContainer) {
            statusClass = 'processed';
            statusText = 'INCLUDED VIA CONTAINER - Inside a matched container, text will be summarized';
        } else {
            statusClass = 'not-processed';
            statusText = 'NOT MATCHED - No selectors match this element or its ancestors';
        }

        // Build ancestor container info if applicable
        const ancestorInfoHTML = diag.ancestorMatch ?
            `<div class="section">
            <div class="section-title">Matched Container (Ancestor)</div>
            <p class="info-row">This element is inside a container that matches:</p>
            <ul class="list"><li class="match">✓ <span class="code">${escapeHtml(diag.ancestorMatch.selector)}</span></li></ul>
            <p class="info-row"><span class="info-label">Container tag:</span> &lt;${diag.ancestorMatch.element.tagName.toLowerCase()}&gt;</p>
        </div>` : '';

        const globalSelectorsHTML = diag.globalSelectors.length > 0 ?
            `<ul class="list">${diag.globalSelectors.map(s => `<li class="match">✓ <span class="code">${escapeHtml(s)}</span></li>`).join('')}</ul>` :
            '<p class="info-row no-match">No global selectors match this element.</p>';

        const domainSelectorsHTML = diag.domainSelectors.length > 0 ?
            `<ul class="list">${diag.domainSelectors.map(s => `<li class="match">✓ <span class="code">${escapeHtml(s)}</span></li>`).join('')}</ul>` :
            '<p class="info-row no-match">No domain selectors configured or matched.</p>';

        const globalExclusionsHTML = (diag.globalExclusions.self.length > 0 || diag.globalExclusions.ancestors.length > 0) ?
            `<ul class="list">
            ${diag.globalExclusions.self.map(s => `<li class="problem">✗ Element matches: <span class="code">${escapeHtml(s)}</span></li>`).join('')}
            ${diag.globalExclusions.ancestors.map(s => `<li class="problem">✗ Ancestor matches: <span class="code">${escapeHtml(s)}</span></li>`).join('')}
        </ul>` :
            '<p class="info-row no-match">No global exclusions affect this element.</p>';

        const domainExclusionsHTML = (diag.domainExclusions.self?.length > 0 || diag.domainExclusions.ancestors?.length > 0) ?
            `<ul class="list">
            ${(diag.domainExclusions.self || []).map(s => `<li class="problem">✗ Element matches: <span class="code">${escapeHtml(s)}</span></li>`).join('')}
            ${(diag.domainExclusions.ancestors || []).map(s => `<li class="problem">✗ Ancestor matches: <span class="code">${escapeHtml(s)}</span></li>`).join('')}
        </ul>` :
            '<p class="info-row no-match">No domain exclusions configured or affect this element.</p>';

        const restoreInspectedOutline = () => {
            if (inspectedElement) {
                inspectedElement.style.outline = inspectedElement._origOutline || '';
                inspectedElement.style.outlineOffset = inspectedElement._origOutlineOffset || '';
                delete inspectedElement._origOutline;
                delete inspectedElement._origOutlineOffset;
                inspectedElement = null;
            }
        };

        const { shadow, close } = createDialog({
            css,
            onClose: restoreInspectedOutline,
            bodyHTML: `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Element Inspection">
            <div class="header">
                <div class="header-title">Element Inspection</div>
                <button class="header-close close" title="Close">&#10005;</button>
            </div>

            <div class="content">
                <div class="status ${statusClass}">${statusText}</div>

                <div class="section">
                    <div class="section-title">Element Information</div>
                    <div class="info-row"><span class="info-label">Tag:</span> &lt;${diag.tag}&gt;</div>
                    <div class="info-row"><span class="info-label">ID:</span> ${escapeHtml(diag.id) || '(none)'}</div>
                    <div class="info-row"><span class="info-label">Classes:</span> ${escapeHtml(diag.classes) || '(none)'}</div>
                    <div class="info-row"><span class="info-label">Text length:</span> ${diag.fullTextLength} characters</div>
                    <div class="info-row"><span class="info-label">Text elements (p, li, etc.):</span> ${diag.textElementCount} with 40+ chars</div>
                    <div class="info-row"><span class="info-label">CSS Selector:</span> <span class="code">${escapeHtml(diag.selector)}</span></div>
                    <div class="info-row"><span class="info-label">Preview:</span> "${escapeHtml(diag.text)}"</div>
                </div>

                ${ancestorInfoHTML}

                <div class="section">
                    <div class="section-title">Global Container Selectors</div>
                    ${globalSelectorsHTML}
                </div>

                <div class="section">
                    <div class="section-title">Domain Container Selectors (${escapeHtml(ctx.HOST)})</div>
                    ${domainSelectorsHTML}
                </div>

                <div class="section">
                    <div class="section-title">Global Exclusions</div>
                    ${globalExclusionsHTML}
                </div>

                <div class="section">
                    <div class="section-title">Domain Exclusions (${escapeHtml(ctx.HOST)})</div>
                    ${domainExclusionsHTML}
                </div>
            </div>

            <div class="footer">
                <div class="footer-secondary">
                    ${buildActionButtons(diag)}
                </div>
                <div class="footer-actions">
                    <button class="btn secondary copy-selector">Copy Selector</button>
                    <button class="btn primary close">Close</button>
                </div>
            </div>
        </div>`
        });

        shadow.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', close));

        shadow.querySelector('.copy-selector').addEventListener('click', () => {
            navigator.clipboard.writeText(diag.selector).then(() => {
                const btn = shadow.querySelector('.copy-selector');
                const orig = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => btn.textContent = orig, 2000);
            });
        });

        attachActionHandlers(shadow, diag, close, ctx);
    }

    /**
     * Build action buttons for diagnostic dialog
     */
    function buildActionButtons(diag) {
        const buttons = [];

        // Global Inclusions: Remove if matched, Add if not
        if (diag.globalSelectors.length > 0) {
            diag.globalSelectors.forEach(sel => {
                buttons.push(`<button class="btn secondary remove-global-sel" data-selector="${escapeHtml(sel)}">Remove Global Inclusion: ${escapeHtml(sel)}</button>`);
            });
        } else {
            buttons.push(`<button class="btn success add-global-sel">Add to Global Inclusions</button>`);
        }

        // Local Inclusions: Remove if matched, Add if not
        if (diag.domainSelectors.length > 0) {
            diag.domainSelectors.forEach(sel => {
                buttons.push(`<button class="btn secondary remove-domain-sel" data-selector="${escapeHtml(sel)}">Remove Local Inclusion: ${escapeHtml(sel)}</button>`);
            });
        } else {
            buttons.push(`<button class="btn success add-domain-sel">Add to Local Inclusions</button>`);
        }

        // Global Exclusions: Remove if matched, Add if not
        const hasGlobalExclusion = diag.globalExclusions.self.length > 0 || diag.globalExclusions.ancestors.length > 0;
        if (hasGlobalExclusion) {
            diag.globalExclusions.self.forEach(sel => {
                buttons.push(`<button class="btn secondary remove-global-excl-self" data-selector="${escapeHtml(sel)}">Remove Global Exclusion: ${escapeHtml(sel)}</button>`);
            });
            diag.globalExclusions.ancestors.forEach(sel => {
                buttons.push(`<button class="btn secondary remove-global-excl-anc" data-selector="${escapeHtml(sel)}">Remove Global Ancestor Exclusion: ${escapeHtml(sel)}</button>`);
            });
        } else {
            buttons.push(`<button class="btn danger add-global-excl">Add to Global Exclusions</button>`);
        }

        // Local Exclusions: Remove if matched, Add if not
        const hasLocalExclusion = (diag.domainExclusions.self?.length > 0) || (diag.domainExclusions.ancestors?.length > 0);
        if (hasLocalExclusion) {
            (diag.domainExclusions.self || []).forEach(sel => {
                buttons.push(`<button class="btn secondary remove-domain-excl-self" data-selector="${escapeHtml(sel)}">Remove Local Exclusion: ${escapeHtml(sel)}</button>`);
            });
            (diag.domainExclusions.ancestors || []).forEach(sel => {
                buttons.push(`<button class="btn secondary remove-domain-excl-anc" data-selector="${escapeHtml(sel)}">Remove Local Ancestor Exclusion: ${escapeHtml(sel)}</button>`);
            });
        } else {
            buttons.push(`<button class="btn danger add-domain-excl">Add to Local Exclusions</button>`);
        }

        return buttons.join('');
    }

    /**
     * Attach action handlers for diagnostic dialog
     */
    function attachActionHandlers(shadow, diag, closeDialog, ctx) {
        const { storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, HOST, SELECTORS_GLOBAL, EXCLUDE_GLOBAL, openInfo } = ctx;

        // Remove global inclusions
        shadow.querySelectorAll('.remove-global-sel').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                const idx = SELECTORS_GLOBAL.indexOf(sel);
                if (idx > -1) SELECTORS_GLOBAL.splice(idx, 1);
                await storage.set(STORAGE_KEYS.SELECTORS_GLOBAL, JSON.stringify(SELECTORS_GLOBAL));
                openInfo(`Removed global inclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Remove domain inclusions
        shadow.querySelectorAll('.remove-domain-sel').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                if (DOMAIN_SELECTORS[HOST]) {
                    const idx = DOMAIN_SELECTORS[HOST].indexOf(sel);
                    if (idx > -1) DOMAIN_SELECTORS[HOST].splice(idx, 1);
                    await storage.set(STORAGE_KEYS.DOMAIN_SELECTORS, JSON.stringify(DOMAIN_SELECTORS));
                }
                openInfo(`Removed local inclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Remove global exclusions
        shadow.querySelectorAll('.remove-global-excl-self').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                EXCLUDE_GLOBAL.self = (EXCLUDE_GLOBAL.self || []).filter(s => s !== sel);
                await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));
                openInfo(`Removed global exclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        shadow.querySelectorAll('.remove-global-excl-anc').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                EXCLUDE_GLOBAL.ancestors = (EXCLUDE_GLOBAL.ancestors || []).filter(s => s !== sel);
                await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));
                openInfo(`Removed global ancestor exclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        shadow.querySelectorAll('.remove-domain-excl-self').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                if (DOMAIN_EXCLUDES[HOST]) {
                    DOMAIN_EXCLUDES[HOST].self = (DOMAIN_EXCLUDES[HOST].self || []).filter(s => s !== sel);
                    await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                }
                openInfo(`Removed local exclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        shadow.querySelectorAll('.remove-domain-excl-anc').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sel = btn.getAttribute('data-selector');
                if (DOMAIN_EXCLUDES[HOST]) {
                    DOMAIN_EXCLUDES[HOST].ancestors = (DOMAIN_EXCLUDES[HOST].ancestors || []).filter(s => s !== sel);
                    await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                }
                openInfo(`Removed local ancestor exclusion: ${sel}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Add as global selector
        shadow.querySelectorAll('.add-global-sel').forEach(btn => {
            btn.addEventListener('click', async () => {
                SELECTORS_GLOBAL.push(diag.selector);
                await storage.set(STORAGE_KEYS.SELECTORS_GLOBAL, JSON.stringify(SELECTORS_GLOBAL));
                openInfo(`Added global inclusion: ${diag.selector}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Add as domain selector
        shadow.querySelectorAll('.add-domain-sel').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!DOMAIN_SELECTORS[HOST]) DOMAIN_SELECTORS[HOST] = [];
                DOMAIN_SELECTORS[HOST].push(diag.selector);
                await storage.set(STORAGE_KEYS.DOMAIN_SELECTORS, JSON.stringify(DOMAIN_SELECTORS));
                openInfo(`Added local inclusion: ${diag.selector}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Add to global exclusions
        shadow.querySelectorAll('.add-global-excl').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!EXCLUDE_GLOBAL.self) EXCLUDE_GLOBAL.self = [];
                EXCLUDE_GLOBAL.self.push(diag.selector);
                await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));
                openInfo(`Added to global exclusions: ${diag.selector}\nReload the page to see changes.`);
                closeDialog();
            });
        });

        // Add to domain exclusions
        shadow.querySelectorAll('.add-domain-excl').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!DOMAIN_EXCLUDES[HOST]) DOMAIN_EXCLUDES[HOST] = { self: [], ancestors: [] };
                if (!DOMAIN_EXCLUDES[HOST].self) DOMAIN_EXCLUDES[HOST].self = [];
                DOMAIN_EXCLUDES[HOST].self.push(diag.selector);
                await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                openInfo(`Added local exclusion: ${diag.selector}\nReload the page to see changes.`);
                closeDialog();
            });
        });
    }

    /**
     * Show which elements would be included in summary
     */
    function showSummaryHighlight(SELECTORS, EXCLUDE, minLength = 100) {
        if (summaryHighlightActive) {
            exitSummaryHighlight();
            return;
        }

        summaryHighlightActive = true;
        highlightedElements = [];

        const selection = selectContainers(SELECTORS, minLength);
        if (!selection) {
            showHighlightMessage('No article container found matching configured selectors.', false);
            return;
        }
        const selectedContainers = selection.selected;

        // Text element selectors - these are the elements that actually contain readable text
        const textElementSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, dd, dt, pre, td, th';

        let includedCount = 0;
        let excludedCount = 0;

        // Elements already highlighted, for skipping nested matches. Within a
        // container, querySelectorAll returns document order, so ancestors are
        // always visited before their descendants; a parent-chain lookup against
        // this set replaces the previous O(n²) contains() scan.
        const highlighted = new Set();

        // Find and highlight text elements within containers
        for (const c of selectedContainers) {
            const textElements = c.candidate.querySelectorAll(textElementSelector);

            for (const el of textElements) {
                // Skip empty elements
                const text = (el.innerText ?? el.textContent ?? '').trim();
                if (text.length < 10) continue;

                // Skip if an ancestor is already highlighted (nested elements)
                let insideHighlighted = false;
                for (let anc = el.parentElement; anc; anc = anc.parentElement) {
                    if (highlighted.has(anc)) { insideHighlighted = true; break; }
                }
                if (insideHighlighted || highlighted.has(el)) continue;
                highlighted.add(el);

                const excluded = isExcludedElement(el, EXCLUDE);

                highlightedElements.push({
                    element: el,
                    origBoxShadow: el.style.boxShadow,
                    origPosition: el.style.position,
                    type: excluded ? 'excluded' : 'included'
                });

                if (excluded) {
                    el.style.boxShadow = 'inset 0 0 0 2px #ea4335';
                    excludedCount++;
                } else {
                    el.style.boxShadow = 'inset 0 0 0 2px #34a853';
                    includedCount++;
                }

                if (getComputedStyle(el).position === 'static') {
                    el.style.position = 'relative';
                }
            }
        }

        // Show message overlay
        const containerInfo = selectedContainers.map(c => `${c.selector} (${c.percent}%)`).join(', ');
        showHighlightMessage(
            `Container: ${containerInfo}\n` +
            `Text blocks: ${includedCount} included (green), ${excludedCount} excluded (red)\n\n` +
            `Press ESC or click this message to exit.`,
            true
        );
    }

    /**
     * Show highlight message overlay
     */
    function showHighlightMessage(text, clickToClose = false) {
        const message = document.createElement('div');
        message.setAttribute(UI_ATTR, '');
        message.id = 'stw-highlight-message';
        message.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #34a853 0%, #1e8e3e 100%); color: white; padding: 16px 24px;
        border-radius: 8px; font-size: 13px; font-weight: 500; line-height: 1.5;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 2147483646;
        max-width: 600px; white-space: pre-wrap; font-family: system-ui, sans-serif;
        ${clickToClose ? 'cursor: pointer;' : ''}
    `;
        message.textContent = text;
        document.body.appendChild(message);

        if (clickToClose) {
            message.addEventListener('click', exitSummaryHighlight);
        }

        // Add ESC key listener
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                exitSummaryHighlight();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        message._keyHandler = onKeyDown;
    }

    /**
     * Exit summary highlight mode
     */
    function exitSummaryHighlight() {
        if (!summaryHighlightActive) return;

        // Restore original styles
        for (const h of highlightedElements) {
            h.element.style.boxShadow = h.origBoxShadow || '';
            if (h.origPosition !== undefined) {
                h.element.style.position = h.origPosition || '';
            }
        }
        highlightedElements = [];

        // Remove message
        const message = document.getElementById('stw-highlight-message');
        if (message) {
            if (message._keyHandler) {
                document.removeEventListener('keydown', message._keyHandler);
            }
            message.remove();
        }

        summaryHighlightActive = false;
    }

    /**
     * UI overlay components for Summarize The Web
     */


    let overlay = null;
    let overlayShadow = null;
    let summaryOverlay = null;
    let summaryOverlayShadow = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let autoCollapsedOverlay = false;
    let autoCollapsedState = null;
    let currentTheme = 'auto';
    let mediaQueryList = null;
    let shortcuts = { ...DEFAULT_SHORTCUTS };
    let keyboardHandler = null;
    let savedBodyOverflow = null;
    let savedHtmlOverflow = null;
    let scrollLocked = false;
    let storedOnDigest = null;
    let currentOverlayPos = null;
    let resizeHandlerRegistered = false;
    let documentClickRegistered = false;
    let summaryEscHandler = null;

    const BADGE_WIDTH = 150;

    /**
     * Format shortcut for display
     */
    function formatShortcut(shortcut) {
        if (!shortcut) return '';
        const parts = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.meta) parts.push('Meta');
        if (shortcut.alt) parts.push('Alt');
        if (shortcut.shift) parts.push('Shift');
        parts.push(shortcut.key.toUpperCase());
        return parts.join('+');
    }

    /**
     * Derive a layout-independent key name from a keyboard event.
     * event.key reflects the composed character, so on macOS Alt+Shift+L
     * produces "Ò" and would never match a stored "L". Prefer event.code
     * for letters and digits.
     */
    function eventKeyName(event) {
        const code = event.code || '';
        if (/^Key[A-Z]$/.test(code)) return code.slice(3);
        if (/^Digit\d$/.test(code)) return code.slice(5);
        return (event.key || '').toUpperCase();
    }

    /**
     * Check if a keyboard event matches a shortcut
     */
    function matchesShortcut(event, shortcut) {
        if (!shortcut) return false;
        return eventKeyName(event) === shortcut.key.toUpperCase() &&
               event.altKey === shortcut.alt &&
               event.shiftKey === shortcut.shift &&
               event.ctrlKey === shortcut.ctrl &&
               event.metaKey === !!shortcut.meta;
    }

    /**
     * Parse shortcut string to object
     */
    function parseShortcut(str) {
        if (!str) return null;
        const parts = str.toUpperCase().split('+').map(p => p.trim());
        const key = parts.pop();
        return {
            key,
            ctrl: parts.includes('CTRL'),
            alt: parts.includes('ALT'),
            shift: parts.includes('SHIFT'),
            meta: parts.includes('META') || parts.includes('CMD')
        };
    }

    /**
     * Determine if dark mode should be active
     */
    function isDarkMode(theme) {
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        // Auto: check system preference
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * Apply theme to an element
     */
    function applyTheme(element, theme) {
        if (!element) return;
        currentTheme = theme;
        if (isDarkMode(theme)) {
            element.classList.add('summarizer-dark');
        } else {
            element.classList.remove('summarizer-dark');
        }
    }

    /**
     * Update theme on all overlays
     */
    function updateAllThemes(theme) {
        applyTheme(overlay, theme);
        // For shadow DOM, apply theme to the inner overlay element
        if (summaryOverlayShadow) {
            const innerOverlay = summaryOverlayShadow.querySelector('.summarizer-summary-overlay');
            applyTheme(innerOverlay, theme);
        }
    }

    /**
     * Generate CSS for badge shadow DOM
     */
    function getBadgeShadowCSS() {
        return `
        :host {
            all: initial;
            position: fixed;
            z-index: 2147483646;
            font: 13px/1.4 system-ui, sans-serif;
            color: #1a1a1a;
            box-sizing: border-box;
            width: 150px;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            right: 0;
            transform: translateX(0);
            display: block;
        }
        :host .summarizer-wrapper {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 1px solid #5568d3;
            border-radius: 10px;
            box-shadow: 0 6px 22px rgba(0,0,0,.18);
            display: flex;
            flex-direction: column;
            transition: box-shadow 0.3s ease, border-radius 0.3s ease;
        }
        :host(.collapsed) {
            transform: translateX(100%);
        }
        :host(.collapsed) .summarizer-wrapper {
            border-right: none;
            border-radius: 10px 0 0 10px;
            box-shadow: -4px 0 22px rgba(0,0,0,.18);
        }
        :host(.dragging) {
            transition: none;
            cursor: grabbing;
        }
        :host .summarizer-slide-handle {
            position: absolute;
            left: -28px;
            top: 50%;
            transform: translateY(-50%);
            width: 28px;
            height: 56px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 1px solid #5568d3;
            border-right: none;
            border-radius: 8px 0 0 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #fff;
            box-shadow: -3px 0 12px rgba(0,0,0,.12);
            transition: width 0.2s ease, left 0.2s ease, box-shadow 0.2s ease;
        }
        :host .summarizer-slide-handle:hover {
            width: 30px;
            left: -30px;
            box-shadow: -4px 0 16px rgba(0,0,0,.18);
        }
        :host .summarizer-handle {
            background: rgba(255,255,255,0.2);
            padding: 10px 12px;
            cursor: grab;
            border-radius: 9px 9px 0 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-bottom: 1px solid rgba(255,255,255,0.3);
        }
        :host(.collapsed) .summarizer-handle {
            border-radius: 9px 0 0 0;
        }
        :host .summarizer-handle:active {
            cursor: grabbing;
        }
        :host .summarizer-title {
            font-weight: 600;
            font-size: 14px;
            color: #fff;
            margin: 0;
            text-align: center;
        }
        :host .summarizer-content {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: rgba(255,255,255,0.95);
            border-radius: 0 0 9px 9px;
        }
        :host(.collapsed) .summarizer-content {
            border-radius: 0 0 0 9px;
        }
        :host .summarizer-section {
            margin: 0;
            padding: 0;
        }
        :host .summarizer-section-title {
            font-size: 11px;
            font-weight: 600;
            color: #667eea;
            margin: 0 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        :host .summarizer-buttons {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        :host .summarizer-btn {
            flex: 1;
            min-width: 0;
            padding: 8px 4px;
            border: 1px solid #667eea;
            background: #fff;
            color: #667eea;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
            white-space: nowrap;
            text-align: center;
        }
        :host .summarizer-btn:hover {
            background: #667eea;
            color: #fff;
        }
        :host .summarizer-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        :host .summarizer-btn.active {
            background: #667eea;
            color: #fff;
            font-weight: 600;
        }
        :host .summarizer-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        :host .summarizer-status {
            font-size: 10px;
            color: #666;
            margin: 0;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        :host .summarizer-badge-settings {
            position: relative;
        }
        :host .summarizer-badge-settings .summarizer-settings-btn {
            min-width: 24px;
            width: 24px;
            height: 24px;
            flex: none;
            padding: 4px;
            font-size: 12px;
        }
        :host .summarizer-badge-settings .summarizer-settings-popover {
            right: 0;
            bottom: 28px;
            top: auto;
            min-width: 160px;
        }
        :host .summarizer-badge-settings .summarizer-settings-popover.popover-below {
            bottom: auto;
            top: 28px;
        }
        :host .summarizer-badge-settings .selectors-btn,
        :host .summarizer-badge-settings .inspect-btn,
        :host .summarizer-badge-settings .highlight-btn {
            width: 100%;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            border-radius: 0;
            border-left: none;
            border-right: none;
            border-bottom: none;
            background: transparent;
        }
        :host .summarizer-badge-settings .inspect-btn,
        :host .summarizer-badge-settings .highlight-btn {
            margin-top: 4px;
            padding-top: 8px;
            border-top: none;
        }
        :host .summarizer-badge-settings .selectors-btn:hover,
        :host .summarizer-badge-settings .inspect-btn:hover,
        :host .summarizer-badge-settings .highlight-btn:hover {
            background: #f3f4f6;
            color: #4338ca;
        }
        :host .summarizer-branding {
            font-size: 8px;
            color: rgba(255,255,255,0.6);
            text-align: center;
            padding: 2px 0 0 0;
            margin: 0;
            letter-spacing: 0.3px;
        }

        

        :host .summarizer-settings-popover {
            position: absolute;
            top: 40px;
            right: 0;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            padding: 16px;
            min-width: 200px;
            z-index: 10;
            display: none;
        }

        :host .summarizer-settings-popover.open {
            display: block;
        }

        :host .summarizer-settings-group {
            margin-bottom: 14px;
        }

        :host .summarizer-settings-group:last-child {
            margin-bottom: 0;
        }

        :host .summarizer-settings-label {
            font: 600 11px/1.2 system-ui, sans-serif;
            color: #667eea;
            margin: 0 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        :host .summarizer-settings-options {
            display: flex;
            gap: 4px;
        }

        :host .summarizer-settings-option {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #ddd;
            background: #fff;
            color: #666;
            border-radius: 6px;
            cursor: pointer;
            font: 500 12px/1.2 system-ui, sans-serif;
            text-align: center;
            transition: all 0.15s;
        }

        :host .summarizer-settings-option:hover {
            border-color: #667eea;
            color: #667eea;
        }

        :host .summarizer-settings-option.active {
            background: #667eea;
            border-color: #667eea;
            color: #fff;
        }

        :host .summarizer-shortcut-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        :host .summarizer-shortcut-row:last-child {
            margin-bottom: 0;
        }

        :host .summarizer-shortcut-label {
            font: 500 11px/1.2 system-ui, sans-serif;
            color: #666;
            min-width: 40px;
        }

        :host .summarizer-shortcut-input {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font: 500 11px/1.2 system-ui, sans-serif;
            text-align: center;
            cursor: pointer;
            background: #fff;
            color: #333;
        }

        :host .summarizer-shortcut-input:focus {
            outline: none;
            border-color: #667eea;
            background: #f0f4ff;
        }

        :host .summarizer-shortcut-input.recording {
            border-color: #f59e0b;
            background: #fffbeb;
            animation: summarizer-pulse 1s infinite;
        }

        :host(.summarizer-dark) .summarizer-shortcut-label {
            color: #9ca3af;
        }

        :host(.summarizer-dark) .summarizer-shortcut-input {
            background: #374151;
            border-color: #4b5563;
            color: #e5e7eb;
        }

        :host(.summarizer-dark) .summarizer-shortcut-input:focus {
            border-color: #6366f1;
            background: #1e1b4b;
        }

        :host(.summarizer-dark) .summarizer-wrapper {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
            border-color: #4338ca;
        }

        :host(.summarizer-dark) .summarizer-slide-handle {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
            border-color: #4338ca;
        }

        :host(.summarizer-dark) .summarizer-content {
            background: rgba(30, 27, 75, 0.95);
        }

        :host(.summarizer-dark) .summarizer-btn {
            background: #1e1b4b;
            border-color: #6366f1;
            color: #a5b4fc;
        }

        :host(.summarizer-dark) .summarizer-btn:hover {
            background: #6366f1;
            color: #fff;
        }

        :host(.summarizer-dark) .summarizer-btn.active {
            background: #6366f1;
            color: #fff;
        }

        :host(.summarizer-dark) .summarizer-status {
            color: #9ca3af;
        }

        :host(.summarizer-dark) .summarizer-badge-settings .selectors-btn,
        :host(.summarizer-dark) .summarizer-badge-settings .inspect-btn,

        :host(.summarizer-dark) .summarizer-badge-settings .highlight-btn {
            border-top-color: #374151;
            color: #d1d5db;
        }

        :host(.summarizer-dark) .summarizer-badge-settings .selectors-btn:hover,
        :host(.summarizer-dark) .summarizer-badge-settings .inspect-btn:hover,

        :host(.summarizer-dark) .summarizer-badge-settings .highlight-btn:hover {
            background: #374151;
            color: #a5b4fc;
        }

        :host(.summarizer-dark) .summarizer-settings-popover {
            background: #1f2937;
            border-color: #374151;
        }

        :host(.summarizer-dark) .summarizer-settings-label {
            color: #a5b4fc;
        }

        :host(.summarizer-dark) .summarizer-settings-option {
            background: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }

        :host(.summarizer-dark) .summarizer-settings-option:hover {
            border-color: #6366f1;
            color: #a5b4fc;
        }

        :host(.summarizer-dark) .summarizer-settings-option.active {
            background: #6366f1;
            border-color: #6366f1;
            color: #fff;
        }
        @media print {
            :host { display: none !important; }
        }
    `;
    }

    /**
     * Generate CSS for summary overlay shadow DOM
     */
    function getSummaryOverlayShadowCSS() {
        return `
        :host {
            all: initial;
            display: block;
        }

        .summarizer-summary-overlay {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483645;
            background: linear-gradient(135deg, #f8f9ff 0%, #fff5f7 100%);
            border: 3px solid #667eea;
            border-radius: 16px;
            width: 96%;
            max-width: 760px;
            max-height: 90vh;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.35), 0 0 0 9999px rgba(0, 0, 0, 0.4);
            animation: summarizer-summary-fadein 0.3s ease;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-sizing: border-box;
        }

        @keyframes summarizer-summary-fadein {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .summarizer-summary-container {
            padding: 0;
            box-sizing: border-box;
        }

        .summarizer-summary-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 16px 20px;
            border-radius: 13px 13px 0 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .summarizer-summary-badge {
            font: 600 16px/1.2 system-ui, sans-serif;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .summarizer-summary-close {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #fff;
            font-size: 20px;
            font-weight: 600;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
            line-height: 1;
        }

        .summarizer-summary-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
        }

        .summarizer-summary-content {
            padding: 28px 40px;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: var(--summarizer-font-size, 17px);
            line-height: var(--summarizer-line-height, 1.8);
            font-weight: 400;
            color: #2d3748;
            max-height: calc(90vh - 180px);
            overflow-y: auto;
            overscroll-behavior: contain;
        }

        .summarizer-summary-content-inner {
            max-width: 680px;
            margin: 0 auto;
        }

        .summarizer-summary-content p {
            margin: 0 0 1.25em 0;
            text-align: left;
            word-spacing: 0.05em;
            letter-spacing: 0.01em;
            font-size: inherit;
            line-height: inherit;
            font-family: inherit;
            font-weight: inherit;
            color: inherit;
        }

        .summarizer-summary-content p:last-child {
            margin-bottom: 0;
        }

        .summarizer-summary-footer {
            padding: 16px 20px;
            background: rgba(102, 126, 234, 0.05);
            border-top: 1px solid rgba(102, 126, 234, 0.15);
            border-radius: 0 0 13px 13px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }

        .summarizer-summary-footer-text {
            font: 400 11px/1.2 system-ui, sans-serif;
            color: #999;
            letter-spacing: 0.3px;
        }

        .summarizer-resummarize-btn {
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: rgba(255, 255, 255, 0.9);
            font: 400 12px/1.2 system-ui, sans-serif;
            cursor: pointer;
            height: 32px;
            padding: 0 10px;
            border-radius: 6px;
            transition: all 0.2s;
            margin-left: auto;
            margin-right: 8px;
            display: flex;
            align-items: center;
        }

        .summarizer-resummarize-btn:hover {
            background: rgba(255, 255, 255, 0.25);
            color: #fff;
        }

        .summarizer-summary-close-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font: 600 14px/1.2 system-ui, sans-serif;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .summarizer-summary-close-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .summarizer-summary-header-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .summarizer-summary-settings {
            position: relative;
        }

        .summarizer-summary-settings-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #fff;
            font-size: 18px;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
            line-height: 1;
        }

        .summarizer-summary-settings-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .summarizer-summary-popover {
            position: absolute;
            top: 40px;
            right: 0;
            min-width: 180px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            padding: 16px;
            z-index: 10;
            display: none;
        }

        .summarizer-summary-popover.open {
            display: block;
        }

        .summarizer-settings-group {
            margin-bottom: 14px;
        }

        .summarizer-settings-group:last-child {
            margin-bottom: 0;
        }

        .summarizer-settings-label {
            font: 600 11px/1.2 system-ui, sans-serif;
            color: #667eea;
            margin: 0 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .summarizer-settings-options {
            display: flex;
            gap: 4px;
        }

        .summarizer-settings-option {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #ddd;
            background: #fff;
            color: #666;
            border-radius: 6px;
            cursor: pointer;
            font: 500 12px/1.2 system-ui, sans-serif;
            text-align: center;
            transition: all 0.15s;
        }

        .summarizer-settings-option:hover {
            border-color: #667eea;
            color: #667eea;
        }

        .summarizer-settings-option.active {
            background: #667eea;
            border-color: #667eea;
            color: #fff;
        }

        /* Dark mode */
        .summarizer-summary-overlay.summarizer-dark {
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
            border-color: #4338ca;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-header {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-content {
            color: #e5e7eb;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-footer {
            background: rgba(30, 27, 75, 0.3);
            border-top-color: rgba(99, 102, 241, 0.3);
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-footer-text {
            color: #6b7280;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-close-btn {
            background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-popover {
            background: #1f2937;
            border-color: #374151;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-label {
            color: #a5b4fc;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option {
            background: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option:hover {
            border-color: #6366f1;
            color: #a5b4fc;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option.active {
            background: #6366f1;
            border-color: #6366f1;
            color: #fff;
        }
        @media print {
            .summarizer-summary-overlay {
                position: static;
                transform: none;
                width: 100%;
                max-width: 100%;
                max-height: none;
                margin: 0 0 1em 0;
                border: 1px solid #999;
                border-radius: 0;
                box-shadow: none;
                animation: none;
                background: #fff;
                color: #000;
            }
            .summarizer-summary-content {
                max-height: none;
                overflow: visible;
            }
            .summarizer-resummarize-btn,
            .summarizer-summary-close,
            .summarizer-summary-close-btn,
            .summarizer-summary-header-controls {
                display: none !important;
            }
        }
    `;
    }

    /**
     * Sync badge settings UI when changed from summary overlay
     */
    function syncBadgeSetting(setting, value) {
        if (!overlay) return;
        const options = overlayShadow.querySelectorAll(`[data-setting="${setting}"] .summarizer-settings-option`);
        options.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }

    const OVERLAY_ID = 'summarizer-overlay-singleton';

    const CREATION_LOCK_ATTR = 'data-summarizer-creating';

    /**
     * Create the main overlay
     */
    async function createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors) {
        // Store digest callback for re-summarize from summary overlay
        storedOnDigest = onDigest;

        // Check for existing overlays (can be duplicates if script runs multiple times)
        const existingOverlays = document.querySelectorAll(`#${OVERLAY_ID}`);

        if (existingOverlays.length > 1) {
            // Multiple overlays exist - remove all and recreate
            existingOverlays.forEach(el => el.remove());
            overlay = null;
        } else if (existingOverlays.length === 1) {
            // Single overlay exists - reuse it
            overlay = existingOverlays[0];
            overlayShadow = overlay.shadowRoot;
            return overlay;
        }

        // Also check module variable
        if (overlay && overlay.isConnected) return overlay;

        // DOM-based lock to prevent race conditions across script contexts
        if (document.body.hasAttribute(CREATION_LOCK_ATTR)) return null;
        document.body.setAttribute(CREATION_LOCK_ATTR, 'true');

        // Release the lock on every path: if a storage read below were to throw
        // while the attribute is set, the overlay could never be created again
        // on this page.
        try {
            return await buildOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors);
        } finally {
            document.body.removeAttribute(CREATION_LOCK_ATTR);
        }
    }

    async function buildOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors) {
        // Load saved display settings
        const savedFontSize = await storage.get(STORAGE_KEYS.SUMMARY_FONT_SIZE) || 'default';
        const savedLineHeight = await storage.get(STORAGE_KEYS.SUMMARY_LINE_HEIGHT) || 'default';
        const savedTheme = await storage.get(STORAGE_KEYS.THEME) || 'auto';

        // Load shortcuts
        const savedShortcutLarge = await storage.get(STORAGE_KEYS.SHORTCUT_LARGE);
        const savedShortcutSmall = await storage.get(STORAGE_KEYS.SHORTCUT_SMALL);
        shortcuts.large = savedShortcutLarge ? parseShortcut(savedShortcutLarge) : DEFAULT_SHORTCUTS.large;
        shortcuts.small = savedShortcutSmall ? parseShortcut(savedShortcutSmall) : DEFAULT_SHORTCUTS.small;

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = OVERLAY_COLLAPSED.value ? 'summarizer-overlay collapsed' : 'summarizer-overlay';
        overlay.setAttribute(UI_ATTR, '');

        // Apply theme
        applyTheme(overlay, savedTheme);

        // Set initial position - always anchored to right edge.
        // Render at the saved Y for now; the real clamp happens in
        // repositionBadge() after the badge is in the DOM (so we can measure its
        // height and read a reliable viewport size). Clamping here against a
        // not-yet-ready viewport is what previously snapped the badge to the top.
        overlay.style.top = `${OVERLAY_POS.y}px`;
        overlay.style.right = '0px';

        // Attach shadow DOM for CSS isolation
        overlayShadow = overlay.attachShadow({ mode: 'open' });

        setHTML(overlayShadow, `
        <style>${getBadgeShadowCSS()}</style>
        <div class="summarizer-slide-handle" title="${OVERLAY_COLLAPSED.value ? 'Open' : 'Close'}">
            ${OVERLAY_COLLAPSED.value ? '◀' : '▶'}
        </div>
        <div class="summarizer-wrapper">
        <div class="summarizer-handle">
            <div class="summarizer-title">Summarize</div>
            <div class="summarizer-branding">The Web</div>
        </div>
        <div class="summarizer-content">
            <div class="summarizer-buttons">
                <button class="summarizer-btn" data-size="large" title="${formatShortcut(shortcuts.large)}">Large</button>
                <button class="summarizer-btn" data-size="small" title="${formatShortcut(shortcuts.small)}">Small</button>
            </div>
            <div class="summarizer-footer">
                <div class="summarizer-status">Ready</div>
                <div class="summarizer-badge-settings">
                    <button class="summarizer-btn summarizer-settings-btn" title="Display settings">&#9881;</button>
                    <div class="summarizer-settings-popover">
                        <div class="summarizer-settings-group">
                            <div class="summarizer-settings-label">Font Size</div>
                            <div class="summarizer-settings-options" data-setting="fontSize">
                                <button class="summarizer-settings-option${savedFontSize === 'small' ? ' active' : ''}" data-value="small">S</button>
                                <button class="summarizer-settings-option${savedFontSize === 'default' ? ' active' : ''}" data-value="default">M</button>
                                <button class="summarizer-settings-option${savedFontSize === 'large' ? ' active' : ''}" data-value="large">L</button>
                            </div>
                        </div>
                        <div class="summarizer-settings-group">
                            <div class="summarizer-settings-label">Spacing</div>
                            <div class="summarizer-settings-options" data-setting="lineHeight">
                                <button class="summarizer-settings-option${savedLineHeight === 'compact' ? ' active' : ''}" data-value="compact">-</button>
                                <button class="summarizer-settings-option${savedLineHeight === 'default' ? ' active' : ''}" data-value="default">=</button>
                                <button class="summarizer-settings-option${savedLineHeight === 'comfortable' ? ' active' : ''}" data-value="comfortable">+</button>
                            </div>
                        </div>
                        <div class="summarizer-settings-group">
                            <div class="summarizer-settings-label">Theme</div>
                            <div class="summarizer-settings-options" data-setting="theme">
                                <button class="summarizer-settings-option${savedTheme === 'light' ? ' active' : ''}" data-value="light">Light</button>
                                <button class="summarizer-settings-option${savedTheme === 'dark' ? ' active' : ''}" data-value="dark">Dark</button>
                                <button class="summarizer-settings-option${savedTheme === 'auto' ? ' active' : ''}" data-value="auto">Auto</button>
                            </div>
                        </div>
                        <div class="summarizer-settings-group">
                            <div class="summarizer-settings-label">Shortcuts</div>
                            <div class="summarizer-shortcut-row">
                                <span class="summarizer-shortcut-label">Large:</span>
                                <input type="text" class="summarizer-shortcut-input" data-shortcut="large" value="${formatShortcut(shortcuts.large)}" readonly placeholder="Click to set">
                            </div>
                            <div class="summarizer-shortcut-row">
                                <span class="summarizer-shortcut-label">Small:</span>
                                <input type="text" class="summarizer-shortcut-input" data-shortcut="small" value="${formatShortcut(shortcuts.small)}" readonly placeholder="Click to set">
                            </div>
                        </div>
                        <button class="summarizer-btn selectors-btn">Edit Selectors</button>
                        <button class="summarizer-btn inspect-btn">Inspect Elements</button>
                        <button class="summarizer-btn highlight-btn">Show Included Elements</button>
                    </div>
                </div>
            </div>
        </div>
        </div>
    `);

        document.body.appendChild(overlay);

        // Now that the badge is in the DOM we can measure it and clamp into a
        // reliable viewport. Keep OVERLAY_POS as the user's desired position.
        currentOverlayPos = OVERLAY_POS;
        repositionBadge();

        // Re-clamp when the viewport changes (rotation, mobile chrome, resize) so
        // the badge stays on-screen and returns to its desired spot when space
        // comes back. Registered once for the lifetime of the page.
        if (!resizeHandlerRegistered) {
            window.addEventListener('resize', repositionBadge);
            window.addEventListener('orientationchange', repositionBadge);
            resizeHandlerRegistered = true;
        }

        // Attach event listeners
        const slideHandle = overlayShadow.querySelector('.summarizer-slide-handle');
        const dragHandle = overlayShadow.querySelector('.summarizer-handle');
        const digestBtns = overlayShadow.querySelectorAll('.summarizer-btn[data-size]');
        const inspectBtn = overlayShadow.querySelector('.inspect-btn');
        const settingsPopover = overlayShadow.querySelector('.summarizer-settings-popover');
        const settingsBtn = overlayShadow.querySelector('.summarizer-settings-btn');

        slideHandle.addEventListener('click', (e) => {
            // Close settings popover when collapsing badge
            settingsPopover?.classList.remove('open');
            toggleSlide(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage);
        });
        dragHandle.addEventListener('mousedown', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));
        dragHandle.addEventListener('touchstart', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));

        digestBtns.forEach(btn => {
            // Keep any active text selection: without this, the mousedown into the
            // badge collapses the selection (in Chrome at least) before the click
            // handler gets a chance to read it for "summarize selection".
            btn.addEventListener('mousedown', (e) => e.preventDefault());
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                onDigest(size);
            });
        });

        const selectorsBtn = overlayShadow.querySelector('.selectors-btn');
        selectorsBtn.addEventListener('click', () => {
            settingsPopover?.classList.remove('open');
            onEditSelectors?.();
        });

        inspectBtn.addEventListener('click', () => {
            settingsPopover?.classList.remove('open');
            onInspect();
        });

        const highlightBtn = overlayShadow.querySelector('.highlight-btn');
        highlightBtn.addEventListener('click', () => {
            settingsPopover?.classList.remove('open');
            onSummaryHighlight?.();
        });

        // Badge settings popover

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const opening = !settingsPopover.classList.contains('open');
            if (opening) {
                // Measure available space above the button
                const btnRect = settingsBtn.getBoundingClientRect();
                // Temporarily show offscreen to measure popover height
                settingsPopover.style.visibility = 'hidden';
                settingsPopover.classList.add('open');
                const popoverHeight = settingsPopover.offsetHeight;
                settingsPopover.classList.remove('open');
                settingsPopover.style.visibility = '';
                // Show below if not enough room above
                if (btnRect.top < popoverHeight + 8) {
                    settingsPopover.classList.add('popover-below');
                } else {
                    settingsPopover.classList.remove('popover-below');
                }
            }
            settingsPopover.classList.toggle('open');
        });

        // Close popover when clicking outside (use composedPath to see through
        // shadow DOM). Registered once for the page and resolved against the
        // current shadow root, so SPA-driven overlay re-creations don't stack
        // listeners that pin detached shadow trees in memory.
        if (!documentClickRegistered) {
            documentClickRegistered = true;
            document.addEventListener('click', (e) => {
                const popover = overlayShadow?.querySelector('.summarizer-settings-popover');
                if (!popover) return;
                const path = e.composedPath();
                if (!path.some(el => el.classList && el.classList.contains('summarizer-badge-settings'))) {
                    popover.classList.remove('open');
                }
            });
        }

        // Handle font size changes
        const fontSizeOptions = overlayShadow.querySelectorAll('[data-setting="fontSize"] .summarizer-settings-option');
        fontSizeOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                fontSizeOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
                // Apply live to open summary
                if (summaryOverlay && summaryOverlay.isConnected) {
                    summaryOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
                    const contentEl = summaryOverlay.querySelector('.summarizer-summary-content');
                    if (contentEl) contentEl.style.setProperty('font-size', `${SUMMARY_FONT_SIZES[value]}px`, 'important');
                }
            });
        });

        // Handle line height changes
        const lineHeightOptions = overlayShadow.querySelectorAll('[data-setting="lineHeight"] .summarizer-settings-option');
        lineHeightOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                lineHeightOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
                // Apply live to open summary
                if (summaryOverlay && summaryOverlay.isConnected) {
                    summaryOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[value]);
                    const contentEl = summaryOverlay.querySelector('.summarizer-summary-content');
                    if (contentEl) contentEl.style.setProperty('line-height', SUMMARY_LINE_HEIGHTS[value], 'important');
                }
            });
        });

        // Handle theme changes
        const themeOptions = overlayShadow.querySelectorAll('[data-setting="theme"] .summarizer-settings-option');
        themeOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                themeOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.THEME, value);
                updateAllThemes(value);
            });
        });

        // Listen for system theme changes (for auto mode). Registered once per
        // page; the handler reads module state, so re-creations need no rebind.
        if (!mediaQueryList && window.matchMedia) {
            mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
            const handleSystemThemeChange = () => {
                if (currentTheme === 'auto') {
                    updateAllThemes('auto');
                }
            };
            if (mediaQueryList.addEventListener) {
                mediaQueryList.addEventListener('change', handleSystemThemeChange);
            } else if (mediaQueryList.addListener) {
                mediaQueryList.addListener(handleSystemThemeChange);
            }
        }

        // Handle shortcut recording
        const shortcutInputs = overlayShadow.querySelectorAll('.summarizer-shortcut-input');
        shortcutInputs.forEach(input => {
            input.addEventListener('click', () => {
                input.classList.add('recording');
                input.value = 'Press keys...';

                const recordHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Ignore modifier-only keys
                    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                    // Record via event.code so Alt-composed characters (macOS)
                    // don't end up as the stored key.
                    const shortcut = {
                        key: eventKeyName(e),
                        ctrl: e.ctrlKey,
                        alt: e.altKey,
                        shift: e.shiftKey,
                        meta: e.metaKey
                    };

                    const shortcutStr = formatShortcut(shortcut);
                    const shortcutType = input.dataset.shortcut;

                    input.value = shortcutStr;
                    input.classList.remove('recording');
                    shortcuts[shortcutType] = shortcut;

                    // Save to storage
                    const storageKey = shortcutType === 'large' ? STORAGE_KEYS.SHORTCUT_LARGE : STORAGE_KEYS.SHORTCUT_SMALL;
                    storage.set(storageKey, shortcutStr);

                    // Update button title
                    const btn = overlayShadow.querySelector(`[data-size="${shortcutType}"]`);
                    if (btn) btn.title = shortcutStr;

                    document.removeEventListener('keydown', recordHandler, true);
                };

                document.addEventListener('keydown', recordHandler, true);

                // Cancel on blur
                const blurHandler = () => {
                    input.classList.remove('recording');
                    input.value = formatShortcut(shortcuts[input.dataset.shortcut]);
                    document.removeEventListener('keydown', recordHandler, true);
                    input.removeEventListener('blur', blurHandler);
                };
                input.addEventListener('blur', blurHandler);
            });
        });

        // Global keyboard shortcut listener
        if (keyboardHandler) {
            document.removeEventListener('keydown', keyboardHandler);
        }
        keyboardHandler = (e) => {
            // Don't trigger if typing in an input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (matchesShortcut(e, shortcuts.large)) {
                e.preventDefault();
                onDigest('large');
            } else if (matchesShortcut(e, shortcuts.small)) {
                e.preventDefault();
                onDigest('small');
            }
        };
        document.addEventListener('keydown', keyboardHandler);

        return overlay;
    }

    /**
     * Clamp the badge vertically into the current viewport.
     *
     * Only adjusts the rendered `top`; OVERLAY_POS keeps the user's desired
     * position so the badge can return to it when the viewport grows back. Skips
     * clamping entirely when the viewport height isn't reliable yet (<= 0), which
     * is what previously caused the badge to snap to the top during early load or
     * mobile chrome transitions.
     */
    function repositionBadge() {
        if (!overlay || !overlay.isConnected || !currentOverlayPos) return;

        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        if (vh <= 0) return;

        const badgeHeight = overlay.offsetHeight || 200;
        const maxY = Math.max(0, vh - badgeHeight);

        let desiredY = currentOverlayPos.y;
        if (typeof desiredY !== 'number' || Number.isNaN(desiredY)) desiredY = vh * 0.7;

        const clampedY = Math.max(0, Math.min(desiredY, maxY));
        overlay.style.top = `${clampedY}px`;
    }

    /**
     * Toggle overlay slide state
     */
    async function toggleSlide(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        OVERLAY_COLLAPSED.value = !OVERLAY_COLLAPSED.value;
        await storage.set(STORAGE_KEYS.OVERLAY_COLLAPSED, String(OVERLAY_COLLAPSED.value));

        const currentY = parseInt(overlay.style.top) || OVERLAY_POS.y;

        if (OVERLAY_COLLAPSED.value) {
            overlay.classList.add('collapsed');
        } else {
            overlay.classList.remove('collapsed');
        }

        // Always position from the right, use transform for collapse
        overlay.style.left = '';
        overlay.style.right = '0px';
        overlay.style.top = `${currentY}px`;

        OVERLAY_POS.y = currentY;
        storage.set(STORAGE_KEYS.OVERLAY_POS, JSON.stringify(OVERLAY_POS));

        const handle = overlayShadow.querySelector('.summarizer-slide-handle');
        if (handle) {
            handle.textContent = OVERLAY_COLLAPSED.value ? '◀' : '▶';
            handle.title = OVERLAY_COLLAPSED.value ? 'Open' : 'Close';
        }
    }

    /**
     * Start dragging the overlay
     */
    function startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage) {
        if (OVERLAY_COLLAPSED.value) return;

        isDragging = true;
        overlay.classList.add('dragging');

        const rect = overlay.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
        dragOffset.x = clientX - rect.left;
        dragOffset.y = clientY - rect.top;

        const onDrag = (e) => {
            if (!isDragging) return;

            const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            let newY = clientY - dragOffset.y;

            const maxY = window.innerHeight - overlay.offsetHeight;
            newY = Math.max(0, Math.min(newY, maxY));

            overlay.style.top = `${newY}px`;

            OVERLAY_POS.y = newY;

            e.preventDefault();
        };

        const stopDrag = () => {
            if (!isDragging) return;

            isDragging = false;
            overlay.classList.remove('dragging');

            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('touchend', stopDrag);

            storage.set(STORAGE_KEYS.OVERLAY_POS, JSON.stringify(OVERLAY_POS));
        };

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);

        e.preventDefault();
    }

    /**
     * Update overlay status text
     */
    function updateOverlayStatus(status, mode = null, fromCache = false) {
        if (!overlay) return;

        const statusEl = overlayShadow.querySelector('.summarizer-status');
        const digestBtns = overlayShadow.querySelectorAll('.summarizer-btn[data-size]');

        digestBtns.forEach(btn => btn.classList.remove('active'));

        if (status === 'ready') {
            statusEl.textContent = 'Ready';
            digestBtns.forEach(btn => btn.disabled = false);
        } else if (status === 'processing') {
            const size = mode ? mode.split('_')[1] : '';
            const sizeLabel = size === 'large' ? 'Large' : 'Small';
            statusEl.textContent = fromCache ? `Applying ${sizeLabel}...` : `Processing ${sizeLabel}...`;
            digestBtns.forEach(btn => btn.disabled = true);
        } else if (status === 'digested') {
            const size = mode ? mode.split('_')[1] : '';
            const sizeLabel = size === 'large' ? 'Large' : 'Small';
            statusEl.textContent = `${sizeLabel} summary applied`;
            digestBtns.forEach(btn => btn.disabled = false);

            const activeBtn = overlayShadow.querySelector(`[data-size="${size}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    /**
     * Lock body scroll to prevent background scrolling while modal is open
     */
    function lockBodyScroll() {
        if (scrollLocked) return;
        scrollLocked = true;
        savedBodyOverflow = document.body.style.overflow;
        savedHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }

    /**
     * Restore body scroll after modal is closed
     */
    function unlockBodyScroll() {
        if (!scrollLocked) return;
        scrollLocked = false;
        document.body.style.overflow = savedBodyOverflow ?? '';
        document.documentElement.style.overflow = savedHtmlOverflow ?? '';
        savedBodyOverflow = null;
        savedHtmlOverflow = null;
    }

    /**
     * Show summary overlay (uses Shadow DOM for CSS isolation)
     */
    async function showSummaryOverlay(summaryText, mode, container, OVERLAY_COLLAPSED, storage) {
        removeSummaryOverlay();

        // Auto-collapse actions overlay on mobile to prevent overlap
        if (overlay && !OVERLAY_COLLAPSED.value) {
            autoCollapsedOverlay = true;
            autoCollapsedState = OVERLAY_COLLAPSED;
            collapseOverlay(OVERLAY_COLLAPSED);
        }

        // Load saved display settings
        const savedFontSize = await storage.get(STORAGE_KEYS.SUMMARY_FONT_SIZE) || 'default';
        const savedLineHeight = await storage.get(STORAGE_KEYS.SUMMARY_LINE_HEIGHT) || 'default';

        const sizeLabel = mode.includes('large') ? 'Large' : 'Small';
        const isSelectedText = !container;

        // Create host element for shadow DOM
        summaryOverlay = document.createElement('div');
        summaryOverlay.setAttribute(UI_ATTR, '');

        // Attach shadow root
        summaryOverlayShadow = summaryOverlay.attachShadow({ mode: 'open' });

        // Build shadow DOM content
        setHTML(summaryOverlayShadow, `
        <style>${getSummaryOverlayShadowCSS()}</style>
        <div class="summarizer-summary-overlay">
            <div class="summarizer-summary-container">
                <div class="summarizer-summary-header">
                    <div class="summarizer-summary-badge">${escapeHtml(sizeLabel)} Summary${isSelectedText ? ' (Selected Text)' : ''}</div>
                    <button class="summarizer-resummarize-btn" data-size="${mode.includes('large') ? 'small' : 'large'}">Re-summarize as ${mode.includes('large') ? 'Small' : 'Large'}</button>
                    <div class="summarizer-summary-header-controls">
                        <div class="summarizer-summary-settings">
                            <button class="summarizer-summary-settings-btn" title="Display settings">&#9881;</button>
                            <div class="summarizer-settings-popover summarizer-summary-popover">
                                <div class="summarizer-settings-group">
                                    <div class="summarizer-settings-label">Font Size</div>
                                    <div class="summarizer-settings-options" data-setting="fontSize">
                                        <button class="summarizer-settings-option${savedFontSize === 'small' ? ' active' : ''}" data-value="small">S</button>
                                        <button class="summarizer-settings-option${savedFontSize === 'default' ? ' active' : ''}" data-value="default">M</button>
                                        <button class="summarizer-settings-option${savedFontSize === 'large' ? ' active' : ''}" data-value="large">L</button>
                                    </div>
                                </div>
                                <div class="summarizer-settings-group">
                                    <div class="summarizer-settings-label">Spacing</div>
                                    <div class="summarizer-settings-options" data-setting="lineHeight">
                                        <button class="summarizer-settings-option${savedLineHeight === 'compact' ? ' active' : ''}" data-value="compact">-</button>
                                        <button class="summarizer-settings-option${savedLineHeight === 'default' ? ' active' : ''}" data-value="default">=</button>
                                        <button class="summarizer-settings-option${savedLineHeight === 'comfortable' ? ' active' : ''}" data-value="comfortable">+</button>
                                    </div>
                                </div>
                                <div class="summarizer-settings-group">
                                    <div class="summarizer-settings-label">Theme</div>
                                    <div class="summarizer-settings-options" data-setting="theme">
                                        <button class="summarizer-settings-option${currentTheme === 'light' ? ' active' : ''}" data-value="light">Light</button>
                                        <button class="summarizer-settings-option${currentTheme === 'dark' ? ' active' : ''}" data-value="dark">Dark</button>
                                        <button class="summarizer-settings-option${currentTheme === 'auto' ? ' active' : ''}" data-value="auto">Auto</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button class="summarizer-summary-close" title="Close">&#10005;</button>
                    </div>
                </div>
                <div class="summarizer-summary-content">
                    <div class="summarizer-summary-content-inner">
                        ${summaryText.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
                    </div>
                </div>
                <div class="summarizer-summary-footer">
                    <div class="summarizer-summary-footer-text">Summarize The Web</div>
                    <button class="summarizer-summary-close-btn">Close</button>
                </div>
            </div>
        </div>
    `);

        document.body.appendChild(summaryOverlay);
        lockBodyScroll();

        // Get references to shadow DOM elements
        const innerOverlay = summaryOverlayShadow.querySelector('.summarizer-summary-overlay');
        summaryOverlayShadow.querySelector('.summarizer-summary-content');

        // Apply CSS custom properties to the inner overlay
        innerOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[savedFontSize]}px`);
        innerOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[savedLineHeight]);

        // Apply theme to inner overlay
        applyTheme(innerOverlay, currentTheme);

        const closeBtn = summaryOverlayShadow.querySelector('.summarizer-summary-close');
        const closeBtnFooter = summaryOverlayShadow.querySelector('.summarizer-summary-close-btn');

        const closeHandler = () => {
            removeSummaryOverlay();
            updateOverlayStatus('ready');
        };

        closeBtn.addEventListener('click', closeHandler);
        closeBtnFooter.addEventListener('click', closeHandler);

        // Re-summarize button
        const resummarizeBtn = summaryOverlayShadow.querySelector('.summarizer-resummarize-btn');
        if (resummarizeBtn && storedOnDigest) {
            resummarizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const size = resummarizeBtn.dataset.size;
                removeSummaryOverlay();
                storedOnDigest(size);
            });
        }

        // Summary settings popover
        const settingsBtn = summaryOverlayShadow.querySelector('.summarizer-summary-settings-btn');
        const settingsPopover = summaryOverlayShadow.querySelector('.summarizer-settings-popover');

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPopover.classList.toggle('open');
        });

        // Close popover when clicking outside
        summaryOverlayShadow.querySelector('.summarizer-summary-container').addEventListener('click', (e) => {
            if (!e.target.closest('.summarizer-summary-settings')) {
                settingsPopover.classList.remove('open');
            }
        });

        // Handle font size changes
        const fontSizeOptions = summaryOverlayShadow.querySelectorAll('[data-setting="fontSize"] .summarizer-settings-option');
        fontSizeOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                fontSizeOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
                innerOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
                // Sync badge settings if visible
                syncBadgeSetting('fontSize', value);
            });
        });

        // Handle line height changes
        const lineHeightOptions = summaryOverlayShadow.querySelectorAll('[data-setting="lineHeight"] .summarizer-settings-option');
        lineHeightOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                lineHeightOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
                innerOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[value]);
                // Sync badge settings if visible
                syncBadgeSetting('lineHeight', value);
            });
        });

        // Handle theme changes
        const themeOptions = summaryOverlayShadow.querySelectorAll('[data-setting="theme"] .summarizer-settings-option');
        themeOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                themeOptions.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                storage.set(STORAGE_KEYS.THEME, value);
                updateAllThemes(value);
                // Sync badge settings if visible
                syncBadgeSetting('theme', value);
            });
        });

        // Close overlay when clicking the backdrop (the inner overlay element itself, not the container)
        innerOverlay.addEventListener('click', (e) => {
            if (e.target === innerOverlay) {
                closeHandler();
            }
        });

        // Tracked at module level so removeSummaryOverlay() can unregister it on
        // every close path (buttons, backdrop, re-summarize) — not just Escape.
        summaryEscHandler = (e) => {
            if (e.key === 'Escape') {
                // Close popover first if open
                if (settingsPopover.classList.contains('open')) {
                    settingsPopover.classList.remove('open');
                    return;
                }
                closeHandler();
            }
        };
        document.addEventListener('keydown', summaryEscHandler);
    }

    /**
     * Remove summary overlay
     */
    function removeSummaryOverlay() {
        unlockBodyScroll();
        if (summaryEscHandler) {
            document.removeEventListener('keydown', summaryEscHandler);
            summaryEscHandler = null;
        }
        if (summaryOverlay && summaryOverlay.isConnected) {
            summaryOverlay.remove();
        }
        summaryOverlay = null;
        summaryOverlayShadow = null;

        if (autoCollapsedOverlay) {
            autoCollapsedOverlay = false;
            expandOverlay();
        }
    }

    /**
     * Collapse overlay (temporary)
     */
    function collapseOverlay(OVERLAY_COLLAPSED) {
        if (!overlay || OVERLAY_COLLAPSED.value) return;
        OVERLAY_COLLAPSED.value = true;
        overlay.classList.add('collapsed');
        overlay.style.left = '';
        overlay.style.right = '0px';
        const handle = overlayShadow.querySelector('.summarizer-slide-handle');
        if (handle) {
            handle.textContent = '◀';
            handle.title = 'Open';
        }
    }

    /**
     * Expand overlay (restore after auto-collapse)
     */
    function expandOverlay() {
        if (!overlay) return;
        if (autoCollapsedState) {
            autoCollapsedState.value = false;
            autoCollapsedState = null;
        }
        overlay.classList.remove('collapsed');
        overlay.style.right = '0px';
        overlay.style.left = '';
        const handle = overlayShadow.querySelector('.summarizer-slide-handle');
        if (handle) {
            handle.textContent = '▶';
            handle.title = 'Close';
        }
    }

    /**
     * Ensure overlay exists (recreate if removed)
     */
    function ensureOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors) {
        if (!overlay || !overlay.isConnected) {
            createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors);
        }
    }

    (async () => {

        // Only run in top-level window, not in iframes
        if (window.self !== window.top) {
            return;
        }

        const HOST = location.hostname;
        const storage = new Storage();

        // Prevent multiple API key dialogs
        let apiKeyDialogShown = { value: false };

        // Load all persisted settings in one parallel batch: GM storage calls go
        // through the extension bridge, so ~20 sequential awaits are noticeably
        // slower than a single Promise.all on every page load.
        const [
            debugRaw,
            selectorsGlobalRaw,
            excludesGlobalRaw,
            domainSelectorsRaw,
            domainExcludesRaw,
            domainsModeRaw,
            domainDenyRaw,
            domainAllowRaw,
            customPromptRaw,
            simplificationRaw,
            overlayCollapsedRaw,
            overlayPosRaw,
            autoSimplifyRaw,
            minTextLengthRaw,
            firstInstallRaw,
            apiKeyRaw,
            justEnabledRaw
        ] = await Promise.all([
            storage.get(STORAGE_KEYS.DEBUG, ''),
            storage.get(STORAGE_KEYS.SELECTORS_GLOBAL, ''),
            storage.get(STORAGE_KEYS.EXCLUDES_GLOBAL, ''),
            storage.get(STORAGE_KEYS.DOMAIN_SELECTORS, '{}'),
            storage.get(STORAGE_KEYS.DOMAIN_EXCLUDES, '{}'),
            storage.get(STORAGE_KEYS.DOMAINS_MODE, 'allow'),
            storage.get(STORAGE_KEYS.DOMAINS_DENY, '[]'),
            storage.get(STORAGE_KEYS.DOMAINS_ALLOW, '[]'),
            storage.get(STORAGE_KEYS.CUSTOM_PROMPT, ''),
            storage.get(STORAGE_KEYS.SIMPLIFICATION_STRENGTH, ''),
            storage.get(STORAGE_KEYS.OVERLAY_COLLAPSED, ''),
            storage.get(STORAGE_KEYS.OVERLAY_POS, ''),
            storage.get(STORAGE_KEYS.AUTO_SIMPLIFY, ''),
            storage.get(STORAGE_KEYS.MIN_TEXT_LENGTH, ''),
            storage.get(STORAGE_KEYS.FIRST_INSTALL, ''),
            storage.get(STORAGE_KEYS.OPENAI_KEY, ''),
            storage.get(STORAGE_KEYS.JUST_ENABLED, ''),
            initApiTracking(storage)
        ]);

        // Debug toggle
        if (debugRaw !== '') CFG.DEBUG = (debugRaw === true || debugRaw === 'true');

        // Article extraction selectors (global + per-domain)
        let SELECTORS_GLOBAL = [...DEFAULT_SELECTORS];
        let EXCLUDE_GLOBAL = { ...DEFAULT_EXCLUDES, ancestors: [...DEFAULT_EXCLUDES.ancestors] };
        let DOMAIN_SELECTORS = {};
        let DOMAIN_EXCLUDES = {};

        try { if (selectorsGlobalRaw) SELECTORS_GLOBAL = JSON.parse(selectorsGlobalRaw); } catch {}
        try { if (excludesGlobalRaw) EXCLUDE_GLOBAL = JSON.parse(excludesGlobalRaw); } catch {}
        try { DOMAIN_SELECTORS = JSON.parse(domainSelectorsRaw); } catch {}
        try { DOMAIN_EXCLUDES = JSON.parse(domainExcludesRaw); } catch {}

        // Load domain-specific settings for current host
        let SELECTORS_DOMAIN = DOMAIN_SELECTORS[HOST] || [];
        let EXCLUDE_DOMAIN = DOMAIN_EXCLUDES[HOST] || { self: [], ancestors: [] };

        // Merge global + domain-specific
        let SELECTORS = [...new Set([...SELECTORS_GLOBAL, ...SELECTORS_DOMAIN])];
        let EXCLUDE = {
            self: [...new Set([...(EXCLUDE_GLOBAL.self || []), ...(EXCLUDE_DOMAIN.self || [])])],
            ancestors: [...new Set([...(EXCLUDE_GLOBAL.ancestors || []), ...(EXCLUDE_DOMAIN.ancestors || [])])]
        };

        if (SELECTORS_DOMAIN.length > 0 || (EXCLUDE_DOMAIN.self && EXCLUDE_DOMAIN.self.length > 0) || (EXCLUDE_DOMAIN.ancestors && EXCLUDE_DOMAIN.ancestors.length > 0)) {
            log('domain-specific additions for', HOST, ':', { selectors: SELECTORS_DOMAIN, excludes: EXCLUDE_DOMAIN });
        }

        // Domain mode + lists
        let DOMAINS_MODE = domainsModeRaw || 'allow';
        let DOMAIN_DENY = [];
        let DOMAIN_ALLOW = [];
        try { DOMAIN_DENY = JSON.parse(domainDenyRaw); } catch {}
        try { DOMAIN_ALLOW = JSON.parse(domainAllowRaw); } catch {}

        // Load prompts
        let CUSTOM_PROMPTS = { ...DEFAULT_PROMPTS };
        try { if (customPromptRaw) CUSTOM_PROMPTS = JSON.parse(customPromptRaw); } catch {}

        // Load simplification style
        let SIMPLIFICATION_LEVEL = 'Balanced';
        log('Loaded simplification style from storage:', simplificationRaw, 'valid:', SIMPLIFICATION_LEVELS.includes(simplificationRaw));
        if (simplificationRaw && SIMPLIFICATION_LEVELS.includes(simplificationRaw)) {
            SIMPLIFICATION_LEVEL = simplificationRaw;
        }
        log('Using simplification level:', SIMPLIFICATION_LEVEL);

        // Overlay state
        let OVERLAY_COLLAPSED = { value: false };
        if (overlayCollapsedRaw !== '') OVERLAY_COLLAPSED.value = (overlayCollapsedRaw === true || overlayCollapsedRaw === 'true');

        let OVERLAY_POS = { x: document.documentElement.clientWidth - BADGE_WIDTH, y: window.innerHeight * 0.7 };
        try { if (overlayPosRaw) OVERLAY_POS = JSON.parse(overlayPosRaw); } catch {}

        // Auto-simplify setting
        let AUTO_SIMPLIFY = false;
        if (autoSimplifyRaw !== '') AUTO_SIMPLIFY = (autoSimplifyRaw === true || autoSimplifyRaw === 'true');

        // Minimum text length for extraction
        let MIN_TEXT_LENGTH = DEFAULT_MIN_TEXT_LENGTH;
        if (minTextLengthRaw !== '') {
            const parsed = parseInt(minTextLengthRaw, 10);
            if (!isNaN(parsed) && parsed >= 0) MIN_TEXT_LENGTH = parsed;
        }

        // Cache loads lazily on first use, so disabled/idle pages skip the
        // JSON.parse of the stored summaries entirely.
        const cache = new DigestCache(storage);

        // Domain matching
        function computeDomainDisabled(host) {
            if (DOMAINS_MODE === 'allow') return !listMatchesHost(DOMAIN_ALLOW, host);
            return listMatchesHost(DOMAIN_DENY, host);
        }

        let DOMAIN_DISABLED = computeDomainDisabled(HOST);
        log('domain check:', HOST, 'mode=', DOMAINS_MODE, 'disabled=', DOMAIN_DISABLED);

        // Register Domain Controls menu BEFORE early return so users can enable disabled domains
        registerMenuCommand('--- Domain Controls ---', () => {});

        registerMenuCommand(
            DOMAINS_MODE === 'allow' ? 'Domain mode: Allowlist only' : 'Domain mode: All domains with Denylist',
            async () => {
                DOMAINS_MODE = (DOMAINS_MODE === 'allow') ? 'deny' : 'allow';
                await storage.set(STORAGE_KEYS.DOMAINS_MODE, DOMAINS_MODE);
                location.reload();
            }
        );

        registerMenuCommand(
            computeDomainDisabled(HOST) ? `Current page: DISABLED (click to enable)` : `Current page: ENABLED (click to disable)`,
            async () => {
                const wasDisabled = computeDomainDisabled(HOST);
                if (DOMAINS_MODE === 'allow') {
                    if (listMatchesHost(DOMAIN_ALLOW, HOST)) {
                        DOMAIN_ALLOW = DOMAIN_ALLOW.filter(p => !domainPatternToRegex(p)?.test(HOST));
                    } else {
                        DOMAIN_ALLOW.push(HOST);
                    }
                    await storage.set(STORAGE_KEYS.DOMAINS_ALLOW, JSON.stringify(DOMAIN_ALLOW));
                } else {
                    if (computeDomainDisabled(HOST)) {
                        DOMAIN_DENY = DOMAIN_DENY.filter(p => !domainPatternToRegex(p)?.test(HOST));
                    } else {
                        if (!DOMAIN_DENY.includes(HOST)) DOMAIN_DENY.push(HOST);
                    }
                    await storage.set(STORAGE_KEYS.DOMAINS_DENY, JSON.stringify(DOMAIN_DENY));
                }
                // If we just enabled this domain, flag it so overlay opens expanded after reload
                if (wasDisabled && !computeDomainDisabled(HOST)) {
                    await storage.set(STORAGE_KEYS.JUST_ENABLED, 'true');
                }
                location.reload();
            }
        );

        registerMenuCommand('Edit domain allowlist', () => {
            openDomainEditor(storage, 'allow', DOMAIN_ALLOW, DOMAIN_DENY);
        });

        registerMenuCommand('Edit domain denylist', () => {
            openDomainEditor(storage, 'deny', DOMAIN_ALLOW, DOMAIN_DENY);
        });

        // Digest handler
        async function handleDigest(size) {
            const mode = `summary_${size}`;
            updateOverlayStatus('processing', mode, false);

            try {
                const textData = getTextToDigest(SELECTORS, EXCLUDE, MIN_TEXT_LENGTH);

                // Handle extraction errors
                if (textData.error) {
                    let msg;
                    switch (textData.error) {
                        case 'selection_too_short':
                            msg = `Selected text is too short (${textData.actualLength} chars). Minimum is ${textData.minLength} chars.`;
                            break;
                        case 'article_too_short':
                            msg = `Article text is too short (${textData.actualLength} chars). Minimum is ${textData.minLength} chars.\nTry selecting text manually or adjust the minimum length in settings.`;
                            break;
                        case 'no_container':
                            msg = 'No article container found. Try selecting text manually or add a custom selector for this site.';
                            break;
                        case 'no_text':
                            msg = 'Container found but no text inside. Try selecting text manually.';
                            break;
                        default:
                            msg = 'No text found to summarize. Try selecting text or visit an article page.';
                    }
                    openInfo(msg);
                    updateOverlayStatus('ready');
                    return;
                }

                const { text, source, container } = textData;

                log(`Digesting ${text.length} chars from ${source}`);

                const prompt = CUSTOM_PROMPTS[mode] || DEFAULT_PROMPTS[mode];

                const result = await digestText(
                    storage,
                    text,
                    mode,
                    prompt,
                    SIMPLIFICATION_LEVEL,
                    (t, m) => cache.get(t, m),
                    (t, m, r) => cache.set(t, m, r),
                    (msg) => openKeyDialog(storage, msg, apiKeyDialogShown)
                );

                updateOverlayStatus('digested', mode);
                showSummaryOverlay(result, mode, container, OVERLAY_COLLAPSED, storage);

            } catch (err) {
                console.error('Digest error:', err);
                friendlyApiError(err, (msg) => openKeyDialog(storage, msg, apiKeyDialogShown), openInfo);
                updateOverlayStatus('ready');
            }
        }

        // Inspection mode handler
        function handleInspection() {
            exitSummaryHighlight();
            enterInspectionMode({
                SELECTORS, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN,
                EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE,
                storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo
            });
        }

        // Summary highlight handler
        function handleSummaryHighlight() {
            showSummaryHighlight(SELECTORS, EXCLUDE, MIN_TEXT_LENGTH);
        }

        // Settings functions
        async function setSimplification(level) {
            if (!SIMPLIFICATION_LEVELS.includes(level)) return;
            SIMPLIFICATION_LEVEL = level;
            await storage.set(STORAGE_KEYS.SIMPLIFICATION_STRENGTH, level);
            await cache.clear();
            location.reload();
        }

        async function setModel(modelId) {
            if (!MODEL_OPTIONS[modelId]) return;
            CFG.model = modelId;
            PRICING.model = modelId;
            PRICING.inputPer1M = MODEL_OPTIONS[modelId].inputPer1M;
            PRICING.outputPer1M = MODEL_OPTIONS[modelId].outputPer1M;
            await storage.set(STORAGE_KEYS.MODEL, modelId);
            await storage.set(STORAGE_KEYS.PRICING, JSON.stringify(PRICING));
        }

        async function setCustomPrompts(prompts) {
            CUSTOM_PROMPTS = prompts;
            await storage.set(STORAGE_KEYS.CUSTOM_PROMPT, JSON.stringify(prompts));
            await cache.clear();
        }

        async function setAutoSimplify(on) {
            AUTO_SIMPLIFY = !!on;
            await storage.set(STORAGE_KEYS.AUTO_SIMPLIFY, String(AUTO_SIMPLIFY));
            location.reload();
        }

        // Menu commands
        registerMenuCommand('--- Configuration ---', () => {});

        registerMenuCommand('Set / Validate OpenAI API key', () => {
            openApiKeyEditor(storage);
        });

        registerMenuCommand(`Select AI Model (${MODEL_OPTIONS[CFG.model]?.name || CFG.model})`, () => {
            openModelSelectionDialog(storage, CFG.model, setModel);
        });

        registerMenuCommand(`Simplification style (${SIMPLIFICATION_LEVEL})`, () => {
            openSimplificationStyleDialog(storage, SIMPLIFICATION_LEVEL, setSimplification);
        });

        registerMenuCommand('Custom prompts', () => {
            openCustomPromptDialog(storage, CUSTOM_PROMPTS, setCustomPrompts);
        });

        registerMenuCommand(`Minimum text length (${MIN_TEXT_LENGTH} chars)`, () => {
            const input = prompt(`Minimum text length for extraction (current: ${MIN_TEXT_LENGTH} chars):`, MIN_TEXT_LENGTH);
            if (input === null) return;
            const val = parseInt(input, 10);
            if (isNaN(val) || val < 0) {
                openInfo('Invalid value. Please enter a non-negative number.');
                return;
            }
            storage.set(STORAGE_KEYS.MIN_TEXT_LENGTH, String(val)).then(() => {
                MIN_TEXT_LENGTH = val;
                openInfo(`Minimum text length set to ${val} characters.`);
            });
        });

        // Selector configuration
        function handleEditSelectors() {
            exitSummaryHighlight();
            openSelectorEditor({
                host: HOST,
                selectorsGlobal: SELECTORS_GLOBAL,
                excludeGlobal: EXCLUDE_GLOBAL,
                selectorsDomain: SELECTORS_DOMAIN,
                excludeDomain: EXCLUDE_DOMAIN,
                defaultSelectors: DEFAULT_SELECTORS,
                defaultExcludes: DEFAULT_EXCLUDES,
                onSave: async (data) => {
                    // Global
                    SELECTORS_GLOBAL = data.global.selectors.length ? data.global.selectors : [...DEFAULT_SELECTORS];
                    EXCLUDE_GLOBAL.self = data.global.excludeSelf;
                    EXCLUDE_GLOBAL.ancestors = data.global.excludeAncestors;
                    await storage.set(STORAGE_KEYS.SELECTORS_GLOBAL, JSON.stringify(SELECTORS_GLOBAL));
                    await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));

                    // Domain
                    DOMAIN_SELECTORS[HOST] = data.domain.selectors;
                    if (!DOMAIN_EXCLUDES[HOST]) DOMAIN_EXCLUDES[HOST] = { self: [], ancestors: [] };
                    DOMAIN_EXCLUDES[HOST].self = data.domain.excludeSelf;
                    DOMAIN_EXCLUDES[HOST].ancestors = data.domain.excludeAncestors;
                    await storage.set(STORAGE_KEYS.DOMAIN_SELECTORS, JSON.stringify(DOMAIN_SELECTORS));
                    await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                }
            });
        }

        registerMenuCommand('Edit Selectors', handleEditSelectors);

        // Toggles
        registerMenuCommand('--- Toggles ---', () => {});

        registerMenuCommand(`Toggle DEBUG logs (${CFG.DEBUG ? 'ON' : 'OFF'})`, async () => {
            CFG.DEBUG = !CFG.DEBUG;
            await storage.set(STORAGE_KEYS.DEBUG, String(CFG.DEBUG));
            location.reload();
        });

        registerMenuCommand(`Toggle auto-simplify (${AUTO_SIMPLIFY ? 'ON' : 'OFF'})`, async () => {
            await setAutoSimplify(!AUTO_SIMPLIFY);
        });

        // Actions
        registerMenuCommand('--- Actions ---', () => {});

        registerMenuCommand('Show usage statistics', async () => {
            showStats(await cache.getSize());
        });

        registerMenuCommand('Flush cache & reload', async () => {
            await cache.clear();
            location.reload();
        });

        registerMenuCommand('Reset API usage stats', async () => {
            await resetApiTokens(storage);
            openInfo('API usage stats reset. Token counters and cost tracking cleared.');
        });

        registerMenuCommand('Inspect element', handleInspection);

        registerMenuCommand('Included in summary', () => {
            showSummaryHighlight(SELECTORS, EXCLUDE, MIN_TEXT_LENGTH);
        });

        // Bootstrap
        const isFirstInstall = firstInstallRaw === '';
        const hasApiKey = apiKeyRaw !== '';

        if (isFirstInstall) {
            log('First install detected');
            if (DOMAINS_MODE === 'deny') {
                await storage.set(STORAGE_KEYS.DOMAINS_MODE, 'allow');
                DOMAINS_MODE = 'allow';
                log('Set domain mode to allowlist (disabled by default)');
            }

            setTimeout(() => {
                openWelcomeDialog(storage);
            }, 500);
            return;
        }

        if (!hasApiKey) {
            log('No API key configured. Script inactive. Set API key via menu.');
            return;
        }

        if (DOMAIN_DISABLED) {
            log('Domain disabled, skipping overlay:', HOST);
            return;
        }

        // If domain was just enabled, force overlay open and clear the flag
        if (justEnabledRaw === 'true') {
            OVERLAY_COLLAPSED.value = false;
            await storage.set(STORAGE_KEYS.OVERLAY_COLLAPSED, 'false');
            await storage.set(STORAGE_KEYS.JUST_ENABLED, '');
        }

        // Create overlay
        createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, handleDigest, handleInspection, handleSummaryHighlight, handleEditSelectors);

        // Notify users whose saved model was removed from MODEL_OPTIONS. Persisting
        // the fallback via setModel makes this a one-time notice.
        if (MODEL_FALLBACK) {
            await setModel(CFG.model);
            showToast(
                `Your selected AI model (${MODEL_FALLBACK}) is no longer offered. Switched to ${MODEL_OPTIONS[CFG.model].name}.`,
                {
                    actionLabel: 'Model settings',
                    onAction: () => openModelSelectionDialog(storage, CFG.model, setModel)
                }
            );
        }

        // Auto-simplify if enabled
        if (AUTO_SIMPLIFY) {
            setTimeout(() => {
                const textData = getTextToDigest(SELECTORS, EXCLUDE, MIN_TEXT_LENGTH);
                if (!textData.error && textData.source === 'article') {
                    log('Auto-simplify enabled, applying large summary...');
                    handleDigest('large');
                }
            }, 1000);
        }

        // Observe DOM changes to ensure overlay persists
        const mo = new MutationObserver(() => {
            ensureOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, handleDigest, handleInspection, handleSummaryHighlight, handleEditSelectors);
        });
        mo.observe(document.body, { childList: true, subtree: false });

        log('Script initialized for', HOST);
    })();

})();
