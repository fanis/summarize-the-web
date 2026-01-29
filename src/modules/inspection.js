/**
 * Inspection mode functionality for debugging article container detection
 */

import { UI_ATTR, STORAGE_KEYS, DEFAULT_EXCLUDES } from './config.js';
import { escapeHtml, textTrim } from './utils.js';
import { generateCSSSelector, findMatchingSelectors, findMatchingExclusions, compiledSelectors } from './selectors.js';

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
 */
export function enterInspectionMode(SELECTORS, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE, storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo) {
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
        const target = findMostSpecificElement(e.clientX, e.clientY, SELECTORS);
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
        const target = findMostSpecificElement(e.clientX, e.clientY, SELECTORS);
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
        showDiagnosticDialog(inspectedElement, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE, storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo);
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
export function exitInspectionMode() {
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
function diagnoseElement(el, SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE) {
    const text = textTrim(el);
    const selector = generateCSSSelector(el);

    const globalSelectors = findMatchingSelectors(el, SELECTORS_GLOBAL);
    const domainSelectors = findMatchingSelectors(el, SELECTORS_DOMAIN);
    const globalExclusions = findMatchingExclusions(el, EXCLUDE_GLOBAL);
    const domainExclusions = findMatchingExclusions(el, EXCLUDE_DOMAIN);

    // Check if element is excluded
    let isExcluded = false;
    if (EXCLUDE.self) {
        for (const sel of EXCLUDE.self) {
            try { if (el.matches(sel)) { isExcluded = true; break; } } catch {}
        }
    }
    if (!isExcluded && EXCLUDE.ancestors) {
        for (const sel of EXCLUDE.ancestors) {
            try { if (el.closest(sel)) { isExcluded = true; break; } } catch {}
        }
    }

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
        // New fields for "included via container"
        isInsideContainer,
        ancestorMatch,
        isIncludedInSummary
    };
}

/**
 * Show diagnostic dialog
 */
function showDiagnosticDialog(el, HOST, SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE, storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, openInfo) {
    const diag = diagnoseElement(el, SELECTORS_GLOBAL, SELECTORS_DOMAIN, EXCLUDE_GLOBAL, EXCLUDE_DOMAIN, EXCLUDE);

    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
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

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

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

    wrap.innerHTML = `
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
                    <div class="info-row"><span class="info-label">ID:</span> ${diag.id || '(none)'}</div>
                    <div class="info-row"><span class="info-label">Classes:</span> ${diag.classes || '(none)'}</div>
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
                    <div class="section-title">Domain Container Selectors (${HOST})</div>
                    ${domainSelectorsHTML}
                </div>

                <div class="section">
                    <div class="section-title">Global Exclusions</div>
                    ${globalExclusionsHTML}
                </div>

                <div class="section">
                    <div class="section-title">Domain Exclusions (${HOST})</div>
                    ${domainExclusionsHTML}
                </div>
            </div>

            <div class="footer">
                <div class="footer-secondary">
                    ${buildActionButtons(diag, HOST)}
                </div>
                <div class="footer-actions">
                    <button class="btn secondary copy-selector">Copy Selector</button>
                    <button class="btn primary close">Close</button>
                </div>
            </div>
        </div>
    `;

    shadow.append(style, wrap);
    document.body.appendChild(host);

    const close = () => {
        if (inspectedElement) {
            inspectedElement.style.outline = inspectedElement._origOutline || '';
            inspectedElement.style.outlineOffset = inspectedElement._origOutlineOffset || '';
            delete inspectedElement._origOutline;
            delete inspectedElement._origOutlineOffset;
            inspectedElement = null;
        }
        host.remove();
    };

    shadow.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', close));
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });

    shadow.querySelector('.copy-selector').addEventListener('click', () => {
        navigator.clipboard.writeText(diag.selector).then(() => {
            const btn = shadow.querySelector('.copy-selector');
            const orig = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = orig, 2000);
        });
    });

    attachActionHandlers(shadow, diag, close, storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, HOST, SELECTORS_GLOBAL, EXCLUDE_GLOBAL, openInfo);

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Build action buttons for diagnostic dialog
 */
function buildActionButtons(diag, HOST) {
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
function attachActionHandlers(shadow, diag, closeDialog, storage, DOMAIN_SELECTORS, DOMAIN_EXCLUDES, HOST, SELECTORS_GLOBAL, EXCLUDE_GLOBAL, openInfo) {
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
 * Check if element is excluded
 */
function isElementExcluded(el, EXCLUDE) {
    if (EXCLUDE.self) {
        for (const sel of EXCLUDE.self) {
            try { if (el.matches(sel)) return true; } catch {}
        }
    }
    if (EXCLUDE.ancestors) {
        for (const sel of EXCLUDE.ancestors) {
            try { if (el.closest(sel)) return true; } catch {}
        }
    }
    return false;
}

/**
 * Show which elements would be included in summary
 */
export function showSummaryHighlight(SELECTORS, EXCLUDE, minLength = 100) {
    if (summaryHighlightActive) {
        exitSummaryHighlight();
        return;
    }

    summaryHighlightActive = true;
    highlightedElements = [];

    // Get total page text for comparison
    const bodyText = (document.body.innerText ?? document.body.textContent ?? '').trim();
    const bodyLength = bodyText.length || 1;

    // Collect all matching candidates with their text stats
    const candidates = [];
    for (const selector of SELECTORS) {
        try {
            const candidate = document.querySelector(selector);
            if (!candidate) continue;

            const rawText = (candidate.innerText ?? candidate.textContent ?? '').trim();
            const percent = Math.round((rawText.length / bodyLength) * 100);

            candidates.push({ candidate, selector, text: rawText, length: rawText.length, percent });
        } catch (e) {
            // Invalid selector, skip
        }
    }

    if (candidates.length === 0) {
        showHighlightMessage('No article container found matching configured selectors.', false);
        return;
    }

    // Sort by text length descending
    candidates.sort((a, b) => b.length - a.length);

    const best = candidates[0];

    // Check if one container is dominant
    const dominated = best.percent > 70 && (candidates.length < 2 || candidates[1].percent < best.percent * 0.5);

    let selectedContainers = [];

    if (dominated) {
        selectedContainers = [best];
    } else {
        // Multiple significant containers - combine non-nested ones
        const significant = candidates.filter(c => c.percent >= 15 && c.length > minLength);

        // Filter out nested containers
        const nonNested = significant.filter((c, i) =>
            !significant.some((other, j) => i !== j &&
                (other.candidate.contains(c.candidate) || c.candidate.contains(other.candidate))
            )
        );

        if (nonNested.length > 1) {
            selectedContainers = nonNested;
        } else {
            selectedContainers = [best];
        }
    }

    // Text element selectors - these are the elements that actually contain readable text
    const textElementSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, dd, dt, pre, td, th';

    let includedCount = 0;
    let excludedCount = 0;

    // Find and highlight text elements within containers
    for (const c of selectedContainers) {
        const textElements = c.candidate.querySelectorAll(textElementSelector);

        for (const el of textElements) {
            // Skip empty elements
            const text = (el.innerText ?? el.textContent ?? '').trim();
            if (text.length < 10) continue;

            // Skip if already highlighted (nested elements)
            if (highlightedElements.some(h => h.element === el || h.element.contains(el) || el.contains(h.element))) {
                continue;
            }

            const excluded = isElementExcluded(el, EXCLUDE);

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
export function exitSummaryHighlight() {
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
