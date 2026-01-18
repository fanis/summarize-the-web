/**
 * Article extraction logic for Summarize The Web
 */

import { UI_ATTR } from './config.js';
import { log } from './utils.js';

/**
 * Check if element is excluded based on exclusion rules
 */
export function isExcluded(el, EXCLUDE) {
    if (!el) return true;

    // Check if element itself matches exclusion selectors
    if (EXCLUDE.self) {
        for (const sel of EXCLUDE.self) {
            try {
                if (el.matches(sel)) return true;
            } catch {}
        }
    }

    // Check if any ancestor matches exclusion selectors
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
 * Get selected text from the page
 */
export function getSelectedText() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text && text.length > 100) {
        return text;
    }
    return null;
}

/**
 * Extract article body using configured selectors
 */
export function extractArticleBody(SELECTORS, EXCLUDE) {
    let container = null;

    // Try each selector in order
    for (const selector of SELECTORS) {
        try {
            container = document.querySelector(selector);
            if (container) {
                log('Found container with selector:', selector);
                break;
            }
        } catch (e) {
            // Invalid selector, skip
        }
    }

    if (!container) {
        log('No article container found');
        return null;
    }

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

    // Clone container to avoid modifying the DOM
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

    // Get visible text content (innerText for browsers, textContent fallback for jsdom/tests)
    const text = (clone.innerText ?? clone.textContent ?? '').trim();

    if (!text || text.length < 100) {
        log('No text found in container or too little');
        return null;
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
 */
export function getTextToDigest(SELECTORS, EXCLUDE) {
    // First check if user has selected text
    const selected = getSelectedText();
    if (selected) {
        return { text: selected, elements: null, source: 'selection' };
    }

    // Otherwise extract article body
    const article = extractArticleBody(SELECTORS, EXCLUDE);
    if (article) {
        return { text: article.text, elements: article.elements, source: 'article', container: article.container };
    }

    return null;
}
