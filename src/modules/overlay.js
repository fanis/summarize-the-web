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
    applyTheme(summaryOverlay, theme);
}

/**
 * Sync badge settings UI when changed from summary overlay
 */
function syncBadgeSetting(setting, value) {
    if (!overlay) return;
    const options = overlay.querySelectorAll(`[data-setting="${setting}"] .summarizer-settings-option`);
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
    if (document.getElementById('summarizer-style')) return;
    const style = document.createElement('style');
    style.id = 'summarizer-style';
    style.textContent = `
        #summarizer-overlay-singleton.summarizer-overlay {
            position: fixed !important;
            z-index: 2147483646 !important;
            font: 13px/1.4 system-ui, sans-serif !important;
            color: #1a1a1a !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border: 1px solid #5568d3 !important;
            border-radius: 10px !important;
            box-shadow: 0 6px 22px rgba(0,0,0,.18) !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            width: 150px !important;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-radius 0.3s ease !important;
            user-select: none !important;
            right: 0 !important;
            transform: translateX(0) !important;
        }
        #summarizer-overlay-singleton.summarizer-overlay.collapsed {
            transform: translateX(100%) !important;
            border-right: none !important;
            border-radius: 10px 0 0 10px !important;
            box-shadow: -4px 0 22px rgba(0,0,0,.18) !important;
        }
        #summarizer-overlay-singleton.summarizer-overlay.dragging {
            transition: none !important;
            cursor: grabbing !important;
        }
        #summarizer-overlay-singleton .summarizer-slide-handle {
            position: absolute !important;
            left: -28px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 28px !important;
            height: 56px !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border: 1px solid #5568d3 !important;
            border-right: none !important;
            border-radius: 8px 0 0 8px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            color: #fff !important;
            box-shadow: -3px 0 12px rgba(0,0,0,.12) !important;
            transition: width 0.2s ease, left 0.2s ease, box-shadow 0.2s ease !important;
        }
        #summarizer-overlay-singleton .summarizer-slide-handle:hover {
            width: 30px !important;
            left: -30px !important;
            box-shadow: -4px 0 16px rgba(0,0,0,.18) !important;
        }
        #summarizer-overlay-singleton .summarizer-handle {
            background: rgba(255,255,255,0.2) !important;
            padding: 10px 12px !important;
            cursor: grab !important;
            border-radius: 9px 9px 0 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-bottom: 1px solid rgba(255,255,255,0.3) !important;
        }
        #summarizer-overlay-singleton.collapsed .summarizer-handle {
            border-radius: 9px 0 0 0 !important;
        }
        #summarizer-overlay-singleton .summarizer-handle:active {
            cursor: grabbing !important;
        }
        #summarizer-overlay-singleton .summarizer-title {
            font-weight: 600 !important;
            font-size: 14px !important;
            color: #fff !important;
            margin: 0 !important;
            text-align: center !important;
        }
        #summarizer-overlay-singleton .summarizer-content {
            padding: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            background: rgba(255,255,255,0.95) !important;
            border-radius: 0 0 9px 9px !important;
        }
        #summarizer-overlay-singleton.collapsed .summarizer-content {
            border-radius: 0 0 0 9px !important;
        }
        #summarizer-overlay-singleton .summarizer-section {
            margin: 0 !important;
            padding: 0 !important;
        }
        #summarizer-overlay-singleton .summarizer-section-title {
            font-size: 11px !important;
            font-weight: 600 !important;
            color: #667eea !important;
            margin: 0 0 6px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }
        #summarizer-overlay-singleton .summarizer-buttons {
            display: flex !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
        }
        #summarizer-overlay-singleton .summarizer-btn {
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
        #summarizer-overlay-singleton .summarizer-btn:hover {
            background: #667eea !important;
            color: #fff !important;
        }
        #summarizer-overlay-singleton .summarizer-btn:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
        }
        #summarizer-overlay-singleton .summarizer-btn.active {
            background: #667eea !important;
            color: #fff !important;
            font-weight: 600 !important;
        }
        #summarizer-overlay-singleton .summarizer-footer {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
        }
        #summarizer-overlay-singleton .summarizer-status {
            font-size: 10px !important;
            color: #666 !important;
            margin: 0 !important;
            flex: 1 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }
        #summarizer-overlay-singleton .summarizer-badge-settings {
            position: relative !important;
        }
        #summarizer-overlay-singleton .summarizer-badge-settings .summarizer-settings-btn {
            min-width: 24px !important;
            width: 24px !important;
            height: 24px !important;
            flex: none !important;
            padding: 4px !important;
            font-size: 12px !important;
        }
        #summarizer-overlay-singleton .summarizer-badge-settings .summarizer-settings-popover {
            right: 0 !important;
            bottom: 28px !important;
            top: auto !important;
            min-width: 160px !important;
        }
        #summarizer-overlay-singleton .summarizer-badge-settings .selectors-btn,
        #summarizer-overlay-singleton .summarizer-badge-settings .inspect-btn,
        #summarizer-overlay-singleton .summarizer-badge-settings .highlight-btn {
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
        #summarizer-overlay-singleton .summarizer-badge-settings .inspect-btn,
        #summarizer-overlay-singleton .summarizer-badge-settings .highlight-btn {
            margin-top: 4px !important;
            padding-top: 8px !important;
            border-top: none !important;
        }
        #summarizer-overlay-singleton .summarizer-badge-settings .selectors-btn:hover,
        #summarizer-overlay-singleton .summarizer-badge-settings .inspect-btn:hover,
        #summarizer-overlay-singleton .summarizer-badge-settings .highlight-btn:hover {
            background: #f3f4f6 !important;
            color: #4338ca !important;
        }
        #summarizer-overlay-singleton .summarizer-branding {
            font-size: 8px !important;
            color: rgba(255,255,255,0.6) !important;
            text-align: center !important;
            padding: 2px 0 0 0 !important;
            margin: 0 !important;
            letter-spacing: 0.3px !important;
        }

        /* Summary Overlay Styles */
        .summarizer-summary-overlay {
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
            animation: summarizer-summary-fadein 0.3s ease !important;
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
            padding: 0 !important;
            box-sizing: border-box !important;
        }

        .summarizer-summary-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            padding: 16px 20px !important;
            border-radius: 13px 13px 0 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
        }

        .summarizer-summary-badge {
            font: 600 16px/1.2 system-ui, sans-serif !important;
            color: #fff !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .summarizer-summary-close {
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

        .summarizer-summary-close:hover {
            background: rgba(255, 255, 255, 0.3) !important;
            transform: scale(1.05) !important;
        }

        .summarizer-summary-content {
            padding: 28px 40px !important;
            font: var(--summarizer-font-size, 17px)/var(--summarizer-line-height, 1.8) system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            color: #2d3748 !important;
            max-height: calc(90vh - 180px) !important;
            overflow-y: auto !important;
        }

        .summarizer-summary-content-inner {
            max-width: 680px !important;
            margin: 0 auto !important;
        }

        .summarizer-summary-content p {
            margin: 0 0 1.25em 0 !important;
            text-align: left !important;
            word-spacing: 0.05em !important;
            letter-spacing: 0.01em !important;
        }

        .summarizer-summary-content p:last-child {
            margin-bottom: 0 !important;
        }

        .summarizer-summary-footer {
            padding: 16px 20px !important;
            background: rgba(102, 126, 234, 0.05) !important;
            border-top: 1px solid rgba(102, 126, 234, 0.15) !important;
            border-radius: 0 0 13px 13px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .summarizer-summary-footer-text {
            font: 400 11px/1.2 system-ui, sans-serif !important;
            color: #999 !important;
            letter-spacing: 0.3px !important;
        }

        .summarizer-summary-restore,
        .summarizer-summary-close-btn {
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

        .summarizer-summary-restore:hover,
        .summarizer-summary-close-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
        }

        .summarizer-summary-header-controls {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .summarizer-summary-settings {
            position: relative !important;
        }

        .summarizer-summary-settings-btn {
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

        .summarizer-summary-settings-btn:hover {
            background: rgba(255, 255, 255, 0.3) !important;
        }

        .summarizer-summary-popover {
            position: absolute !important;
            top: 40px !important;
            right: 0 !important;
            min-width: 180px !important;
            background: #fff !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 10px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
            padding: 16px !important;
            z-index: 10 !important;
            display: none !important;
        }

        .summarizer-summary-popover.open {
            display: block !important;
        }

        .summarizer-summary-overlay .summarizer-settings-group {
            margin-bottom: 14px !important;
        }

        .summarizer-summary-overlay .summarizer-settings-group:last-child {
            margin-bottom: 0 !important;
        }

        .summarizer-summary-overlay .summarizer-settings-label {
            font: 600 11px/1.2 system-ui, sans-serif !important;
            color: #667eea !important;
            margin: 0 0 8px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        .summarizer-summary-overlay .summarizer-settings-options {
            display: flex !important;
            gap: 4px !important;
        }

        .summarizer-summary-overlay .summarizer-settings-option {
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

        .summarizer-summary-overlay .summarizer-settings-option:hover {
            border-color: #667eea !important;
            color: #667eea !important;
        }

        .summarizer-summary-overlay .summarizer-settings-option.active {
            background: #667eea !important;
            border-color: #667eea !important;
            color: #fff !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-popover {
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

        #summarizer-overlay-singleton .summarizer-settings-popover.open {
            display: block !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-group {
            margin-bottom: 14px !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-group:last-child {
            margin-bottom: 0 !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-label {
            font: 600 11px/1.2 system-ui, sans-serif !important;
            color: #667eea !important;
            margin: 0 0 8px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-options {
            display: flex !important;
            gap: 4px !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-option {
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

        #summarizer-overlay-singleton .summarizer-settings-option:hover {
            border-color: #667eea !important;
            color: #667eea !important;
        }

        #summarizer-overlay-singleton .summarizer-settings-option.active {
            background: #667eea !important;
            border-color: #667eea !important;
            color: #fff !important;
        }

        #summarizer-overlay-singleton .summarizer-shortcut-row {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
        }
        #summarizer-overlay-singleton .summarizer-shortcut-row:last-child {
            margin-bottom: 0 !important;
        }
        #summarizer-overlay-singleton .summarizer-shortcut-label {
            font: 500 11px/1.2 system-ui, sans-serif !important;
            color: #666 !important;
            min-width: 40px !important;
        }
        #summarizer-overlay-singleton .summarizer-shortcut-input {
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
        #summarizer-overlay-singleton .summarizer-shortcut-input:focus {
            outline: none !important;
            border-color: #667eea !important;
            background: #f0f4ff !important;
        }
        #summarizer-overlay-singleton .summarizer-shortcut-input.recording {
            border-color: #f59e0b !important;
            background: #fffbeb !important;
            animation: summarizer-pulse 1s infinite !important;
        }
        @keyframes summarizer-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        /* Dark mode for shortcuts */
        #summarizer-overlay-singleton.summarizer-dark .summarizer-shortcut-label {
            color: #9ca3af !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-shortcut-input {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #e5e7eb !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-shortcut-input:focus {
            border-color: #6366f1 !important;
            background: #1e1b4b !important;
        }

        /* Dark mode styles */
        #summarizer-overlay-singleton.summarizer-overlay.summarizer-dark {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
            border-color: #4338ca !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-slide-handle {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
            border-color: #4338ca !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-content {
            background: rgba(30, 27, 75, 0.95) !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-btn {
            background: #1e1b4b !important;
            border-color: #6366f1 !important;
            color: #a5b4fc !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-btn:hover {
            background: #6366f1 !important;
            color: #fff !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-btn.active {
            background: #6366f1 !important;
            color: #fff !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-status {
            color: #9ca3af !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .selectors-btn,
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .inspect-btn,
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .highlight-btn {
            border-top-color: #374151 !important;
            color: #d1d5db !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .selectors-btn:hover,
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .inspect-btn:hover,
        #summarizer-overlay-singleton.summarizer-dark .summarizer-badge-settings .highlight-btn:hover {
            background: #374151 !important;
            color: #a5b4fc !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-settings-popover {
            background: #1f2937 !important;
            border-color: #374151 !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-settings-label {
            color: #a5b4fc !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-settings-option {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #d1d5db !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-settings-option:hover {
            border-color: #6366f1 !important;
            color: #a5b4fc !important;
        }
        #summarizer-overlay-singleton.summarizer-dark .summarizer-settings-option.active {
            background: #6366f1 !important;
            border-color: #6366f1 !important;
            color: #fff !important;
        }

        /* Dark mode for summary overlay */
        .summarizer-summary-overlay.summarizer-dark {
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
            border-color: #4338ca !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-header {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-content {
            color: #e5e7eb !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-footer {
            background: rgba(30, 27, 75, 0.3) !important;
            border-top-color: rgba(99, 102, 241, 0.3) !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-footer-text {
            color: #6b7280 !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-close-btn {
            background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%) !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-summary-popover {
            background: #1f2937 !important;
            border-color: #374151 !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-label {
            color: #a5b4fc !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option {
            background: #374151 !important;
            border-color: #4b5563 !important;
            color: #d1d5db !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option:hover {
            border-color: #6366f1 !important;
            color: #a5b4fc !important;
        }
        .summarizer-summary-overlay.summarizer-dark .summarizer-settings-option.active {
            background: #6366f1 !important;
            border-color: #6366f1 !important;
            color: #fff !important;
        }
    `;
    document.head.appendChild(style);
}

