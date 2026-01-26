/**
 * UI overlay components for Summarize The Web
 */

import { UI_ATTR, STORAGE_KEYS, SUMMARY_FONT_SIZES, SUMMARY_LINE_HEIGHTS, THEME_OPTIONS, DEFAULT_SHORTCUTS } from './config.js';
import { escapeHtml } from './utils.js';

let overlay = null;
let summaryOverlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let autoCollapsedOverlay = false;
let autoCollapsedState = null;
let currentTheme = 'auto';
let mediaQueryList = null;
let shortcuts = { ...DEFAULT_SHORTCUTS };
let keyboardHandler = null;

export const BADGE_WIDTH = 150;

/**
 * Format shortcut for display
 */
function formatShortcut(shortcut) {
    if (!shortcut) return '';
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
}

/**
 * Check if a keyboard event matches a shortcut
 */
function matchesShortcut(event, shortcut) {
    if (!shortcut) return false;
    return event.key.toUpperCase() === shortcut.key.toUpperCase() &&
           event.altKey === shortcut.alt &&
           event.shiftKey === shortcut.shift &&
           event.ctrlKey === shortcut.ctrl;
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
        shift: parts.includes('SHIFT')
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
        element.classList.add('digest-dark');
    } else {
        element.classList.remove('digest-dark');
    }
}

/**
 * Update theme on all overlays
 */
function updateAllThemes(theme) {
    applyTheme(overlay, theme);
    applyTheme(summaryOverlay, theme);
}

/**
 * Sync badge settings UI when changed from summary overlay
 */
function syncBadgeSetting(setting, value) {
    if (!overlay) return;
    const options = overlay.querySelectorAll(`[data-setting="${setting}"] .digest-settings-option`);
    options.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
}

