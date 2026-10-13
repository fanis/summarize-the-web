/**
 * Article extraction logic for Summarize The Web
 */

import { UI_ATTR } from './config.js';
import { log } from './utils.js';
import { isExcludedElement, containerExclusions } from './selectors.js';

/**
 * Check if element is excluded based on exclusion rules
 */
export function isExcluded(el, EXCLUDE) {
    if (!el) return true;
    return isExcludedElement(el, EXCLUDE);
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
    // Find UI and excluded elements on the live page, so selectors that
    // depend on ancestors outside the container (e.g. `.comment p`) match the
    // same way as in isExcludedInContainer(), then remove their copies from a
    // clone. Both self and ancestors exclusions drop the whole subtree.
    const excluded = new Set(container.querySelectorAll(`[${UI_ATTR}]`));
    for (const sel of [...(EXCLUDE.self || []), ...(EXCLUDE.ancestors || [])]) {
        try {
            container.querySelectorAll(sel).forEach(el => excluded.add(el));
        } catch {}
    }

    const clone = container.cloneNode(true);
    if (excluded.size) {
        // A deep clone lists its elements in the same order as the original
        const cloneEls = clone.querySelectorAll('*');
        container.querySelectorAll('*').forEach((el, i) => {
            if (excluded.has(el)) cloneEls[i].remove();
        });
    }

    return (clone.innerText ?? clone.textContent ?? '').trim();
}

const textLength = (el) => (el.innerText ?? el.textContent ?? '').trim().length;

/**
 * Collect the container elements one selector matches. Matches that are
 * excluded (see containerExclusions) or nested inside an earlier match are
 * skipped. Site selectors keep every match, so repeated blocks such as forum
 * comments are all summarized. Global selectors are generic (`article` also
 * matches teaser cards), so when one match holds at least 70% of the
 * selector's text, only that match is kept.
 * @returns {Element[]} - Matches in document order
 */
function containerMatches(selector, EXCLUDE, site) {
    const rules = EXCLUDE ? containerExclusions(selector, EXCLUDE, site) : null;
    const elements = [];
    for (const el of document.querySelectorAll(selector)) {
        if (rules && isExcludedElement(el, rules)) continue;
        // Document order: a nested match follows the match that contains it
        const last = elements[elements.length - 1];
        if (last && last.contains(el)) continue;
        elements.push(el);
    }

    if (elements.length > 1 && !site?.selectors?.includes(selector)) {
        const lengths = elements.map(textLength);
        const total = lengths.reduce((a, b) => a + b, 0);
        const max = Math.max(...lengths);
        if (total > 0 && max >= total * 0.7) return [elements[lengths.indexOf(max)]];
    }
    return elements;
}

// Text blocks counted by the density fallback. Only leaf blocks are counted
// (a blockquote wrapping a <p> is skipped in favor of the <p>) so nested
// structures don't inflate totals.
const TEXT_BLOCK_SELECTOR = 'p, li, blockquote, pre';

/**
 * Guess the article container by text density, for pages where no configured
 * selector matches (unrecognized themes, div-soup page builders). Sums the
 * length of every leaf text block into each of its ancestors, then descends
 * from <body> to the deepest element that still holds at least 80% of that
 * text — the tightest wrapper around the main body of the page.
 * @param {number} minLength - Minimum total block text required to guess
 * @param {number} [bodyLength] - Page text length, for the percent stat
 * @returns {Object|null} - Candidate entry { elements, selector, length, percent }
 *   with one element and selector set to '(auto-detected)', or null if there
 *   isn't enough text
 */
export function guessArticleContainer(minLength = 100, bodyLength = 0) {
    if (!bodyLength) {
        bodyLength = (document.body.innerText ?? document.body.textContent ?? '').trim().length || 1;
    }

    const totals = new Map();
    let counted = 0;

    for (const block of document.querySelectorAll(TEXT_BLOCK_SELECTOR)) {
        if (block.querySelector(TEXT_BLOCK_SELECTOR)) continue;
        if (block.closest(`nav, aside, header, footer, [${UI_ATTR}]`)) continue;

        const len = (block.innerText ?? block.textContent ?? '').trim().length;
        // Ignore stubs (menu items, buttons, captions)
        if (len < 25) continue;

        counted += len;
        for (let anc = block.parentElement; anc && anc !== document.documentElement; anc = anc.parentElement) {
            totals.set(anc, (totals.get(anc) || 0) + len);
        }
    }

    if (counted < minLength) return null;

    let container = document.body;
    let descended = true;
    while (descended) {
        descended = false;
        for (const child of container.children) {
            if ((totals.get(child) || 0) >= counted * 0.8) {
                container = child;
                descended = true;
                break;
            }
        }
    }

    const rawText = (container.innerText ?? container.textContent ?? '').trim();
    return {
        elements: [container],
        selector: '(auto-detected)',
        length: rawText.length,
        percent: Math.round((rawText.length / bodyLength) * 100)
    };
}

/**
 * Find and rank article container candidates. Shared by extraction and the
 * summary-highlight inspection view so the dominance heuristic lives in one
 * place. Falls back to a text-density guess when no selector matches
 * anything usable. Each candidate is one selector with all the container
 * elements it matches (see containerMatches).
 * @param {string[]} SELECTORS - CSS selectors to find containers
 * @param {number} minLength - Minimum text length for a significant container
 * @param {Object} [EXCLUDE] - Merged exclusion rules; excluded matches are skipped
 * @param {Object} [site] - { selectors, exclude } for the current site
 * @returns {Object|null} - { selected, candidates } where selected holds one
 *   entry (single container) or several (non-nested containers to combine),
 *   or null when no selector matched and the density fallback found nothing.
 */
