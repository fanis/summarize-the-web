// ==UserScript==
// @name         Summarize The Web
// @namespace    https://fanis.dev/userscripts
// @author       Modified from Neutralize Headlines by Fanis Hatzidakis
// @license      PolyForm-Internal-Use-1.0.0; https://polyformproject.org/licenses/internal-use/1.0.0/
// @version      1.0.0
// @description  Summarize and simplify web articles using OpenAI API with customizable digest sizes
// @match        *://*/*
// @exclude      about:*
// @exclude      moz-extension:*
// @run-at       document-end
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_deleteValue
// @grant        GM.deleteValue
// @grant        GM_registerMenuCommand
// @connect      api.openai.com
// ==/UserScript==

// SPDX-License-Identifier: PolyForm-Internal-Use-1.0.0

(async () => {
    'use strict';

    // ───────────────────────── CONFIG ─────────────────────────
    const CFG = {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        DEBUG: false,
    };

    const UI_ATTR = 'data-digest-ui';
    const HOST = location.hostname;

    const LOG_PREFIX = '[web-digest]';
    function log(...args) { if (!CFG.DEBUG) return; console.log(LOG_PREFIX, ...args); }

    // API token usage tracking
    let API_TOKENS = {
        digest: { input: 0, output: 0, calls: 0 }
    };

    // API Pricing configuration
    let PRICING = {
        model: 'gpt-4o-mini',
        inputPer1M: 0.15,
        outputPer1M: 0.60,
        lastUpdated: '2025-01-25',
        source: 'https://openai.com/api/pricing/'
    };

    // ───────────────────────── STORAGE ─────────────────────────
    const MEM = new Map();
    const LS_KEY_NS = '__webdigest__';

    const storage = {
        async get(key, def = '') {
            try { if (typeof GM?.getValue === 'function') { const v = await GM.getValue(key); if (v != null) return v; } } catch {}
            try { if (typeof GM_getValue === 'function') { const v = GM_getValue(key); if (v != null) return v; } } catch {}
            try { const bag = JSON.parse(localStorage.getItem(LS_KEY_NS) || '{}'); if (key in bag) return bag[key]; } catch {}
            if (MEM.has(key)) return MEM.get(key);
            return def;
        },
        async set(key, val) {
            let ok = false;
            try { if (typeof GM?.setValue === 'function') { await GM.setValue(key, val); ok = true; } } catch {}
            if (!ok) { try { if (typeof GM_setValue === 'function') { GM_setValue(key, val); ok = true; } } catch {} }
            if (!ok) { try { const bag = JSON.parse(localStorage.getItem(LS_KEY_NS) || '{}'); bag[key] = val; localStorage.setItem(LS_KEY_NS, JSON.stringify(bag)); ok = true; } catch {} }
            if (!ok) MEM.set(key, val);
            return ok;
        },
        async del(key) {
            let ok = false;
            try { if (typeof GM?.deleteValue === 'function') { await GM.deleteValue(key); ok = true; } } catch {}
            try { if (typeof GM_deleteValue === 'function') { GM_deleteValue(key); ok = true; } } catch {}
            try { const bag = JSON.parse(localStorage.getItem(LS_KEY_NS) || '{}'); if (key in bag) { delete bag[key]; localStorage.setItem(LS_KEY_NS, JSON.stringify(bag)); ok = true; } } catch {}
            MEM.delete(key);
            return ok;
        },
    };

    // ───────────────────────── PERSISTED SETTINGS ─────────────────────────
    const DOMAINS_MODE_KEY = 'digest_domains_mode_v1';
    const DOMAINS_DENY_KEY = 'digest_domains_excluded_v1';
    const DOMAINS_ALLOW_KEY = 'digest_domains_enabled_v1';
    const DEBUG_KEY = 'digest_debug_v1';
    const SIMPLIFICATION_STRENGTH_KEY = 'digest_simplification_v1';
    const AUTO_SIMPLIFY_KEY = 'digest_auto_simplify_v1';
    const CUSTOM_PROMPT_KEY = 'digest_custom_prompt_v1';
    const OVERLAY_POS_KEY = 'digest_overlay_pos_v1';
    const OVERLAY_COLLAPSED_KEY = 'digest_overlay_collapsed_v1';
    const FIRST_INSTALL_KEY = 'digest_installed_v1';
    const API_TOKENS_KEY = 'digest_api_tokens_v1';
    const PRICING_KEY = 'digest_pricing_v1';
    const CACHE_KEY = 'digest_cache_v1';

    // Default prompts
    const DEFAULT_PROMPTS = {
        summary_large: 'You will receive INPUT as article text. Summarize and simplify the content to approximately 50% of the original length. Make the language clearer and more direct while staying in the SAME language as input. CRITICAL: Do NOT change facts, numbers, names, quotes, or the actual meaning/details of the content. If the text contains direct quotes inside quotation marks, keep that quoted text VERBATIM. Preserve all factual information, statistics, proper nouns, and direct quotes exactly as they appear. Maintain paragraph structure where appropriate. Return ONLY the simplified text without any formatting, code blocks, or JSON.',
        summary_small: 'You will receive INPUT as article text. Create a concise summary at approximately 20% of the original length while staying in the SAME language as input. Focus on the most important points and key facts. CRITICAL: Do NOT change facts, numbers, names, or core meaning. Preserve important quotes, statistics, and proper nouns exactly as they appear. Condense the content aggressively to achieve the 20% length target while maintaining readability. Return ONLY the summary text without any formatting, code blocks, or JSON.'
    };

    // Simplification style levels (controls how aggressively language is simplified)
    const SIMPLIFICATION_LEVELS = {
        'Conservative': 0.1,
        'Balanced': 0.2,
        'Aggressive': 0.4
    };
    const SIMPLIFICATION_ORDER = ['Conservative', 'Balanced', 'Aggressive'];
    let SIMPLIFICATION_LEVEL = 'Balanced';
    let SIMPLIFICATION_TEMPERATURE = SIMPLIFICATION_LEVELS['Balanced'];

    // Load settings
    try { const v = await storage.get(DEBUG_KEY, ''); if (v !== '') CFG.DEBUG = (v === true || v === 'true'); } catch {}

    let AUTO_SIMPLIFY = false;
    try { const v = await storage.get(AUTO_SIMPLIFY_KEY, ''); if (v !== '') AUTO_SIMPLIFY = (v === true || v === 'true'); } catch {}

    let CUSTOM_PROMPTS = { ...DEFAULT_PROMPTS };
    try {
        const v = await storage.get(CUSTOM_PROMPT_KEY, '');
        if (v) CUSTOM_PROMPTS = JSON.parse(v);
    } catch {}

    let OVERLAY_POS = { x: window.innerWidth - 170, y: window.innerHeight / 2 - 100 };
    try {
        const v = await storage.get(OVERLAY_POS_KEY, '');
        if (v) OVERLAY_POS = JSON.parse(v);
    } catch {}

    let OVERLAY_COLLAPSED = false;
    try {
        const v = await storage.get(OVERLAY_COLLAPSED_KEY, '');
        if (v !== '') OVERLAY_COLLAPSED = (v === true || v === 'true');
    } catch {}

    try {
        const v = await storage.get(SIMPLIFICATION_STRENGTH_KEY, '');
        if (v !== '' && SIMPLIFICATION_LEVELS[v] !== undefined) {
            SIMPLIFICATION_LEVEL = v;
            SIMPLIFICATION_TEMPERATURE = SIMPLIFICATION_LEVELS[v];
        }
    } catch {}

    // Domain mode + lists
    let DOMAINS_MODE = 'deny';
    let DOMAIN_DENY = [];
    let DOMAIN_ALLOW = [];

    try { DOMAINS_MODE = await storage.get(DOMAINS_MODE_KEY, 'deny'); } catch {}
    try { DOMAIN_DENY = JSON.parse(await storage.get(DOMAINS_DENY_KEY, JSON.stringify(DOMAIN_DENY))); } catch {}
    try { DOMAIN_ALLOW = JSON.parse(await storage.get(DOMAINS_ALLOW_KEY, JSON.stringify(DOMAIN_ALLOW))); } catch {}

    // Cache
    let CACHE = {};
    try { CACHE = JSON.parse(await storage.get(CACHE_KEY, '{}')); } catch {}
    let cacheDirty = false;

    const CACHE_LIMIT = 50;
    const CACHE_TRIM_TO = 30;

    try {
        const stored = await storage.get(API_TOKENS_KEY, '');
        if (stored) API_TOKENS = JSON.parse(stored);
    } catch {}

    try {
        const stored = await storage.get(PRICING_KEY, '');
        if (stored) PRICING = JSON.parse(stored);
    } catch {}

    // ───────────────────────── DOMAIN MATCHING ─────────────────────────
    function globToRegExp(glob) {
        const esc = s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const g = esc(glob).replace(/\\\*/g,'.*').replace(/\\\?/g,'.');
        return new RegExp(`^${g}$`, 'i');
    }

    function domainPatternToRegex(p) {
        p = p.trim();
        if (!p) return null;
        if (p.startsWith('/') && p.endsWith('/')) {
            try { return new RegExp(p.slice(1,-1), 'i'); } catch { return null; }
        }
        if (p.includes('*') || p.includes('?')) return globToRegExp(p.replace(/^\.*\*?\./,'*.'));
        const esc = p.replace(/[.+^${}()|[\]\\]/g,'\\$&');
        return new RegExp(`(^|\\.)${esc}$`, 'i');
    }

    function listMatchesHost(list, host) {
        for (const pat of list) { const rx = domainPatternToRegex(pat); if (rx && rx.test(host)) return true; }
        return false;
    }

    function computeDomainDisabled(host) {
        if (DOMAINS_MODE === 'allow') return !listMatchesHost(DOMAIN_ALLOW, host);
        return listMatchesHost(DOMAIN_DENY, host);
    }

    let DOMAIN_DISABLED = computeDomainDisabled(HOST);
    if (DOMAIN_DISABLED) log('domain disabled:', HOST, 'mode=', DOMAINS_MODE);

    // ───────────────────────── CACHE MANAGEMENT ─────────────────────────
    function cacheKey(text, mode) {
        return `${mode}:${text}`;
    }

    function cacheGet(text, mode) {
        const key = cacheKey(text, mode);
        return CACHE[key];
    }

    async function cacheSet(text, mode, result) {
        const key = cacheKey(text, mode);
        CACHE[key] = { result, timestamp: Date.now() };
        cacheDirty = true;

        // Trim cache if needed
        const keys = Object.keys(CACHE);
        if (keys.length > CACHE_LIMIT) {
            const sorted = keys
                .map(k => ({ key: k, time: CACHE[k].timestamp || 0 }))
                .sort((a, b) => b.time - a.time);
            const keep = sorted.slice(0, CACHE_TRIM_TO).map(x => x.key);
            const newCache = {};
            keep.forEach(k => { newCache[k] = CACHE[k]; });
            CACHE = newCache;
        }

        await saveCache();
    }

    async function cacheClear() {
        CACHE = {};
        await storage.del(CACHE_KEY);
        log('cache cleared');
    }

    async function saveCache() {
        if (!cacheDirty) return;
        cacheDirty = false;
        await storage.set(CACHE_KEY, JSON.stringify(CACHE));
    }

    setInterval(saveCache, 5000);

    // ───────────────────────── API FUNCTIONS ─────────────────────────
    function apiHeaders(key) {
        return {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };
    }

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
        if (Array.isArray(data.choices)) return data.choices.map((ch)=>ch.message?.content||'').join('\n');
        return '';
    }

    function updateApiTokens(type, usage) {
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

        clearTimeout(updateApiTokens._timer);
        updateApiTokens._timer = setTimeout(() => {
            storage.set(API_TOKENS_KEY, JSON.stringify(API_TOKENS));
            log('API tokens updated and saved:', API_TOKENS);
        }, 1000);
    }

    async function resetApiTokens() {
        API_TOKENS = {
            digest: { input: 0, output: 0, calls: 0 }
        };
        await storage.set(API_TOKENS_KEY, JSON.stringify(API_TOKENS));
        log('API token stats reset');
    }

    function calculateApiCost() {
        const inputCost = API_TOKENS.digest.input * PRICING.inputPer1M / 1_000_000;
        const outputCost = API_TOKENS.digest.output * PRICING.outputPer1M / 1_000_000;
        return inputCost + outputCost;
    }

    async function digestText(text, mode) {
        const KEY = await storage.get('OPENAI_KEY', '');
        if (!KEY) {
            openKeyDialog('OpenAI API key missing.');
            throw Object.assign(new Error('API key missing'), {status:401});
        }

        // Check cache first
        const cached = cacheGet(text, mode);
        if (cached) {
            log(`Using cached digest for ${mode} mode`);
            return cached.result;
        }

        const safeInput = text.replace(/[\u2028\u2029]/g, ' ');
        const prompt = CUSTOM_PROMPTS[mode] || DEFAULT_PROMPTS[mode];

        const body = JSON.stringify({
            model: CFG.model,
            temperature: SIMPLIFICATION_TEMPERATURE,
            max_output_tokens: mode.includes('small') ? 2000 : 4000,
            instructions: prompt,
            input: safeInput
        });

        const resText = await xhrPost('https://api.openai.com/v1/responses', body, apiHeaders(KEY));
        const payload = JSON.parse(resText);

        if (payload.usage) {
            updateApiTokens('digest', payload.usage);
        }

        const outStr = extractOutputText(payload);
        if (!outStr) throw Object.assign(new Error('No output from API'), {status:400});

        // Strip markdown code fences if present
        const cleaned = outStr.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

        // Try to parse as JSON (API might return array or plain text)
        let result;
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                // If it's an array, join the elements
                result = parsed.join('\n\n');
            } else if (typeof parsed === 'string') {
                result = parsed;
            } else {
                // Fallback to cleaned text
                result = cleaned;
            }
        } catch (e) {
            // Not JSON, use as-is
            result = cleaned;
        }

        await cacheSet(text, mode, result);
        return result;
    }

    function friendlyApiError(err) {
        const s = err?.status || 0;
        if (s === 401) { openKeyDialog('Unauthorized (401). Please enter a valid OpenAI key.'); return; }
        if (s === 429) { openInfo('Rate limited by API (429). Try again in a minute.'); return; }
        if (s === 400) { openInfo('Bad request (400). The API could not parse the text. Try selecting less text.'); return; }
        openInfo(`Unknown error${s ? ' ('+s+')' : ''}. Check your network or try again.`);
    }

    // ───────────────────────── TEXT EXTRACTION ─────────────────────────
    function getSelectedText() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text && text.length > 100) {
            return text;
        }
        return null;
    }

    function extractArticleBody() {
        const strategies = [
            () => document.querySelector('[itemprop="articleBody"]'),
            () => document.querySelector('article[itemtype*="Article"]'),
            () => document.querySelector('.article-body'),
            () => document.querySelector('.post-content'),
            () => document.querySelector('.entry-content'),
            () => document.querySelector('[class*="article-content"]'),
            () => document.querySelector('[class*="post-body"]'),
            () => document.querySelector('article'),
            () => document.querySelector('main'),
            () => document.querySelector('[role="main"]')
        ];

        let container = null;
        for (const strategy of strategies) {
            container = strategy();
            if (container) break;
        }

        if (!container) return null;

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

        // Extract text-containing elements (p, li, blockquote, figcaption, etc.)
        const textSelectors = 'p, li, blockquote, figcaption, dd, dt';
        const elements = Array.from(container.querySelectorAll(textSelectors));

        const filtered = elements.filter(el => {
            const text = el.textContent.trim();

            // Filter by length
            if (text.length < 40) return false;

            // Exclude UI elements
            if (el.closest(`[${UI_ATTR}]`)) return false;
            if (el.closest('.comment, .comments, .sidebar, .navigation, .menu, .footer, .header, nav, aside')) return false;

            // Exclude if nested inside another text element we're already capturing
            const parent = el.parentElement;
            if (parent && parent.closest(textSelectors) && elements.includes(parent.closest(textSelectors))) {
                return false;
            }

            return true;
        });

        if (filtered.length === 0) return null;

        return {
            text: filtered.map(el => el.textContent.trim()).join('\n\n'),
            elements: filtered,
            container: container,
            title: title
        };
    }

    function getTextToDigest() {
        // First check if user has selected text
        const selected = getSelectedText();
        if (selected) {
            return { text: selected, elements: null, source: 'selection' };
        }

        // Otherwise extract article body
        const article = extractArticleBody();
        if (article) {
            return { text: article.text, elements: article.elements, source: 'article' };
        }

        return null;
    }

    // ───────────────────────── ARTICLE STATE ─────────────────────────
    let articleState = {
        original: null,
        digested: null,
        mode: null,          // 'summary_large' or 'summary_small'
        elements: null,
        source: null,
        container: null,
        title: null
    };

    async function applySummaryDigest(size) {
        try {
            const textData = getTextToDigest();
            if (!textData) {
                openInfo('No text found to digest. Try selecting text or visit an article page.');
                return;
            }

            const mode = `summary_${size}`;

            // Check if cached before updating status
            const cached = cacheGet(textData.text, mode);
            if (cached) {
                log(`Cache HIT for ${mode} - using cached result`);
                updateOverlayStatus('processing', mode, true);
            } else {
                log(`Cache MISS for ${mode} - will call API`);
                updateOverlayStatus('processing', mode);
            }

            const result = await digestText(textData.text, mode);

            articleState = {
                original: textData.text,
                digested: result,
                mode: mode,
                elements: textData.elements,
                source: textData.source,
                container: textData.container,
                title: textData.title
            };

            showSummaryOverlay(result, mode, textData.container);

            updateOverlayStatus('digested', mode);
            log(`Applied ${mode} digest`);
        } catch (err) {
            log('Summary digest error:', err);
            friendlyApiError(err);
            updateOverlayStatus('ready');
        }
    }

    function restoreOriginal() {
        // Remove summary overlay if it exists
        removeSummaryOverlay();

        articleState = { original: null, digested: null, mode: null, elements: null, source: null, container: null, title: null };
        updateOverlayStatus('ready');
        log('Restored original state');
    }

    // ───────────────────────── SUMMARY OVERLAY ─────────────────────────
    let summaryOverlay = null;

    // Track if we auto-collapsed the overlay so we can restore it
    let autoCollapsedOverlay = false;

    function showSummaryOverlay(summaryText, mode, container) {
        // Remove existing summary overlay if any
        removeSummaryOverlay();

        // Auto-collapse actions overlay on mobile to prevent overlap
        if (overlay && !OVERLAY_COLLAPSED) {
            autoCollapsedOverlay = true;
            collapseOverlay();
        }

        summaryOverlay = document.createElement('div');
        summaryOverlay.className = 'digest-summary-overlay';
        summaryOverlay.setAttribute(UI_ATTR, '');

        const sizeLabel = mode.includes('large') ? 'Large' : 'Small';
        const isSelectedText = !container; // null container means selected text

        // Escape HTML to prevent XSS
        const escapeHTML = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        // Different footer for selected text vs article
        const footerButtons = isSelectedText
            ? `<button class="digest-summary-close-btn">Close</button>`
            : `<button class="digest-summary-restore">Restore Original Article</button>`;

        summaryOverlay.innerHTML = `
      <div class="digest-summary-container">
        <div class="digest-summary-header">
          <div class="digest-summary-badge">📄 ${escapeHTML(sizeLabel)} Summary${isSelectedText ? ' (Selected Text)' : ''}</div>
          <button class="digest-summary-close" title="Close">✕</button>
        </div>
        <div class="digest-summary-content">
          ${summaryText.split('\n\n').map(p => `<p>${escapeHTML(p)}</p>`).join('')}
        </div>
        <div class="digest-summary-footer">
          <div class="digest-summary-footer-text">Summarize The Web</div>
          ${footerButtons}
        </div>
      </div>
    `;

        // Append to body (fixed positioning handles placement)
        document.body.appendChild(summaryOverlay);

        // Attach event listeners
        const closeBtn = summaryOverlay.querySelector('.digest-summary-close');
        const closeBtnFooter = summaryOverlay.querySelector('.digest-summary-close-btn');
        const restoreBtn = summaryOverlay.querySelector('.digest-summary-restore');

        if (isSelectedText) {
            // For selected text: just close button
            closeBtn.addEventListener('click', removeSummaryOverlay);
            closeBtnFooter.addEventListener('click', removeSummaryOverlay);
        } else {
            // For article: restore button
            closeBtn.addEventListener('click', restoreOriginal);
            restoreBtn.addEventListener('click', restoreOriginal);
        }

        // Click outside to close
        summaryOverlay.addEventListener('click', (e) => {
            if (e.target === summaryOverlay) {
                if (isSelectedText) {
                    removeSummaryOverlay();
                } else {
                    restoreOriginal();
                }
            }
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                if (isSelectedText) {
                    removeSummaryOverlay();
                } else {
                    restoreOriginal();
                }
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function removeSummaryOverlay() {
        if (summaryOverlay && summaryOverlay.isConnected) {
            summaryOverlay.remove();
        }
        summaryOverlay = null;

        // Restore actions overlay if we auto-collapsed it
        if (autoCollapsedOverlay) {
            autoCollapsedOverlay = false;
            expandOverlay();
        }
    }

    // ───────────────────────── OVERLAY UI ─────────────────────────
    let overlay = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    function ensureCSS() {
        if (document.getElementById('digest-style')) return;
        const style = document.createElement('style');
        style.id = 'digest-style';
        style.textContent = `
      .digest-overlay {
        position: fixed !important;
        z-index: 2147483646 !important;
        font: 13px/1.4 system-ui, sans-serif !important;
        color: #1a1a1a !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        border: 2px solid #5568d3 !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,.3) !important;
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        width: 150px !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        user-select: none !important;
      }
      .digest-overlay.collapsed {
        right: -150px !important;
        border-right: none !important;
        border-radius: 12px 0 0 12px !important;
        box-shadow: none !important;
      }
      .digest-overlay.dragging {
        transition: none !important;
        cursor: grabbing !important;
      }
      .digest-slide-handle {
        position: absolute !important;
        left: -28px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        width: 28px !important;
        height: 56px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        border: 2px solid #5568d3 !important;
        border-right: none !important;
        border-radius: 8px 0 0 8px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        color: #fff !important;
        box-shadow: -3px 0 12px rgba(0,0,0,.2) !important;
        transition: all 0.2s ease !important;
      }
      .digest-slide-handle:hover {
        left: -30px !important;
        box-shadow: -4px 0 16px rgba(0,0,0,.3) !important;
      }
      .digest-handle {
        background: rgba(255,255,255,0.2) !important;
        padding: 10px 12px !important;
        cursor: grab !important;
        border-radius: 10px 10px 0 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-bottom: 1px solid rgba(255,255,255,0.3) !important;
      }
      .digest-handle:active {
        cursor: grabbing !important;
      }
      .digest-title {
        font-weight: 600 !important;
        font-size: 14px !important;
        color: #fff !important;
        margin: 0 !important;
        text-align: center !important;
      }
      .digest-content {
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        background: rgba(255,255,255,0.95) !important;
        border-radius: 0 0 0 10px !important;
      }
      .digest-section {
        margin: 0 !important;
        padding: 0 !important;
      }
      .digest-section-title {
        font-size: 11px !important;
        font-weight: 600 !important;
        color: #667eea !important;
        margin: 0 0 6px 0 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      .digest-buttons {
        display: flex !important;
        gap: 6px !important;
        flex-wrap: wrap !important;
      }
      .digest-btn {
        flex: 1 !important;
        min-width: 0 !important;
        padding: 8px 4px !important;
        border: 1px solid #667eea !important;
        background: #fff !important;
        color: #667eea !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        transition: all 0.2s !important;
        white-space: nowrap !important;
      }
      .digest-btn:hover {
        background: #667eea !important;
        color: #fff !important;
      }
      .digest-btn:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
      .digest-btn.active {
        background: #667eea !important;
        color: #fff !important;
        font-weight: 600 !important;
      }
      .digest-restore-btn {
        width: 100% !important;
        background: #764ba2 !important;
        color: #fff !important;
        border-color: #764ba2 !important;
      }
      .digest-restore-btn:hover {
        background: #5a3780 !important;
      }
      .digest-status {
        font-size: 10px !important;
        color: #666 !important;
        text-align: center !important;
        padding: 4px !important;
        margin: 0 !important;
      }
      .digest-branding {
        font-size: 8px !important;
        color: rgba(255,255,255,0.6) !important;
        text-align: center !important;
        padding: 2px 0 0 0 !important;
        margin: 0 !important;
        letter-spacing: 0.3px !important;
      }

      /* Summary Overlay Styles */
      .digest-summary-overlay {
        position: fixed !important;
        top: 12px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483645 !important;
        background: linear-gradient(135deg, #f8f9ff 0%, #fff5f7 100%) !important;
        border: 3px solid #667eea !important;
        border-radius: 16px !important;
        width: 96% !important;
        max-width: 1200px !important;
        max-height: 90vh !important;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.35), 0 0 0 9999px rgba(0, 0, 0, 0.4) !important;
        animation: digest-summary-fadein 0.3s ease !important;
      }

      @keyframes digest-summary-fadein {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .digest-summary-container {
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      .digest-summary-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        padding: 16px 20px !important;
        border-radius: 13px 13px 0 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }

      .digest-summary-badge {
        font: 600 16px/1.2 system-ui, sans-serif !important;
        color: #fff !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .digest-summary-close {
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: #fff !important;
        font-size: 20px !important;
        font-weight: 600 !important;
        width: 32px !important;
        height: 32px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s !important;
        padding: 0 !important;
        line-height: 1 !important;
      }

      .digest-summary-close:hover {
        background: rgba(255, 255, 255, 0.3) !important;
        transform: scale(1.05) !important;
      }

      .digest-summary-content {
        padding: 20px 24px !important;
        font: 16px/1.7 system-ui, -apple-system, sans-serif !important;
        color: #2d3748 !important;
        max-height: calc(90vh - 180px) !important;
        overflow-y: auto !important;
      }

      .digest-summary-content p {
        margin: 0 0 16px 0 !important;
        text-align: left !important;
      }

      .digest-summary-content p:last-child {
        margin-bottom: 0 !important;
      }

      .digest-summary-footer {
        padding: 16px 20px !important;
        background: rgba(102, 126, 234, 0.05) !important;
        border-top: 1px solid rgba(102, 126, 234, 0.15) !important;
        border-radius: 0 0 13px 13px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .digest-summary-footer-text {
        font: 400 11px/1.2 system-ui, sans-serif !important;
        color: #999 !important;
        letter-spacing: 0.3px !important;
      }

      .digest-summary-restore {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: #fff !important;
        border: none !important;
        padding: 12px 32px !important;
        border-radius: 8px !important;
        font: 600 14px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
      }

      .digest-summary-restore:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
      }

      .digest-summary-restore:active {
        transform: translateY(0) !important;
      }

      .digest-summary-close-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: #fff !important;
        border: none !important;
        padding: 12px 32px !important;
        border-radius: 8px !important;
        font: 600 14px/1.2 system-ui, sans-serif !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
      }

      .digest-summary-close-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
      }

      .digest-summary-close-btn:active {
        transform: translateY(0) !important;
      }
    `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        if (overlay && overlay.isConnected) return;

        ensureCSS();

        overlay = document.createElement('div');
        overlay.className = OVERLAY_COLLAPSED ? 'digest-overlay collapsed' : 'digest-overlay';
        overlay.setAttribute(UI_ATTR, '');

        // Set initial position
        const maxX = window.innerWidth - 170;
        const maxY = window.innerHeight - 200;
        OVERLAY_POS.x = Math.max(0, Math.min(OVERLAY_POS.x, maxX));
        OVERLAY_POS.y = Math.max(0, Math.min(OVERLAY_POS.y, maxY));

        // Always set top position
        overlay.style.top = `${OVERLAY_POS.y}px`;

        // Only set left position if not collapsed
        if (!OVERLAY_COLLAPSED) {
            overlay.style.left = `${OVERLAY_POS.x}px`;
        }

        overlay.innerHTML = `
      <div class="digest-slide-handle" title="${OVERLAY_COLLAPSED ? 'Open' : 'Close'}">
        ${OVERLAY_COLLAPSED ? '◀' : '▶'}
      </div>
      <div class="digest-handle">
        <div class="digest-title">Summarize</div>
        <div class="digest-branding">The Web</div>
      </div>
      <div class="digest-content">
        <div class="digest-buttons">
          <button class="digest-btn" data-size="large">Large</button>
          <button class="digest-btn" data-size="small">Small</button>
        </div>
        <button class="digest-btn digest-restore-btn">Restore</button>
        <div class="digest-status">Ready</div>
      </div>
    `;

        document.body.appendChild(overlay);

        // Attach event listeners
        const slideHandle = overlay.querySelector('.digest-slide-handle');
        const dragHandle = overlay.querySelector('.digest-handle');
        const digestBtns = overlay.querySelectorAll('.digest-btn[data-size]');
        const restoreBtn = overlay.querySelector('.digest-restore-btn');

        slideHandle.addEventListener('click', toggleSlide);
        dragHandle.addEventListener('mousedown', startDrag);

        digestBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                applySummaryDigest(size);
            });
        });

        restoreBtn.addEventListener('click', restoreOriginal);

        // Update initial state
        updateOverlayStatus('ready');
    }

    async function toggleSlide(e) {
        // Prevent event from bubbling to drag handler
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        OVERLAY_COLLAPSED = !OVERLAY_COLLAPSED;
        await storage.set(OVERLAY_COLLAPSED_KEY, String(OVERLAY_COLLAPSED));

        if (OVERLAY_COLLAPSED) {
            overlay.classList.add('collapsed');
            // Keep current Y position, clear X so it slides right
            overlay.style.left = '';
            overlay.style.right = '';
            overlay.style.transform = '';
            // Keep top at current position (don't clear it)
        } else {
            overlay.classList.remove('collapsed');
            // Expand near the right edge at current Y position
            const currentY = parseInt(overlay.style.top) || OVERLAY_POS.y;
            const rightEdgeX = window.innerWidth - 170;

            overlay.style.right = '';
            overlay.style.transform = '';
            overlay.style.left = `${rightEdgeX}px`;
            overlay.style.top = `${currentY}px`;

            // Update saved position to new location
            OVERLAY_POS = { x: rightEdgeX, y: currentY };
            storage.set(OVERLAY_POS_KEY, JSON.stringify(OVERLAY_POS));
        }

        const handle = overlay.querySelector('.digest-slide-handle');
        if (handle) {
            handle.textContent = OVERLAY_COLLAPSED ? '◀' : '▶';
            handle.title = OVERLAY_COLLAPSED ? 'Open' : 'Close';
        }
    }

    // Collapse overlay without persisting (for temporary auto-hide)
    function collapseOverlay() {
        if (!overlay || OVERLAY_COLLAPSED) return;
        OVERLAY_COLLAPSED = true;
        overlay.classList.add('collapsed');
        overlay.style.left = '';
        overlay.style.right = '';
        overlay.style.transform = '';
        const handle = overlay.querySelector('.digest-slide-handle');
        if (handle) {
            handle.textContent = '◀';
            handle.title = 'Open';
        }
    }

    // Expand overlay without persisting (to restore after auto-hide)
    function expandOverlay() {
        if (!overlay || !OVERLAY_COLLAPSED) return;
        OVERLAY_COLLAPSED = false;
        overlay.classList.remove('collapsed');
        const currentY = parseInt(overlay.style.top) || OVERLAY_POS.y;
        const rightEdgeX = window.innerWidth - 170;
        overlay.style.right = '';
        overlay.style.transform = '';
        overlay.style.left = `${rightEdgeX}px`;
        overlay.style.top = `${currentY}px`;
        OVERLAY_POS = { x: rightEdgeX, y: currentY };
        const handle = overlay.querySelector('.digest-slide-handle');
        if (handle) {
            handle.textContent = '▶';
            handle.title = 'Close';
        }
    }

    function startDrag(e) {
        // Don't drag if collapsed
        if (OVERLAY_COLLAPSED) return;

        isDragging = true;
        overlay.classList.add('dragging');

        const rect = overlay.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        e.preventDefault();
    }

    function onDrag(e) {
        if (!isDragging) return;

        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        // Constrain to viewport
        const maxX = window.innerWidth - overlay.offsetWidth;
        const maxY = window.innerHeight - overlay.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        overlay.style.left = `${newX}px`;
        overlay.style.top = `${newY}px`;

        OVERLAY_POS = { x: newX, y: newY };
    }

    function stopDrag() {
        if (!isDragging) return;

        isDragging = false;
        overlay.classList.remove('dragging');

        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);

        storage.set(OVERLAY_POS_KEY, JSON.stringify(OVERLAY_POS));
    }

    function updateOverlayStatus(status, mode = null, fromCache = false) {
        if (!overlay) return;

        const statusEl = overlay.querySelector('.digest-status');
        const digestBtns = overlay.querySelectorAll('.digest-btn[data-size]');
        const restoreBtn = overlay.querySelector('.digest-restore-btn');

        // Remove active class from all digest buttons
        digestBtns.forEach(btn => btn.classList.remove('active'));

        if (status === 'ready') {
            statusEl.textContent = 'Ready';
            digestBtns.forEach(btn => btn.disabled = false);
            restoreBtn.disabled = true;
        } else if (status === 'processing') {
            const size = mode ? mode.split('_')[1] : '';
            const sizeLabel = size === 'large' ? 'Large' : 'Small';
            statusEl.textContent = fromCache ? `Applying ${sizeLabel}...` : `Processing ${sizeLabel}...`;
            digestBtns.forEach(btn => btn.disabled = true);
            restoreBtn.disabled = true;
        } else if (status === 'digested') {
            const size = mode ? mode.split('_')[1] : '';
            const sizeLabel = size === 'large' ? 'Large' : 'Small';
            statusEl.textContent = `${sizeLabel} summary applied`;
            digestBtns.forEach(btn => btn.disabled = false);
            restoreBtn.disabled = false;

            // Highlight active button
            const activeBtn = overlay.querySelector(`[data-size="${size}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }

    // ───────────────────────── DIALOGS ─────────────────────────
    function openInfo(msg) {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
      .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
            display:flex;align-items:center;justify-content:center}
      .modal{background:#fff;max-width:420px;width:90%;border-radius:12px;
             box-shadow:0 10px 40px rgba(0,0,0,.3);padding:20px;box-sizing:border-box}
      .modal p{margin:0 0 16px;font:14px/1.5 system-ui,sans-serif;color:#333}
      .actions{display:flex;justify-content:flex-end}
      .btn{padding:10px 20px;border-radius:8px;border:none;background:#667eea;
           color:#fff;cursor:pointer;font:600 14px system-ui,sans-serif}
      .btn:hover{background:#5568d3}
    `;
        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.innerHTML = `
      <div class="modal">
        <p>${msg}</p>
        <div class="actions">
          <button class="btn">OK</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        const close = () => host.remove();
        const btn = shadow.querySelector('.btn');
        btn.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') close(); });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    }

    let apiKeyDialogShown = false;

    async function openKeyDialog(msg = 'Enter your OpenAI API key') {
        if (apiKeyDialogShown) return;
        apiKeyDialogShown = true;

        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
      .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
            display:flex;align-items:center;justify-content:center}
      .modal{background:#fff;max-width:520px;width:90%;border-radius:12px;
             box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box}
      h3{margin:0 0 12px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
      p{margin:0 0 16px;font:14px/1.5 system-ui,sans-serif;color:#666}
      .row{display:flex;gap:8px;align-items:center;margin-bottom:16px}
      input{flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;
            font:14px system-ui,sans-serif;box-sizing:border-box}
      input:focus{outline:none;border-color:#667eea}
      .toggle{padding:8px 12px;border:1px solid #e0e0e0;border-radius:8px;
              background:#f5f5f5;cursor:pointer;font-size:16px}
      .toggle:hover{background:#e8e8e8}
      .actions{display:flex;gap:8px;justify-content:flex-end}
      .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
           font:600 14px system-ui,sans-serif}
      .btn-save{background:#667eea;color:#fff}
      .btn-save:hover{background:#5568d3}
      .btn-cancel{background:#e0e0e0;color:#333}
      .btn-cancel:hover{background:#d0d0d0}
    `;

        const existing = await storage.get('OPENAI_KEY', '');

        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.innerHTML = `
      <div class="modal">
        <h3>${msg}</h3>
        <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#667eea">OpenAI Dashboard</a></p>
        <div class="row">
          <input type="password" placeholder="sk-..." value="${existing}" />
          <button class="toggle">👁</button>
        </div>
        <div class="actions">
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-save">Save</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        const input = shadow.querySelector('input');
        const toggle = shadow.querySelector('.toggle');
        const btnSave = shadow.querySelector('.btn-save');
        const btnCancel = shadow.querySelector('.btn-cancel');

        const close = () => { host.remove(); apiKeyDialogShown = false; };

        toggle.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
        });

        btnSave.addEventListener('click', async () => {
            const key = input.value.trim();
            if (!key) return;
            await storage.set('OPENAI_KEY', key);
            btnSave.textContent = 'Saved!';
            btnSave.style.background = '#34a853';
            setTimeout(close, 1000);
        });

        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
        setTimeout(() => input.focus(), 0);
    }

    function openCustomPromptDialog() {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
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

        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.innerHTML = `
      <div class="modal">
        <h3>Custom Summary Prompts</h3>
        <div class="section">
          <div class="section-label">Large Summary (50%)</div>
          <textarea id="summary-large-prompt">${CUSTOM_PROMPTS.summary_large || DEFAULT_PROMPTS.summary_large}</textarea>
          <p class="hint">Summarizes content to approximately 50% of original length</p>
        </div>
        <div class="section">
          <div class="section-label">Small Summary (20%)</div>
          <textarea id="summary-small-prompt">${CUSTOM_PROMPTS.summary_small || DEFAULT_PROMPTS.summary_small}</textarea>
          <p class="hint">Creates a concise summary at approximately 20% of original length</p>
        </div>
        <div class="actions">
          <button class="btn btn-reset">Reset to Default</button>
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-save">Save & Clear Cache</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        const summaryLarge = shadow.querySelector('#summary-large-prompt');
        const summarySmall = shadow.querySelector('#summary-small-prompt');
        const btnSave = shadow.querySelector('.btn-save');
        const btnReset = shadow.querySelector('.btn-reset');
        const btnCancel = shadow.querySelector('.btn-cancel');

        const close = () => host.remove();

        btnSave.addEventListener('click', async () => {
            CUSTOM_PROMPTS = {
                summary_large: summaryLarge.value.trim() || DEFAULT_PROMPTS.summary_large,
                summary_small: summarySmall.value.trim() || DEFAULT_PROMPTS.summary_small
            };
            await storage.set(CUSTOM_PROMPT_KEY, JSON.stringify(CUSTOM_PROMPTS));
            await cacheClear();
            btnSave.textContent = 'Saved!';
            btnSave.style.background = '#34a853';
            setTimeout(close, 1000);
        });

        btnReset.addEventListener('click', async () => {
            CUSTOM_PROMPTS = { ...DEFAULT_PROMPTS };
            await storage.set(CUSTOM_PROMPT_KEY, JSON.stringify(CUSTOM_PROMPTS));
            await cacheClear();
            summaryLarge.value = DEFAULT_PROMPTS.summary_large;
            summarySmall.value = DEFAULT_PROMPTS.summary_small;
            btnReset.textContent = 'Reset!';
            setTimeout(() => { btnReset.textContent = 'Reset to Default'; }, 1000);
        });

        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    }

    function openSimplificationStyleDialog() {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
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

        const wrap = document.createElement('div');
        wrap.className = 'wrap';

        const optionsHtml = SIMPLIFICATION_ORDER.map(level => `
      <div class="option ${level === SIMPLIFICATION_LEVEL ? 'selected' : ''}" data-level="${level}">
        <div class="option-title">${level}</div>
        <div class="option-desc">${descriptions[level]}</div>
      </div>
    `).join('');

        wrap.innerHTML = `
      <div class="modal">
        <h3>Simplification Style</h3>
        <p class="subtitle">Controls how the AI simplifies language. Large/Small buttons control the target length.</p>
        ${optionsHtml}
        <div class="actions">
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-save">Save & Clear Cache</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        let selectedLevel = SIMPLIFICATION_LEVEL;

        const options = shadow.querySelectorAll('.option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedLevel = opt.dataset.level;
            });
        });

        const btnSave = shadow.querySelector('.btn-save');
        const btnCancel = shadow.querySelector('.btn-cancel');

        const close = () => host.remove();

        btnSave.addEventListener('click', async () => {
            if (SIMPLIFICATION_LEVELS[selectedLevel] === undefined) return;
            SIMPLIFICATION_LEVEL = selectedLevel;
            SIMPLIFICATION_TEMPERATURE = SIMPLIFICATION_LEVELS[selectedLevel];
            await storage.set(SIMPLIFICATION_STRENGTH_KEY, selectedLevel);
            await cacheClear(); // Clear cache when style changes
            btnSave.textContent = 'Saved!';
            btnSave.style.background = '#34a853';
            setTimeout(close, 800);
        });

        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    }

    function openDomainEditor(mode) {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
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

        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        <textarea>${list.join('\n')}</textarea>
        <p class="hint">${hint}</p>
        <div class="actions">
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-save">Save & Reload</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        const textarea = shadow.querySelector('textarea');
        const btnSave = shadow.querySelector('.btn-save');
        const btnCancel = shadow.querySelector('.btn-cancel');

        const close = () => host.remove();

        btnSave.addEventListener('click', async () => {
            const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
            if (mode === 'allow') {
                DOMAIN_ALLOW = lines;
                await storage.set(DOMAINS_ALLOW_KEY, JSON.stringify(lines));
            } else {
                DOMAIN_DENY = lines;
                await storage.set(DOMAINS_DENY_KEY, JSON.stringify(lines));
            }
            location.reload();
        });

        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    }

    // ───────────────────────── STATS DISPLAY ─────────────────────────
    function showStats() {
        const host = document.createElement('div');
        host.setAttribute(UI_ATTR, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
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
                      border-left:3px solid #1a73e8}
      .cost-label{font:13px/1.2 system-ui,sans-serif;color:#666;margin-bottom:4px}
      .cost-value{font:24px/1.2 system-ui,sans-serif;font-weight:700;color:#1a73e8}
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
        const cacheSize = Object.keys(CACHE).length;

        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        wrap.innerHTML = `
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
          <div class="stat-row">
            <span class="stat-label">Cache Limit</span>
            <span class="stat-value">${CACHE_LIMIT} entries</span>
          </div>
        </div>

        <div class="section">
          <h4>Pricing Configuration</h4>
          <div class="stat-row">
            <span class="stat-label">Model</span>
            <span class="stat-value">${PRICING.model}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Input Cost</span>
            <span class="stat-value">$${PRICING.inputPer1M.toFixed(2)} / 1M tokens</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Output Cost</span>
            <span class="stat-value">$${PRICING.outputPer1M.toFixed(2)} / 1M tokens</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Last Updated</span>
            <span class="stat-value">${PRICING.lastUpdated}</span>
          </div>
        </div>

        <div class="note">
          💡 Usage stats persist across page loads. Use "Reset API usage stats" from the menu to clear counters.
        </div>

        <div class="actions">
          <button class="btn btn-close">Close</button>
        </div>
      </div>
    `;
        shadow.append(style, wrap);
        document.body.appendChild(host);

        const close = () => host.remove();
        const btnClose = shadow.querySelector('.btn-close');
        btnClose.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });

        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    }

    // ───────────────────────── SETTINGS FUNCTIONS ─────────────────────────
    async function setDebug(on) {
        CFG.DEBUG = !!on;
        await storage.set(DEBUG_KEY, String(CFG.DEBUG));
        location.reload();
    }

    async function setAutoSimplify(on) {
        AUTO_SIMPLIFY = !!on;
        await storage.set(AUTO_SIMPLIFY_KEY, String(AUTO_SIMPLIFY));
        location.reload();
    }

    async function toggleDomainMode() {
        DOMAINS_MODE = DOMAINS_MODE === 'allow' ? 'deny' : 'allow';
        await storage.set(DOMAINS_MODE_KEY, DOMAINS_MODE);
        location.reload();
    }

    async function addCurrentDomain(mode) {
        const list = mode === 'allow' ? DOMAIN_ALLOW : DOMAIN_DENY;
        if (!list.includes(HOST)) {
            list.push(HOST);
            if (mode === 'allow') {
                await storage.set(DOMAINS_ALLOW_KEY, JSON.stringify(list));
            } else {
                await storage.set(DOMAINS_DENY_KEY, JSON.stringify(list));
            }
            location.reload();
        }
    }

    // ───────────────────────── MENU COMMANDS ─────────────────────────
    GM_registerMenuCommand?.('--- Configuration ---', () => {});
    GM_registerMenuCommand?.('Set / Validate OpenAI API key', () => openKeyDialog());
    GM_registerMenuCommand?.('Configure custom prompts', openCustomPromptDialog);
    GM_registerMenuCommand?.(`Simplification style (${SIMPLIFICATION_LEVEL})`, openSimplificationStyleDialog);

    GM_registerMenuCommand?.('--- Domain Controls ---', () => {});
    GM_registerMenuCommand?.(
        `Domain mode: ${DOMAINS_MODE.toUpperCase()} (click to toggle)`,
        toggleDomainMode
    );

    if (DOMAINS_MODE === 'allow') {
        GM_registerMenuCommand?.('Edit allowlist (enabled domains)', () => openDomainEditor('allow'));
        if (!DOMAIN_DISABLED) {
            GM_registerMenuCommand?.(`✓ ${HOST} is enabled`, () => {});
        } else {
            GM_registerMenuCommand?.(`Enable on ${HOST}`, () => addCurrentDomain('allow'));
        }
    } else {
        GM_registerMenuCommand?.('Edit denylist (disabled domains)', () => openDomainEditor('deny'));
        if (!DOMAIN_DISABLED) {
            GM_registerMenuCommand?.(`Disable on ${HOST}`, () => addCurrentDomain('deny'));
        } else {
            GM_registerMenuCommand?.(`✗ ${HOST} is disabled`, () => {});
        }
    }

    GM_registerMenuCommand?.('--- Toggles ---', () => {});
    GM_registerMenuCommand?.(`Toggle auto-simplify (${AUTO_SIMPLIFY ? 'ON' : 'OFF'})`, async () => {
        await setAutoSimplify(!AUTO_SIMPLIFY);
    });
    GM_registerMenuCommand?.(`Toggle DEBUG logs (${CFG.DEBUG ? 'ON' : 'OFF'})`, async () => {
        await setDebug(!CFG.DEBUG);
    });

    GM_registerMenuCommand?.('--- Actions ---', () => {});
    GM_registerMenuCommand?.('Show usage statistics', showStats);
    GM_registerMenuCommand?.('Clear cache & reload', async () => {
        await cacheClear();
        location.reload();
    });
    GM_registerMenuCommand?.('Reset API usage stats', async () => {
        await resetApiTokens();
        openInfo('API usage stats reset. Token counters and cost tracking cleared.');
    });

    // ───────────────────────── BOOTSTRAP ─────────────────────────
    const isFirstInstall = await storage.get(FIRST_INSTALL_KEY, '') === '';
    const hasApiKey = (await storage.get('OPENAI_KEY', '')) !== '';

    if (isFirstInstall) {
        log('First install detected');
        await storage.set(FIRST_INSTALL_KEY, 'true');

        // Set to allowlist mode (disabled by default)
        if (DOMAINS_MODE === 'deny') {
            await storage.set(DOMAINS_MODE_KEY, 'allow');
            DOMAINS_MODE = 'allow';
            DOMAIN_DISABLED = true;
        }

        setTimeout(() => {
            openInfo('Welcome to Summarize The Web! Please set your OpenAI API key via the userscript menu, then add domains to the allowlist to enable the summary feature.');
        }, 500);
        return;
    }

    if (!hasApiKey) {
        log('No API key configured. Script inactive.');
        return;
    }

    if (DOMAIN_DISABLED) {
        log('Domain disabled:', HOST);
        return;
    }

    // Create overlay
    createOverlay();

    // Auto-simplify if enabled
    if (AUTO_SIMPLIFY) {
        setTimeout(() => {
            const textData = getTextToDigest();
            if (textData && textData.source === 'article') {
                log('Auto-simplify enabled, applying summary large digest...');
                applySummaryDigest('large');
            }
        }, 1000);
    }

    // Recreate overlay if removed
    const mo = new MutationObserver(() => {
        if (!overlay || !overlay.isConnected) {
            createOverlay();
        }
    });
    mo.observe(document.body, { childList: true });

})();
