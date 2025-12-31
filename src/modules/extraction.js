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

    // Extract text-containing elements (p, li, blockquote, figcaption, etc.)
    const textSelectors = 'p, li, blockquote, figcaption, dd, dt';
    const elements = Array.from(container.querySelectorAll(textSelectors));

    const filtered = elements.filter(el => {
        const text = el.textContent.trim();

        // Filter by length
        if (text.length < 40) return false;

        // Exclude UI elements
        if (el.closest(`[${UI_ATTR}]`)) return false;

        // Check against exclusion rules
        if (isExcluded(el, EXCLUDE)) return false;

        // Exclude if nested inside another text element we're already capturing
        const parent = el.parentElement;
        if (parent && parent.closest(textSelectors) && elements.includes(parent.closest(textSelectors))) {
            return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        log('No text elements found in container');
        return null;
    }

    log(`Found ${filtered.length} text elements`);

    return {
        text: filtered.map(el => el.textContent.trim()).join('\n\n'),
        elements: filtered,
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
