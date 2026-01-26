import { CFG, STORAGE_KEYS, MODEL_OPTIONS, DEFAULT_SELECTORS, DEFAULT_EXCLUDES, DEFAULT_PROMPTS, SIMPLIFICATION_LEVELS, DEFAULT_MIN_TEXT_LENGTH } from './modules/config.js';
import { log } from './modules/utils.js';
import { Storage } from './modules/storage.js';
import { domainPatternToRegex, listMatchesHost } from './modules/selectors.js';
import { initApiTracking, digestText, friendlyApiError, resetApiTokens, PRICING } from './modules/api.js';
import { DigestCache } from './modules/cache.js';
import {
    openEditor, openInfo, openKeyDialog, openWelcomeDialog,
    openSimplificationStyleDialog, openModelSelectionDialog, openCustomPromptDialog,
    showStats, openDomainEditor
} from './modules/settings.js';
import { enterInspectionMode } from './modules/inspection.js';
import { getTextToDigest } from './modules/extraction.js';
import { createOverlay, ensureOverlay, updateOverlayStatus, showSummaryOverlay, removeSummaryOverlay, BADGE_WIDTH } from './modules/overlay.js';

(async () => {
    'use strict';

    // Only run in top-level window, not in iframes
    if (window.self !== window.top) {
        return;
    }

    const HOST = location.hostname;
    const storage = new Storage();

    // Prevent multiple API key dialogs
    let apiKeyDialogShown = { value: false };

    // Initialize API tracking
    await initApiTracking(storage);

    // Load toggles
    try { const v = await storage.get(STORAGE_KEYS.DEBUG, ''); if (v !== '') CFG.DEBUG = (v === true || v === 'true'); } catch {}

    // Domain mode + lists
    let DOMAINS_MODE = 'allow';
    let DOMAIN_DENY = [];
    let DOMAIN_ALLOW = [];

    // Load persisted data
    let SELECTORS_GLOBAL = [...DEFAULT_SELECTORS];
    let EXCLUDE_GLOBAL = { ...DEFAULT_EXCLUDES, ancestors: [...DEFAULT_EXCLUDES.ancestors] };
    let DOMAIN_SELECTORS = {};
    let DOMAIN_EXCLUDES = {};

    try { SELECTORS_GLOBAL = JSON.parse(await storage.get(STORAGE_KEYS.SELECTORS_GLOBAL, JSON.stringify(DEFAULT_SELECTORS))); } catch {}
    try { EXCLUDE_GLOBAL = JSON.parse(await storage.get(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(DEFAULT_EXCLUDES))); } catch {}
    try { DOMAIN_SELECTORS = JSON.parse(await storage.get(STORAGE_KEYS.DOMAIN_SELECTORS, '{}')); } catch {}
    try { DOMAIN_EXCLUDES = JSON.parse(await storage.get(STORAGE_KEYS.DOMAIN_EXCLUDES, '{}')); } catch {}

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

    try { DOMAINS_MODE = await storage.get(STORAGE_KEYS.DOMAINS_MODE, 'allow'); } catch {}
    try { DOMAIN_DENY = JSON.parse(await storage.get(STORAGE_KEYS.DOMAINS_DENY, '[]')); } catch {}
    try { DOMAIN_ALLOW = JSON.parse(await storage.get(STORAGE_KEYS.DOMAINS_ALLOW, '[]')); } catch {}

    // Load prompts
    let CUSTOM_PROMPTS = { ...DEFAULT_PROMPTS };
    try { const v = await storage.get(STORAGE_KEYS.CUSTOM_PROMPT, ''); if (v) CUSTOM_PROMPTS = JSON.parse(v); } catch {}

    // Load simplification style
    let SIMPLIFICATION_LEVEL = 'Balanced';
    try {
        const v = await storage.get(STORAGE_KEYS.SIMPLIFICATION_STRENGTH, '');
        log('Loaded simplification style from storage:', v, 'valid:', SIMPLIFICATION_LEVELS.includes(v));
        if (v && SIMPLIFICATION_LEVELS.includes(v)) {
            SIMPLIFICATION_LEVEL = v;
        }
    } catch {}
    log('Using simplification level:', SIMPLIFICATION_LEVEL);

    // Overlay state
    let OVERLAY_COLLAPSED = { value: false };
    try { const v = await storage.get(STORAGE_KEYS.OVERLAY_COLLAPSED, ''); if (v !== '') OVERLAY_COLLAPSED.value = (v === true || v === 'true'); } catch {}

    let OVERLAY_POS = { x: document.documentElement.clientWidth - BADGE_WIDTH, y: window.innerHeight * 0.7 };
    try { const v = await storage.get(STORAGE_KEYS.OVERLAY_POS, ''); if (v) OVERLAY_POS = JSON.parse(v); } catch {}

    // Auto-simplify setting
    let AUTO_SIMPLIFY = false;
    try { const v = await storage.get(STORAGE_KEYS.AUTO_SIMPLIFY, ''); if (v !== '') AUTO_SIMPLIFY = (v === true || v === 'true'); } catch {}

    // Minimum text length for extraction
    let MIN_TEXT_LENGTH = DEFAULT_MIN_TEXT_LENGTH;
    try {
        const v = await storage.get(STORAGE_KEYS.MIN_TEXT_LENGTH, '');
        if (v !== '') {
            const parsed = parseInt(v, 10);
            if (!isNaN(parsed) && parsed >= 0) MIN_TEXT_LENGTH = parsed;
        }
    } catch {}

    // Initialize cache
    const cache = new DigestCache(storage);
    await cache.init();

    // Domain matching
    function computeDomainDisabled(host) {
        if (DOMAINS_MODE === 'allow') return !listMatchesHost(DOMAIN_ALLOW, host);
        return listMatchesHost(DOMAIN_DENY, host);
    }

    let DOMAIN_DISABLED = computeDomainDisabled(HOST);
    log('domain check:', HOST, 'mode=', DOMAINS_MODE, 'disabled=', DOMAIN_DISABLED);

    // Register Domain Controls menu BEFORE early return so users can enable disabled domains
    GM_registerMenuCommand?.('--- Domain Controls ---', () => {});

    GM_registerMenuCommand?.(
        DOMAINS_MODE === 'allow' ? 'Domain mode: Allowlist only' : 'Domain mode: All domains with Denylist',
        async () => {
            DOMAINS_MODE = (DOMAINS_MODE === 'allow') ? 'deny' : 'allow';
            await storage.set(STORAGE_KEYS.DOMAINS_MODE, DOMAINS_MODE);
            location.reload();
        }
    );

    GM_registerMenuCommand?.(
        computeDomainDisabled(HOST) ? `Current page: DISABLED (click to enable)` : `Current page: ENABLED (click to disable)`,
        async () => {
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
            location.reload();
        }
    );

    GM_registerMenuCommand?.('Edit domain allowlist', () => {
        openDomainEditor(storage, 'allow', DOMAIN_ALLOW, DOMAIN_DENY);
    });

    GM_registerMenuCommand?.('Edit domain denylist', () => {
        openDomainEditor(storage, 'deny', DOMAIN_ALLOW, DOMAIN_DENY);
    });

    // Original article content (for restore functionality)
    let originalContent = null;
    let lastSummarizedContainer = null;

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

            const { text, elements, source, container } = textData;

            // Store original content for restore
            if (source === 'article' && container && !originalContent) {
                originalContent = container.innerHTML;
                lastSummarizedContainer = container;
            }

            log(`Digesting ${text.length} chars from ${source}`);

            const prompt = CUSTOM_PROMPTS[mode] || DEFAULT_PROMPTS[mode];

            const result = await digestText(
                storage,
                text,
                mode,
                prompt,
                SIMPLIFICATION_LEVEL,
                (t, m) => cache.get(t, m),
                async (t, m, r) => await cache.set(t, m, r),
                (msg) => openKeyDialog(storage, msg, apiKeyDialogShown),
                openInfo
            );

            updateOverlayStatus('digested', mode);
            showSummaryOverlay(result, mode, container, OVERLAY_COLLAPSED, restoreOriginal, storage);

        } catch (err) {
            console.error('Digest error:', err);
            friendlyApiError(err, (msg) => openKeyDialog(storage, msg, apiKeyDialogShown), openInfo);
            updateOverlayStatus('ready');
        }
    }

    // Restore original article content
    function restoreOriginal() {
        if (originalContent && lastSummarizedContainer) {
            lastSummarizedContainer.innerHTML = originalContent;
            originalContent = null;
            lastSummarizedContainer = null;
        }
        updateOverlayStatus('ready');
        removeSummaryOverlay();
    }

    // Inspection mode handler
    function handleInspection() {
        enterInspectionMode(
            SELECTORS, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN,
            EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE,
            storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo
        );
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
    GM_registerMenuCommand?.('--- Configuration ---', () => {});

    GM_registerMenuCommand?.('Set / Validate OpenAI API key', async () => {
        const current = await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
        openEditor({
            title: 'OpenAI API key',
            mode: 'secret',
            initial: current,
            hint: 'Stored locally (GM → localStorage → memory). Validate sends GET /v1/models.',
            onSave: async (val) => { await storage.set(STORAGE_KEYS.OPENAI_KEY, val); },
            onValidate: async (val) => {
                const { xhrGet } = await import('./modules/api.js');
                const key = val || await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
                if (!key) { openInfo('No key to test'); return; }
                try { await xhrGet('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` }); openInfo('Validation OK (HTTP 200)'); }
                catch (e) { openInfo(`Validation failed: ${e.message || e}`); }
            }
        });
    });

    GM_registerMenuCommand?.(`Select AI Model (${MODEL_OPTIONS[CFG.model]?.name || CFG.model})`, () => {
        openModelSelectionDialog(storage, CFG.model, setModel);
    });

    GM_registerMenuCommand?.(`Simplification style (${SIMPLIFICATION_LEVEL})`, () => {
        openSimplificationStyleDialog(storage, SIMPLIFICATION_LEVEL, setSimplification);
    });

    GM_registerMenuCommand?.('Custom prompts', () => {
        openCustomPromptDialog(storage, CUSTOM_PROMPTS, setCustomPrompts);
    });

    GM_registerMenuCommand?.(`Minimum text length (${MIN_TEXT_LENGTH} chars)`, () => {
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

    // Selector configuration menu commands
    GM_registerMenuCommand?.('--- Container Selectors ---', () => {});

    GM_registerMenuCommand?.('Edit GLOBAL container selectors', () => {
        openEditor({
            title: 'Global container selectors (all domains)',
            mode: 'list',
            initial: SELECTORS_GLOBAL,
            hint: 'CSS selectors for finding article containers. One per line. Applied to all domains.',
            onSave: async (lines) => {
                const clean = lines.filter(Boolean).map(s => s.trim()).filter(Boolean);
                SELECTORS_GLOBAL = clean.length ? clean : [...DEFAULT_SELECTORS];
                await storage.set(STORAGE_KEYS.SELECTORS_GLOBAL, JSON.stringify(SELECTORS_GLOBAL));
                location.reload();
            }
        });
    });

    GM_registerMenuCommand?.('Edit GLOBAL exclusions: elements (self)', () => {
        openEditor({
            title: 'Global excluded elements (all domains)',
            mode: 'list',
            initial: EXCLUDE_GLOBAL.self || [],
            hint: 'Elements matching these selectors will be excluded. One per line.',
            onSave: async (lines) => {
                EXCLUDE_GLOBAL.self = lines;
                await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));
                location.reload();
            }
        });
    });

    GM_registerMenuCommand?.('Edit GLOBAL exclusions: containers (ancestors)', () => {
        openEditor({
            title: 'Global excluded containers (all domains)',
            mode: 'list',
            initial: EXCLUDE_GLOBAL.ancestors || [],
            hint: 'Text inside these containers will be excluded. One per line (e.g., .sidebar, nav, footer).',
            onSave: async (lines) => {
                EXCLUDE_GLOBAL.ancestors = lines;
                await storage.set(STORAGE_KEYS.EXCLUDES_GLOBAL, JSON.stringify(EXCLUDE_GLOBAL));
                location.reload();
            }
        });
    });

    GM_registerMenuCommand?.(`Edit DOMAIN additions: container selectors (${HOST})`, () => {
        openEditor({
            title: `Domain-specific container selectors for ${HOST}`,
            mode: 'domain',
            initial: SELECTORS_DOMAIN,
            globalItems: SELECTORS_GLOBAL,
            hint: 'Domain-specific selectors are added to global ones. Edit only the bottom section.',
            onSave: async (lines) => {
                DOMAIN_SELECTORS[HOST] = lines;
                await storage.set(STORAGE_KEYS.DOMAIN_SELECTORS, JSON.stringify(DOMAIN_SELECTORS));
                location.reload();
            }
        });
    });

    GM_registerMenuCommand?.(`Edit DOMAIN additions: exclusions elements (${HOST})`, () => {
        openEditor({
            title: `Domain-specific excluded elements for ${HOST}`,
            mode: 'domain',
            initial: EXCLUDE_DOMAIN.self || [],
            globalItems: EXCLUDE_GLOBAL.self || [],
            hint: 'Domain-specific excludes are added to global ones. Edit only the bottom section.',
            onSave: async (lines) => {
                if (!DOMAIN_EXCLUDES[HOST]) DOMAIN_EXCLUDES[HOST] = { self: [], ancestors: [] };
                DOMAIN_EXCLUDES[HOST].self = lines;
                await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                location.reload();
            }
        });
    });

    GM_registerMenuCommand?.(`Edit DOMAIN additions: exclusions containers (${HOST})`, () => {
        openEditor({
            title: `Domain-specific excluded containers for ${HOST}`,
            mode: 'domain',
            initial: EXCLUDE_DOMAIN.ancestors || [],
            globalItems: EXCLUDE_GLOBAL.ancestors || [],
            hint: 'Domain-specific excludes are added to global ones. Edit only the bottom section.',
            onSave: async (lines) => {
                if (!DOMAIN_EXCLUDES[HOST]) DOMAIN_EXCLUDES[HOST] = { self: [], ancestors: [] };
                DOMAIN_EXCLUDES[HOST].ancestors = lines;
                await storage.set(STORAGE_KEYS.DOMAIN_EXCLUDES, JSON.stringify(DOMAIN_EXCLUDES));
                location.reload();
            }
        });
    });

    // Toggles
    GM_registerMenuCommand?.('--- Toggles ---', () => {});

    GM_registerMenuCommand?.(`Toggle DEBUG logs (${CFG.DEBUG ? 'ON' : 'OFF'})`, async () => {
        CFG.DEBUG = !CFG.DEBUG;
        await storage.set(STORAGE_KEYS.DEBUG, String(CFG.DEBUG));
        location.reload();
    });

    GM_registerMenuCommand?.(`Toggle auto-simplify (${AUTO_SIMPLIFY ? 'ON' : 'OFF'})`, async () => {
        await setAutoSimplify(!AUTO_SIMPLIFY);
    });

    // Actions
    GM_registerMenuCommand?.('--- Actions ---', () => {});

    GM_registerMenuCommand?.('Show usage statistics', () => {
        showStats(cache.size);
    });

    GM_registerMenuCommand?.('Flush cache & reload', async () => {
        await cache.clear();
        location.reload();
    });

    GM_registerMenuCommand?.('Reset API usage stats', async () => {
        await resetApiTokens(storage);
        openInfo('API usage stats reset. Token counters and cost tracking cleared.');
    });

    GM_registerMenuCommand?.('Inspect element', handleInspection);

    // Bootstrap
    const isFirstInstall = await storage.get(STORAGE_KEYS.FIRST_INSTALL, '') === '';
    const hasApiKey = (await storage.get(STORAGE_KEYS.OPENAI_KEY, '')) !== '';

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

    // Create overlay
    createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, handleDigest, handleInspection);

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
        ensureOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, handleDigest, handleInspection);
    });
    mo.observe(document.body, { childList: true, subtree: false });

    log('Script initialized for', HOST);
})();
