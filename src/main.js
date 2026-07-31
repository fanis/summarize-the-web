import { CFG, STORAGE_KEYS, MODEL_OPTIONS, DEFAULT_SELECTORS, DEFAULT_EXCLUDES, DEFAULT_PROMPTS, SIMPLIFICATION_LEVELS, DEFAULT_MIN_TEXT_LENGTH } from './modules/config.js';
import { log, registerMenuCommand } from './modules/utils.js';
import { Storage } from './modules/storage.js';
import { domainPatternToRegex, listMatchesHost } from './modules/selectors.js';
import { initApiTracking, digestText, friendlyApiError, resetApiTokens, PRICING, MODEL_FALLBACK } from './modules/api.js';
import { DigestCache } from './modules/cache.js';
import {
    openInfo, openKeyDialog, openApiKeyEditor, openWelcomeDialog,
    openSimplificationStyleDialog, openModelSelectionDialog, openCustomPromptDialog,
    showStats, openDomainEditor, openSelectorEditor, showToast
} from './modules/settings.js';
import { enterInspectionMode, showSummaryHighlight, exitSummaryHighlight } from './modules/inspection.js';
import { getTextToDigest } from './modules/extraction.js';
import { createOverlay, ensureOverlay, updateOverlayStatus, showSummaryOverlay, BADGE_WIDTH } from './modules/overlay.js';

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