const OVERLAY_ID = 'summarizer-overlay-singleton';

const CREATION_LOCK_ATTR = 'data-summarizer-creating';

/**
 * Create the main overlay
 */
export async function createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors) {
    // Check for existing overlays (can be duplicates if script runs multiple times)
    const existingOverlays = document.querySelectorAll(`#${OVERLAY_ID}`);

    if (existingOverlays.length > 1) {
        // Multiple overlays exist - remove all and recreate
        existingOverlays.forEach(el => el.remove());
        overlay = null;
    } else if (existingOverlays.length === 1) {
        // Single overlay exists - reuse it
        overlay = existingOverlays[0];
        return overlay;
    }

    // Also check module variable
    if (overlay && overlay.isConnected) return overlay;

    // DOM-based lock to prevent race conditions across script contexts
    if (document.body.hasAttribute(CREATION_LOCK_ATTR)) return null;
    document.body.setAttribute(CREATION_LOCK_ATTR, 'true');

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
    overlay.id = OVERLAY_ID;
    overlay.className = OVERLAY_COLLAPSED.value ? 'summarizer-overlay collapsed' : 'summarizer-overlay';
    overlay.setAttribute(UI_ATTR, '');

    // Apply theme
    applyTheme(overlay, savedTheme);

    // Set initial position - always anchored to right edge
    const maxY = window.innerHeight - 200;
    OVERLAY_POS.y = Math.max(0, Math.min(OVERLAY_POS.y, maxY));

    overlay.style.top = `${OVERLAY_POS.y}px`;
    overlay.style.right = '0px';

    overlay.innerHTML = `
        <div class="summarizer-slide-handle" title="${OVERLAY_COLLAPSED.value ? 'Open' : 'Close'}">
            ${OVERLAY_COLLAPSED.value ? '◀' : '▶'}
        </div>
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
    `;

    document.body.appendChild(overlay);

    // Attach event listeners
    const slideHandle = overlay.querySelector('.summarizer-slide-handle');
    const dragHandle = overlay.querySelector('.summarizer-handle');
    const digestBtns = overlay.querySelectorAll('.summarizer-btn[data-size]');
    const inspectBtn = overlay.querySelector('.inspect-btn');
    const settingsPopover = overlay.querySelector('.summarizer-settings-popover');
    const settingsBtn = overlay.querySelector('.summarizer-settings-btn');

    slideHandle.addEventListener('click', (e) => {
        // Close settings popover when collapsing badge
        settingsPopover?.classList.remove('open');
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

    const selectorsBtn = overlay.querySelector('.selectors-btn');
    selectorsBtn.addEventListener('click', () => {
        settingsPopover?.classList.remove('open');
        onEditSelectors?.();
    });

    inspectBtn.addEventListener('click', () => {
        settingsPopover?.classList.remove('open');
        onInspect();
    });

    const highlightBtn = overlay.querySelector('.highlight-btn');
    highlightBtn.addEventListener('click', () => {
        settingsPopover?.classList.remove('open');
        onSummaryHighlight?.();
    });

    // Badge settings popover

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPopover.classList.toggle('open');
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.summarizer-badge-settings')) {
            settingsPopover.classList.remove('open');
        }
    });

    // Handle font size changes
    const fontSizeOptions = overlay.querySelectorAll('[data-setting="fontSize"] .summarizer-settings-option');
    fontSizeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            fontSizeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
            // Apply live to open summary
            if (summaryOverlay && summaryOverlay.isConnected) {
                summaryOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
            }
        });
    });

    // Handle line height changes
    const lineHeightOptions = overlay.querySelectorAll('[data-setting="lineHeight"] .summarizer-settings-option');
    lineHeightOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            lineHeightOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
            // Apply live to open summary
            if (summaryOverlay && summaryOverlay.isConnected) {
                summaryOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[value]);
            }
        });
    });

    // Handle theme changes
    const themeOptions = overlay.querySelectorAll('[data-setting="theme"] .summarizer-settings-option');
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
    const shortcutInputs = overlay.querySelectorAll('.summarizer-shortcut-input');
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

    document.body.removeAttribute(CREATION_LOCK_ATTR);
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

    const handle = overlay.querySelector('.summarizer-slide-handle');
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
export function updateOverlayStatus(status, mode = null, fromCache = false) {
    if (!overlay) return;

    const statusEl = overlay.querySelector('.summarizer-status');
    const digestBtns = overlay.querySelectorAll('.summarizer-btn[data-size]');

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
    summaryOverlay.className = 'summarizer-summary-overlay';
    summaryOverlay.setAttribute(UI_ATTR, '');

    // Apply CSS custom properties
    summaryOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[savedFontSize]}px`);
    summaryOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[savedLineHeight]);

    // Apply theme
    applyTheme(summaryOverlay, currentTheme);

    const sizeLabel = mode.includes('large') ? 'Large' : 'Small';
    const isSelectedText = !container;

    summaryOverlay.innerHTML = `
        <div class="summarizer-summary-container">
            <div class="summarizer-summary-header">
                <div class="summarizer-summary-badge">${escapeHtml(sizeLabel)} Summary${isSelectedText ? ' (Selected Text)' : ''}</div>
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
    `;

    document.body.appendChild(summaryOverlay);

    const closeBtn = summaryOverlay.querySelector('.summarizer-summary-close');
    const closeBtnFooter = summaryOverlay.querySelector('.summarizer-summary-close-btn');

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
    const settingsBtn = summaryOverlay.querySelector('.summarizer-summary-settings-btn');
    const settingsPopover = summaryOverlay.querySelector('.summarizer-settings-popover');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPopover.classList.toggle('open');
    });

    // Close popover when clicking outside
    summaryOverlay.querySelector('.summarizer-summary-container').addEventListener('click', (e) => {
        if (!e.target.closest('.summarizer-summary-settings')) {
            settingsPopover.classList.remove('open');
        }
    });

    // Handle font size changes
    const fontSizeOptions = summaryOverlay.querySelectorAll('[data-setting="fontSize"] .summarizer-settings-option');
    fontSizeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            fontSizeOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_FONT_SIZE, value);
            summaryOverlay.style.setProperty('--summarizer-font-size', `${SUMMARY_FONT_SIZES[value]}px`);
            // Sync badge settings if visible
            syncBadgeSetting('fontSize', value);
        });
    });

    // Handle line height changes
    const lineHeightOptions = summaryOverlay.querySelectorAll('[data-setting="lineHeight"] .summarizer-settings-option');
    lineHeightOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            lineHeightOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            storage.set(STORAGE_KEYS.SUMMARY_LINE_HEIGHT, value);
            summaryOverlay.style.setProperty('--summarizer-line-height', SUMMARY_LINE_HEIGHTS[value]);
            // Sync badge settings if visible
            syncBadgeSetting('lineHeight', value);
        });
    });

    // Handle theme changes
    const themeOptions = summaryOverlay.querySelectorAll('[data-setting="theme"] .summarizer-settings-option');
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
    overlay.style.right = '0px';
    const handle = overlay.querySelector('.summarizer-slide-handle');
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
    const handle = overlay.querySelector('.summarizer-slide-handle');
    if (handle) {
        handle.textContent = '▶';
        handle.title = 'Close';
    }
}

/**
 * Ensure overlay exists (recreate if removed)
 */
export function ensureOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors) {
    if (!overlay || !overlay.isConnected) {
        createOverlay(OVERLAY_COLLAPSED, OVERLAY_POS, storage, onDigest, onInspect, onSummaryHighlight, onEditSelectors);
    }
}

/**
 * Get current overlay reference
 */
export function getOverlay() {
    return overlay;
}