/** Viewport width excluding scrollbar */
function viewportWidth() {
    return document.documentElement.clientWidth;
}

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
            left: -30px !important;
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
            left: -32px !important;
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
        .digest-footer {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
        }
        .digest-status {
            font-size: 10px !important;
            color: #666 !important;
            margin: 0 !important;
            flex: 1 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        .digest-badge-settings {
            position: relative !important;
        }
        .digest-badge-settings .digest-settings-btn {
            min-width: 24px !important;
            width: 24px !important;
            height: 24px !important;
            flex: none !important;
            padding: 4px !important;
            font-size: 12px !important;
        }
        .digest-badge-settings .digest-settings-popover {
            right: 0 !important;
            bottom: 28px !important;
            top: auto !important;
            min-width: 160px !important;
        }
        .digest-badge-settings .inspect-btn {
            width: 100% !important;
            margin-top: 8px !important;
            padding-top: 8px !important;
            border-top: 1px solid #e5e7eb !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
            background: transparent !important;
        }
        .digest-badge-settings .inspect-btn:hover {
            background: #f3f4f6 !important;
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
            max-width: 760px !important;
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
            padding: 28px 40px !important;
            font: var(--digest-font-size, 17px)/var(--digest-line-height, 1.8) system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            color: #2d3748 !important;
            max-height: calc(90vh - 180px) !important;
            overflow-y: auto !important;
        }

        .digest-summary-content-inner {
            max-width: 680px !important;
            margin: 0 auto !important;
        }

        .digest-summary-content p {
            margin: 0 0 1.25em 0 !important;
            text-align: left !important;
            word-spacing: 0.05em !important;
            letter-spacing: 0.01em !important;
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

        .digest-summary-header-controls {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .digest-summary-settings {
            position: relative !important;
        }

        .digest-summary-settings-btn {
            background: rgba(255, 255, 255, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            color: #fff !important;
            font-size: 18px !important;
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

        .digest-summary-settings-btn:hover {
            background: rgba(255, 255, 255, 0.3) !important;
        }

        .digest-summary-popover {
            top: 40px !important;
            right: 0 !important;
            min-width: 180px !important;
        }

        .digest-settings-popover {
            position: absolute !important;
            top: 40px !important;
            right: 0 !important;
            background: #fff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 10px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
            padding: 16px !important;
            min-width: 200px !important;
            z-index: 10 !important;
            display: none !important;
        }

        .digest-settings-popover.open {
            display: block !important;
        }

        .digest-settings-group {
            margin-bottom: 14px !important;
        }

        .digest-settings-group:last-child {
            margin-bottom: 0 !important;
        }

        .digest-settings-label {
            font: 600 11px/1.2 system-ui, sans-serif !important;
            color: #667eea !important;
            margin: 0 0 8px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        .digest-settings-options {
            display: flex !important;
            gap: 4px !important;
        }

        .digest-settings-option {
            flex: 1 !important;
            padding: 6px 8px !important;
            border: 1px solid #ddd !important;
            background: #fff !important;
            color: #666 !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font: 500 12px/1.2 system-ui, sans-serif !important;
            text-align: center !important;
            transition: all 0.15s !important;
        }

        .digest-settings-option:hover {
            border-color: #667eea !important;
            color: #667eea !important;
        }

        .digest-settings-option.active {
            background: #667eea !important;
            border-color: #667eea !important;
            color: #fff !important;
        }

        .digest-shortcut-row {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
        }
        .digest-shortcut-row:last-child {
            margin-bottom: 0 !important;
        }
        .digest-shortcut-label {
            font: 500 11px/1.2 system-ui, sans-serif !important;
            color: #666 !important;
            min-width: 40px !important;
        }
        .digest-shortcut-input {
            flex: 1 !important;
            padding: 4px 8px !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font: 500 11px/1.2 system-ui, sans-serif !important;
            text-align: center !important;
            cursor: pointer !important;
            background: #fff !important;
            color: #333 !important;
        }
        .digest-shortcut-input:focus {
            outline: none !important;
            border-color: #667eea !important;
            background: #f0f4ff !important;
        }
        .digest-shortcut-input.recording {
            border-color: #f59e0b !important;
            background: #fffbeb !important;
            animation: digest-pulse 1s infinite !important;
        }
        @keyframes digest-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        /* Dark mode for shortcuts */
        .digest-dark .digest-shortcut-label {
            color: #9ca3af !important;
        }
        .digest-dark .digest-shortcut-input {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #e5e7eb !important;
        }
        .digest-dark .digest-shortcut-input:focus {
            border-color: #6366f1 !important;
            background: #1e1b4b !important;
        }

        /* Dark mode styles */
        .digest-overlay.digest-dark {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
            border-color: #4338ca !important;
        }
        .digest-dark .digest-slide-handle {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
            border-color: #4338ca !important;
        }
        .digest-dark .digest-content {
            background: rgba(30, 27, 75, 0.95) !important;
        }
        .digest-dark .digest-btn {
            background: #1e1b4b !important;
            border-color: #6366f1 !important;
            color: #a5b4fc !important;
        }
        .digest-dark .digest-btn:hover {
            background: #6366f1 !important;
            color: #fff !important;
        }
        .digest-dark .digest-btn.active {
            background: #6366f1 !important;
            color: #fff !important;
        }
        .digest-dark .digest-status {
            color: #9ca3af !important;
        }
        .digest-dark .digest-badge-settings .inspect-btn {
            border-top-color: #374151 !important;
            color: #d1d5db !important;
        }
        .digest-dark .digest-badge-settings .inspect-btn:hover {
            background: #374151 !important;
        }
        .digest-dark .digest-settings-popover {
            background: #1f2937 !important;
            border-color: #374151 !important;
        }
        .digest-dark .digest-settings-label {
            color: #a5b4fc !important;
        }
        .digest-dark .digest-settings-option {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #d1d5db !important;
        }
        .digest-dark .digest-settings-option:hover {
            border-color: #6366f1 !important;
            color: #a5b4fc !important;
        }
        .digest-dark .digest-settings-option.active {
            background: #6366f1 !important;
            border-color: #6366f1 !important;
            color: #fff !important;
        }

        /* Dark mode for summary overlay */
        .digest-summary-overlay.digest-dark {
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
            border-color: #4338ca !important;
        }
        .digest-summary-overlay.digest-dark .digest-summary-header {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
        }
        .digest-summary-overlay.digest-dark .digest-summary-content {
            color: #e5e7eb !important;
        }
        .digest-summary-overlay.digest-dark .digest-summary-footer {
            background: rgba(30, 27, 75, 0.3) !important;
            border-top-color: rgba(99, 102, 241, 0.3) !important;
        }
        .digest-summary-overlay.digest-dark .digest-summary-footer-text {
            color: #6b7280 !important;
        }
        .digest-summary-overlay.digest-dark .digest-summary-close-btn {
            background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%) !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create the main overlay
 */
export async function createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect) {
    if (overlay && overlay.isConnected) return overlay;

    ensureCSS();

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
    overlay.className = OVERLAY_COLLAPSED.value ? 'digest-overlay collapsed' : 'digest-overlay';
    overlay.setAttribute(UI_ATTR, '');

    // Apply theme
    applyTheme(overlay, savedTheme);

    // Set initial position
    const maxX = viewportWidth() - BADGE_WIDTH;
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
                <button class="digest-btn" data-size="large" title="${formatShortcut(shortcuts.large)}">Large</button>
                <button class="digest-btn" data-size="small" title="${formatShortcut(shortcuts.small)}">Small</button>
            </div>
            <div class="digest-footer">
                <div class="digest-status">Ready</div>
                <div class="digest-badge-settings">
                    <button class="digest-btn digest-settings-btn" title="Display settings">&#9881;</button>
                    <div class="digest-settings-popover">
                        <div class="digest-settings-group">
                            <div class="digest-settings-label">Font Size</div>
                            <div class="digest-settings-options" data-setting="fontSize">
                                <button class="digest-settings-option${savedFontSize === 'small' ? ' active' : ''}" data-value="small">S</button>
                                <button class="digest-settings-option${savedFontSize === 'default' ? ' active' : ''}" data-value="default">M</button>
                                <button class="digest-settings-option${savedFontSize === 'large' ? ' active' : ''}" data-value="large">L</button>
                            </div>
                        </div>
                        <div class="digest-settings-group">
                            <div class="digest-settings-label">Spacing</div>
                            <div class="digest-settings-options" data-setting="lineHeight">
                                <button class="digest-settings-option${savedLineHeight === 'compact' ? ' active' : ''}" data-value="compact">-</button>
                                <button class="digest-settings-option${savedLineHeight === 'default' ? ' active' : ''}" data-value="default">=</button>
                                <button class="digest-settings-option${savedLineHeight === 'comfortable' ? ' active' : ''}" data-value="comfortable">+</button>
                            </div>
                        </div>
                        <div class="digest-settings-group">
                            <div class="digest-settings-label">Theme</div>
                            <div class="digest-settings-options" data-setting="theme">
                                <button class="digest-settings-option${savedTheme === 'light' ? ' active' : ''}" data-value="light">Light</button>
                                <button class="digest-settings-option${savedTheme === 'dark' ? ' active' : ''}" data-value="dark">Dark</button>
                                <button class="digest-settings-option${savedTheme === 'auto' ? ' active' : ''}" data-value="auto">Auto</button>
                            </div>
                        </div>
                        <div class="digest-settings-group">
                            <div class="digest-settings-label">Shortcuts</div>
                            <div class="digest-shortcut-row">
                                <span class="digest-shortcut-label">Large:</span>
                                <input type="text" class="digest-shortcut-input" data-shortcut="large" value="${formatShortcut(shortcuts.large)}" readonly placeholder="Click to set">
                            </div>
                            <div class="digest-shortcut-row">
                                <span class="digest-shortcut-label">Small:</span>
                                <input type="text" class="digest-shortcut-input" data-shortcut="small" value="${formatShortcut(shortcuts.small)}" readonly placeholder="Click to set">
                            </div>
                        </div>
                        <button class="digest-btn inspect-btn">Inspect Elements</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Attach event listeners
    const slideHandle = overlay.querySelector('.digest-slide-handle');
    const dragHandle = overlay.querySelector('.digest-handle');
    const digestBtns = overlay.querySelectorAll('.digest-btn[data-size]');
    const inspectBtn = overlay.querySelector('.inspect-btn');
    const settingsPopover = overlay.querySelector('.digest-settings-popover');
    const settingsBtn = overlay.querySelector('.digest-settings-btn');

    slideHandle.addEventListener('click', (e) => {
        // Close settings popover when collapsing badge
        settingsPopover.classList.remove('open');
        toggleSlide(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage);
    });
    dragHandle.addEventListener('mousedown', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));
    dragHandle.addEventListener('touchstart', (e) => startDrag(e, OVERLAY_COLLAPSED, OVERLAY_POS, storage));

    digestBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.dataset.size;
            onDigest(size);
        });
    });

    inspectBtn.addEventListener('click', onInspect);

    // Badge settings popover

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPopover.classList.toggle('open');
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.digest-badge-settings')) {
            settingsPopover.classList.remove('open');
        }
    });

    // Handle font size changes
    const fontSizeOptions = overlay.querySelectorAll('[data-setting="fontSize"] .digest-settings-option');
    fontSizeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            fontSizeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
            // Apply live to open summary
            if (summaryOverlay && summaryOverlay.isConnected) {
                summaryOverlay.style.setProperty('--digest-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
            }
        });
    });

    // Handle line height changes
    const lineHeightOptions = overlay.querySelectorAll('[data-setting="lineHeight"] .digest-settings-option');
    lineHeightOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            lineHeightOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
            // Apply live to open summary
            if (summaryOverlay && summaryOverlay.isConnected) {
                summaryOverlay.style.setProperty('--digest-line-height', SUMMARY_LINE_HEIGHTS[value]);
            }
        });
    });

    // Handle theme changes
    const themeOptions = overlay.querySelectorAll('[data-setting="theme"] .digest-settings-option');
    themeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            themeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.THEME, value);
            updateAllThemes(value);
        });
    });

    // Listen for system theme changes (for auto mode)
    if (window.matchMedia) {
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
    const shortcutInputs = overlay.querySelectorAll('.digest-shortcut-input');
    shortcutInputs.forEach(input => {
        input.addEventListener('click', () => {
            input.classList.add('recording');
            input.value = 'Press keys...';

            const recordHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Ignore modifier-only keys
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                const shortcut = {
                    key: e.key.toUpperCase(),
                    ctrl: e.ctrlKey,
                    alt: e.altKey,
                    shift: e.shiftKey
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
                const btn = overlay.querySelector(`[data-size="${shortcutType}"]`);
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
        const rightEdgeX = viewportWidth() - BADGE_WIDTH;

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

        const maxX = viewportWidth() - overlay.offsetWidth;
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
export async function showSummaryOverlay(summaryText, mode, container, OVERLAY_COLLAPSED, onRestore, storage) {
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

    summaryOverlay = document.createElement('div');
    summaryOverlay.className = 'digest-summary-overlay';
    summaryOverlay.setAttribute(UI_ATTR, '');

    // Apply CSS custom properties
    summaryOverlay.style.setProperty('--digest-font-size', `${SUMMARY_FONT_SIZES[savedFontSize]}px`);
    summaryOverlay.style.setProperty('--digest-line-height', SUMMARY_LINE_HEIGHTS[savedLineHeight]);

    // Apply theme
    applyTheme(summaryOverlay, currentTheme);

    const sizeLabel = mode.includes('large') ? 'Large' : 'Small';
    const isSelectedText = !container;

    summaryOverlay.innerHTML = `
        <div class="digest-summary-container">
            <div class="digest-summary-header">
                <div class="digest-summary-badge">${escapeHtml(sizeLabel)} Summary${isSelectedText ? ' (Selected Text)' : ''}</div>
                <div class="digest-summary-header-controls">
                    <div class="digest-summary-settings">
                        <button class="digest-summary-settings-btn" title="Display settings">&#9881;</button>
                        <div class="digest-settings-popover digest-summary-popover">
                            <div class="digest-settings-group">
                                <div class="digest-settings-label">Font Size</div>
                                <div class="digest-settings-options" data-setting="fontSize">
                                    <button class="digest-settings-option${savedFontSize === 'small' ? ' active' : ''}" data-value="small">S</button>
                                    <button class="digest-settings-option${savedFontSize === 'default' ? ' active' : ''}" data-value="default">M</button>
                                    <button class="digest-settings-option${savedFontSize === 'large' ? ' active' : ''}" data-value="large">L</button>
                                </div>
                            </div>
                            <div class="digest-settings-group">
                                <div class="digest-settings-label">Spacing</div>
                                <div class="digest-settings-options" data-setting="lineHeight">
                                    <button class="digest-settings-option${savedLineHeight === 'compact' ? ' active' : ''}" data-value="compact">-</button>
                                    <button class="digest-settings-option${savedLineHeight === 'default' ? ' active' : ''}" data-value="default">=</button>
                                    <button class="digest-settings-option${savedLineHeight === 'comfortable' ? ' active' : ''}" data-value="comfortable">+</button>
                                </div>
                            </div>
                            <div class="digest-settings-group">
                                <div class="digest-settings-label">Theme</div>
                                <div class="digest-settings-options" data-setting="theme">
                                    <button class="digest-settings-option${currentTheme === 'light' ? ' active' : ''}" data-value="light">Light</button>
                                    <button class="digest-settings-option${currentTheme === 'dark' ? ' active' : ''}" data-value="dark">Dark</button>
                                    <button class="digest-settings-option${currentTheme === 'auto' ? ' active' : ''}" data-value="auto">Auto</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button class="digest-summary-close" title="Close">&#10005;</button>
                </div>
            </div>
            <div class="digest-summary-content">
                <div class="digest-summary-content-inner">
                    ${summaryText.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
                </div>
            </div>
            <div class="digest-summary-footer">
                <div class="digest-summary-footer-text">Summarize The Web</div>
                <button class="digest-summary-close-btn">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryOverlay);

    const closeBtn = summaryOverlay.querySelector('.digest-summary-close');
    const closeBtnFooter = summaryOverlay.querySelector('.digest-summary-close-btn');

    const closeHandler = () => {
        removeSummaryOverlay();
        if (!isSelectedText) onRestore();
    };

    if (isSelectedText) {
        closeBtn.addEventListener('click', removeSummaryOverlay);
        closeBtnFooter.addEventListener('click', removeSummaryOverlay);
    } else {
        closeBtn.addEventListener('click', closeHandler);
        closeBtnFooter.addEventListener('click', closeHandler);
    }

    // Summary settings popover
    const settingsBtn = summaryOverlay.querySelector('.digest-summary-settings-btn');
    const settingsPopover = summaryOverlay.querySelector('.digest-settings-popover');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPopover.classList.toggle('open');
    });

    // Close popover when clicking outside
    summaryOverlay.querySelector('.digest-summary-container').addEventListener('click', (e) => {
        if (!e.target.closest('.digest-summary-settings')) {
            settingsPopover.classList.remove('open');
        }
    });

    // Handle font size changes
    const fontSizeOptions = summaryOverlay.querySelectorAll('[data-setting="fontSize"] .digest-settings-option');
    fontSizeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            fontSizeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
            summaryOverlay.style.setProperty('--digest-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
            // Sync badge settings if visible
            syncBadgeSetting('fontSize', value);
        });
    });

    // Handle line height changes
    const lineHeightOptions = summaryOverlay.querySelectorAll('[data-setting="lineHeight"] .digest-settings-option');
    lineHeightOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            lineHeightOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
            summaryOverlay.style.setProperty('--digest-line-height', SUMMARY_LINE_HEIGHTS[value]);
            // Sync badge settings if visible
            syncBadgeSetting('lineHeight', value);
        });
    });

    // Handle theme changes
    const themeOptions = summaryOverlay.querySelectorAll('[data-setting="theme"] .digest-settings-option');
    themeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            themeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.THEME, value);
            updateAllThemes(value);
            // Sync badge settings if visible
            syncBadgeSetting('theme', value);
        });
    });

    // Close overlay when clicking backdrop
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
            // Close popover first if open
            if (settingsPopover.classList.contains('open')) {
                settingsPopover.classList.remove('open');
                return;
            }
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
    if (autoCollapsedState) {
        autoCollapsedState.value = false;
        autoCollapsedState = null;
    }
    overlay.classList.remove('collapsed');
    const rightEdgeX = viewportWidth() - BADGE_WIDTH;
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
