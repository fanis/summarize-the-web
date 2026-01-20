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
 * @param {number} minLength - Minimum text length required
 * @returns {Object|null} - { text } or { error, actualLength } or null if no selection
 */
export function getSelectedText(minLength = 100) {
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

/**
 * Extract article body using configured selectors
 * @param {string[]} SELECTORS - CSS selectors to find container
 * @param {Object} EXCLUDE - Exclusion rules
 * @param {number} minLength - Minimum text length required
 * @returns {Object|null} - { text, container, title } or { error, ... } or null
 */
export function extractArticleBody(SELECTORS, EXCLUDE, minLength = 100) {
    let container = null;

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

            candidates.push({ candidate, selector, text: rawText, length: rawText.length, percent });
        } catch (e) {
            // Invalid selector, skip
        }
    }

    if (candidates.length === 0) {
        log('No article container found');
        return { error: 'no_container' };
    }

    // Sort by text length descending
    candidates.sort((a, b) => b.length - a.length);

    // Log top candidates for debugging
    const topCandidates = candidates.slice(0, 5).filter(c => c.length > 0);
    if (topCandidates.length > 1) {
        log('Container candidates:', topCandidates.map(c => `${c.selector} (${c.percent}%)`).join(', '));
    }

    const best = candidates[0];

    // Check if one container is dominant (>70% of page, and next best is <50% of best)
    const dominated = best.percent > 70 && (candidates.length < 2 || candidates[1].percent < best.percent * 0.5);

    if (dominated) {
        container = best.candidate;
        log('Selected container:', best.selector, '(dominant, ' + best.percent + '% of page)');
    } else {
        // Multiple significant containers - combine non-nested ones
        const significant = candidates.filter(c => c.percent >= 15 && c.length > minLength);

        // Filter out nested containers (keep only if not ancestor/descendant of another)
        const nonNested = significant.filter((c, i) =>
            !significant.some((other, j) => i !== j &&
                (other.candidate.contains(c.candidate) || c.candidate.contains(other.candidate))
            )
        );

        if (nonNested.length > 1) {
            // Combine cleaned text from multiple containers
            const combinedTexts = nonNested.map(c => cleanContainerText(c.candidate, EXCLUDE));
            const combinedText = combinedTexts.join('\n\n');
            log('Combined', nonNested.length, 'containers:', nonNested.map(c => c.selector).join(', '));

            if (combinedText.length < minLength) {
                log(`Combined text too short: ${combinedText.length} < ${minLength}`);
                return { error: 'article_too_short', actualLength: combinedText.length, minLength };
            }

            log(`Extracted ${combinedText.length} characters from combined containers`);
            return { text: combinedText, elements: null, container: nonNested[0].candidate, title: null };
        }

        container = best.candidate;
        log('Selected container:', best.selector, 'with', best.length, 'chars', `(${best.percent}% of page)`);
    }

    if (!container) {
        log('No article container found');
        return { error: 'no_container' };
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
export function getTextToDigest(SELECTORS, EXCLUDE, minLength = 100) {
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