export function selectContainers(SELECTORS, minLength = 100, EXCLUDE = null, site = null) {
    // Get total page text for comparison
    const bodyText = (document.body.innerText ?? document.body.textContent ?? '').trim();
    const bodyLength = bodyText.length || 1; // Avoid division by zero

    // Collect all matching candidates with their text stats
    const candidates = [];
    for (const selector of SELECTORS) {
        let elements;
        try {
            elements = containerMatches(selector, EXCLUDE, site);
        } catch (e) {
            // Invalid selector, skip
            continue;
        }
        if (elements.length === 0) continue;

        const length = elements.reduce((sum, el) => sum + textLength(el), 0);
        const percent = Math.round((length / bodyLength) * 100);
        candidates.push({ elements, selector, length, percent });
    }

    if (candidates.length === 0) {
        const guess = guessArticleContainer(minLength, bodyLength);
        return guess ? { selected: [guess], candidates: [guess] } : null;
    }

    // Sort by text length descending
    candidates.sort((a, b) => b.length - a.length);
    const best = candidates[0];

    // Every configured match is below the minimum (e.g. an empty <article>
    // teaser) — a density guess that finds more text is a better bet.
    if (best.length < minLength) {
        const guess = guessArticleContainer(minLength, bodyLength);
        if (guess && guess.length > best.length) {
            return { selected: [guess], candidates: [guess, ...candidates] };
        }
    }

    // Check if one container is dominant (>70% of page, and next best is <50% of best)
    const dominated = best.percent > 70 && (candidates.length < 2 || candidates[1].percent < best.percent * 0.5);
    if (dominated) {
        return { selected: [best], candidates };
    }

    // Multiple significant containers - combine non-nested ones
    const significant = candidates.filter(c => c.percent >= 15 && c.length > minLength);
    const overlaps = (a, b) => a.elements.some(x => b.elements.some(y => x.contains(y) || y.contains(x)));
    const nonNested = significant.filter((c, i) =>
        !significant.some((other, j) => i !== j && overlaps(c, other))
    );

    return { selected: nonNested.length > 1 ? nonNested : [best], candidates };
}

/**
 * Extract article body using configured selectors
 * @param {string[]} SELECTORS - CSS selectors to find container
 * @param {Object} EXCLUDE - Exclusion rules
 * @param {number} minLength - Minimum text length required
 * @param {Object} [site] - { selectors, exclude } for the current site
 * @returns {Object|null} - { text, container, title } or { error, ... } or null
 */
export function extractArticleBody(SELECTORS, EXCLUDE, minLength = 100, site = null) {
    const selection = selectContainers(SELECTORS, minLength, EXCLUDE, site);
    if (!selection) {
        log('No article container found');
        return { error: 'no_container' };
    }
    const { selected, candidates } = selection;

    // Log top candidates for debugging
    const topCandidates = candidates.slice(0, 5).filter(c => c.length > 0);
    if (topCandidates.length > 1) {
        log('Container candidates:', topCandidates.map(c => `${c.selector} (${c.percent}%)`).join(', '));
    }

    // Cleaned text of every element of the given candidates, in order
    const joinText = (cands) => cands
        .flatMap(c => c.elements)
        .map(el => cleanContainerText(el, EXCLUDE))
        .filter(Boolean)
        .join('\n\n');

    if (selected.length > 1) {
        // Combine cleaned text from multiple containers
        const combinedText = joinText(selected);
        log('Combined', selected.length, 'containers:', selected.map(c => c.selector).join(', '));

        if (combinedText.length < minLength) {
            log(`Combined text too short: ${combinedText.length} < ${minLength}`);
            return { error: 'article_too_short', actualLength: combinedText.length, minLength };
        }

        log(`Extracted ${combinedText.length} characters from combined containers`);
        return { text: combinedText, elements: null, container: selected[0].elements[0], title: null };
    }

    const best = selected[0];
    const container = best.elements[0];
    log('Selected container:', best.selector, `(${best.elements.length} match${best.elements.length === 1 ? '' : 'es'})`,
        'with', best.length, 'chars', `(${best.percent}% of page)`);

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

    // Get cleaned text from all matches of the container selector
    const text = joinText([best]);

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
 * @param {Object} [site] - { selectors, exclude } for the current site
 * @returns {Object} - { text, source, ... } or { error, ... }
 */
export function getTextToDigest(SELECTORS, EXCLUDE, minLength = 100, site = null) {
    // First check if user has selected text
    const selected = getSelectedText(minLength);
    if (selected) {
        if (selected.error) {
            return { error: selected.error, actualLength: selected.actualLength, minLength, source: 'selection' };
        }
        return { text: selected.text, elements: null, source: 'selection' };
    }

    // Otherwise extract article body
    const article = extractArticleBody(SELECTORS, EXCLUDE, minLength, site);
    if (article.error) {
        return { error: article.error, actualLength: article.actualLength, minLength, source: 'article' };
    }

    return { text: article.text, elements: article.elements, source: 'article', container: article.container };
}
