/**
 * Selector and domain matching utilities
 */

/**
 * Convert glob pattern to RegExp
 * @param {string} glob - Glob pattern (e.g., "*.example.com")
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
    const esc = s => s.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
    const g = esc(glob).replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
    return new RegExp(`^${g}$`, 'i');
}

/**
 * Convert domain pattern to regex, handling wildcards and regex literals
 * @param {string} pattern - Domain pattern
 * @returns {RegExp|null}
 */
export function domainPatternToRegex(pattern) {
    pattern = pattern.trim();
    if (!pattern) return null;

    // Handle regex literal: /pattern/
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
        try {
            return new RegExp(pattern.slice(1, -1), 'i');
        } catch {
            return null;
        }
    }

    // Handle glob patterns with wildcards
    if (pattern.includes('*') || pattern.includes('?')) {
        return globToRegExp(pattern.replace(/^\.*\*?\./, '*.'));
    }

    // Exact match with subdomain support
    const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\.)${esc}$`, 'i');
}

/**
 * Check if hostname matches any pattern in list
 * @param {string[]} list - List of domain patterns
 * @param {string} hostname - Hostname to check
 * @returns {boolean}
 */
export function listMatchesHost(list, hostname) {
    for (const pattern of list) {
        const regex = domainPatternToRegex(pattern);
        if (regex && regex.test(hostname)) {
            return true;
        }
    }
    return false;
}

/**
 * Compile selector list into CSS selector string
 * @param {string[]} selectors - Array of CSS selectors
 * @returns {string} - Comma-separated selector string
 */
export function compiledSelectors(selectors) {
    return selectors.filter(Boolean).join(',');
}

/**
 * Check if element matches any selector in list
 * @param {Element} el - Element to check
 * @param {string[]} selectorList - List of CSS selectors
 * @returns {string[]} - Matching selectors
 */
export function findMatchingSelectors(el, selectorList) {
    const matches = [];
    for (const sel of selectorList) {
        try {
            if (el.matches(sel)) {
                matches.push(sel);
            }
        } catch (e) {
            // Invalid selector, skip
        }
    }
    return matches;
}

/**
 * Check if element matches any exclusion pattern
 * @param {Element} el - Element to check
 * @param {Object} excludeObj - Object with self and ancestors arrays
 * @returns {Object} - Matching exclusions
 */
export function findMatchingExclusions(el, excludeObj) {
    const matches = { self: [], ancestors: [] };

    if (excludeObj.self) {
        for (const sel of excludeObj.self) {
            try {
                if (el.matches(sel)) {
                    matches.self.push(sel);
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }
    }

    if (excludeObj.ancestors) {
        for (const sel of excludeObj.ancestors) {
            try {
                if (el.closest(sel)) {
                    matches.ancestors.push(sel);
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }
    }

    return matches;
}

/**
 * Generate a CSS selector for an element
 * @param {Element} el - Element to generate selector for
 * @returns {string} - CSS selector
 */
export function generateCSSSelector(el) {
    if (el.id) {
        return `#${CSS.escape(el.id)}`;
    }

    if (el.classList.length > 0) {
        const classes = Array.from(el.classList).map(c => `.${CSS.escape(c)}`).join('');
        return `${el.tagName.toLowerCase()}${classes}`;
    }

    let path = [];
    let current = el;
    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
            selector = `#${CSS.escape(current.id)}`;
            path.unshift(selector);
            break;
        }

        let sibling = current;
        let nth = 1;
        while (sibling.previousElementSibling) {
            sibling = sibling.previousElementSibling;
            if (sibling.tagName === current.tagName) nth++;
        }

        if (nth > 1 || current.nextElementSibling) {
            selector += `:nth-child(${nth})`;
        }

        path.unshift(selector);
        current = current.parentElement;

        if (path.length > 3) break;
    }

    return path.join(' > ');
}
