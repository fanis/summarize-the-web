/**
 * UI overlay components for Summarize The Web
 */

import { UI_ATTR, STORAGE_KEYS } from './config.js';
import { escapeHtml } from './utils.js';

let overlay = null;
let summaryOverlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let autoCollapsedOverlay = false;

/**
 * Ensure CSS is loaded
 */
export function ensureCSS() {
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
        .digest-btn.inspect-btn {
            background: #f0f0f0 !important;
            border-color: #999 !important;
            color: #666 !important;
            font-size: 11px !important;
            padding: 6px 4px !important;
        }
        .digest-btn.inspect-btn:hover {
            background: #999 !important;
            color: #fff !important;
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
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
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

        .digest-summary-restore,
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

        .digest-summary-restore:hover,
        .digest-summary-close-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create the main overlay
 */
export function createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect) {
    if (overlay && overlay.isConnected) return overlay;

    ensureCSS();

    overlay = document.createElement('div');
    overlay.className = OVERLAY_COLLAPSED.value ? 'digest-overlay collapsed' : 'digest-overlay';
    overlay.setAttribute(UI_ATTR, '');

    // Set initial position
    const maxX = window.innerWidth - 170;
    const maxY = window.innerHeight - 200;
    OVERLAY_POS.x = Math.max(0, Math.min(OVERLAY_POS.x, maxX));
    OVERLAY_POS.y = Math.max(0, Math.min(OVERLAY_POS.y, maxY));

    overlay.style.top = `${OVERLAY_POS.y}px`;

    if (!OVERLAY_COLLAPSED.value) {
        overlay.style.left = `${OVERLAY_POS.x}px`;
    }

    overlay.innerHTML = `
        <div class="digest-slide-handle" title="${OVERLAY_COLLAPSED.value ? 'Open' : 'Close'}">
            ${OVERLAY_COLLAPSED.value ? '◀' : '▶'}
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
            <button class="digest-btn inspect-btn">Inspect</button>
            <div class="digest-status">Ready</div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Attach event listeners
    const slideHandle = overlay.querySelector('.digest-slide-handle');
    const dragHandle = overlay.querySelector('.digest-handle');
    const digestBtns = overlay.querySelectorAll('.digest-btn[data-size]');
    const inspectBtn = overlay.querySelector('.inspect-btn');

    slideHandle.addEventListener('click', (e) => toggleSlide(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));
    dragHandle.addEventListener('mousedown', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));
    dragHandle.addEventListener('touchstart', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));

    digestBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.dataset.size;
            onDigest(size);
        });
    });

    inspectBtn.addEventListener('click', onInspect);

    return overlay;
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

    if (OVERLAY_COLLAPSED.value) {
        overlay.classList.add('collapsed');
        overlay.style.left = '';
        overlay.style.right = '';
        overlay.style.transform = '';
    } else {
        overlay.classList.remove('collapsed');
        const currentY = parseInt(overlay.style.top) || OVERLAY_POS.y;
        const rightEdgeX = window.innerWidth - 170;

        overlay.style.right = '';
        overlay.style.transform = '';
        overlay.style.left = `${rightEdgeX}px`;
        overlay.style.top = `${currentY}px`;

        OVERLAY_POS.x = rightEdgeX;
        OVERLAY_POS.y = currentY;
        storage.set(STORAGE_KEYS.OVERLAY_POS, JSON.stringify(OVERLAY_POS));
    }

    const handle = overlay.querySelector('.digest-slide-handle');
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

        const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
        const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

        let newX = clientX - dragOffset.x;
        let newY = clientY - dragOffset.y;

        const maxX = window.innerWidth - overlay.offsetWidth;
        const maxY = window.innerHeight - overlay.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        overlay.style.left = `${newX}px`;
        overlay.style.top = `${newY}px`;

        OVERLAY_POS.x = newX;
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
export function updateOverlayStatus(status, mode = null, fromCache = false) {
    if (!overlay) return;

    const statusEl = overlay.querySelector('.digest-status');
    const digestBtns = overlay.querySelectorAll('.digest-btn[data-size]');

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

        const activeBtn = overlay.querySelector(`[data-size="${size}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

/**
 * Show summary overlay
 */
export function showSummaryOverlay(summaryText, mode, container, OVERLAY_COLLAPSED, onRestore) {
    removeSummaryOverlay();

    // Auto-collapse actions overlay on mobile to prevent overlap
    if (overlay && !OVERLAY_COLLAPSED.value) {
        autoCollapsedOverlay = true;
        collapseOverlay(OVERLAY_COLLAPSED);
    }

    summaryOverlay = document.createElement('div');
    summaryOverlay.className = 'digest-summary-overlay';
    summaryOverlay.setAttribute(UI_ATTR, '');

    const sizeLabel = mode.includes('large') ? 'Large' : 'Small';
    const isSelectedText = !container;

    const footerButtons = isSelectedText
        ? `<button class="digest-summary-close-btn">Close</button>`
        : `<button class="digest-summary-restore">Restore Original Article</button>`;

    summaryOverlay.innerHTML = `
        <div class="digest-summary-container">
            <div class="digest-summary-header">
                <div class="digest-summary-badge">${escapeHtml(sizeLabel)} Summary${isSelectedText ? ' (Selected Text)' : ''}</div>
                <button class="digest-summary-close" title="Close">✕</button>
            </div>
            <div class="digest-summary-content">
                ${summaryText.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
            </div>
            <div class="digest-summary-footer">
                <div class="digest-summary-footer-text">Summarize The Web</div>
                ${footerButtons}
            </div>
        </div>
    `;

    document.body.appendChild(summaryOverlay);

    const closeBtn = summaryOverlay.querySelector('.digest-summary-close');
    const closeBtnFooter = summaryOverlay.querySelector('.digest-summary-close-btn');
    const restoreBtn = summaryOverlay.querySelector('.digest-summary-restore');

    const closeHandler = () => {
        removeSummaryOverlay();
        if (!isSelectedText) onRestore();
    };

    if (isSelectedText) {
        closeBtn.addEventListener('click', removeSummaryOverlay);
        closeBtnFooter.addEventListener('click', removeSummaryOverlay);
    } else {
        closeBtn.addEventListener('click', closeHandler);
        restoreBtn.addEventListener('click', closeHandler);
    }

    summaryOverlay.addEventListener('click', (e) => {
        if (e.target === summaryOverlay) {
            if (isSelectedText) {
                removeSummaryOverlay();
            } else {
                closeHandler();
            }
        }
    });

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            if (isSelectedText) {
                removeSummaryOverlay();
            } else {
                closeHandler();
            }
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Remove summary overlay
 */
export function removeSummaryOverlay() {
    if (summaryOverlay && summaryOverlay.isConnected) {
        summaryOverlay.remove();
    }
    summaryOverlay = null;

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
    overlay.style.right = '';
    overlay.style.transform = '';
    const handle = overlay.querySelector('.digest-slide-handle');
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
    overlay.classList.remove('collapsed');
    const rightEdgeX = window.innerWidth - 170;
    overlay.style.right = '';
    overlay.style.transform = '';
    overlay.style.left = `${rightEdgeX}px`;
    const handle = overlay.querySelector('.digest-slide-handle');
    if (handle) {
        handle.textContent = '▶';
        handle.title = 'Close';
    }
}

/**
 * Ensure overlay exists (recreate if removed)
 */
export function ensureOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect) {
    if (!overlay || !overlay.isConnected) {
        createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect);
    }
}

/**
 * Get current overlay reference
 */
export function getOverlay() {
    return overlay;
}
