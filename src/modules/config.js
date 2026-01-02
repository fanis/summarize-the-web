/**
 * Configuration constants and settings for Summarize The Web
 */

export const CFG = {
    model: 'gpt-5-nano',
    temperature: 0.2,
    DEBUG: false,
};

export const UI_ATTR = 'data-digest-ui';
export const LOG_PREFIX = '[summarize-the-web]';

// Available models with pricing
// Pricing source: https://openai.com/api/pricing/ (as of 2025-12-18)
export const MODEL_OPTIONS = {
    'gpt-5-nano': {
        name: 'GPT-5 Nano',
        apiModel: 'gpt-5-nano',
        description: 'Ultra-affordable latest generation - Best value for most articles',
        inputPer1M: 0.05,
        outputPer1M: 0.40,
        recommended: true,
        priority: false
    },
    'gpt-5-mini': {
        name: 'GPT-5 Mini',
        apiModel: 'gpt-5-mini',
        description: 'Better quality, still very affordable',
        inputPer1M: 0.25,
        outputPer1M: 2.00,
        recommended: false,
        priority: false
    },
    'gpt-4.1-nano-priority': {
        name: 'GPT-4.1 Nano Priority',
        apiModel: 'gpt-4.1-nano',
        description: 'Faster processing - Cheaper than regular GPT-5 Mini',
        inputPer1M: 0.20,
        outputPer1M: 0.80,
        recommended: false,
        priority: true
    },
    'gpt-5-mini-priority': {
        name: 'GPT-5 Mini Priority',
        apiModel: 'gpt-5-mini',
        description: 'Better quality + faster processing',
        inputPer1M: 0.45,
        outputPer1M: 3.60,
        recommended: false,
        priority: true
    },
    'gpt-5.2-priority': {
        name: 'GPT-5.2 Priority',
        apiModel: 'gpt-5.2',
        description: 'Premium quality + fastest processing (most expensive)',
        inputPer1M: 2.50,
        outputPer1M: 20.00,
        recommended: false,
        priority: true
    }
};

// Storage keys
export const STORAGE_KEYS = {
    OPENAI_KEY: 'OPENAI_KEY',
    DOMAINS_MODE: 'digest_domains_mode_v1',
    DOMAINS_DENY: 'digest_domains_excluded_v1',
    DOMAINS_ALLOW: 'digest_domains_enabled_v1',
    DEBUG: 'digest_debug_v1',
    SIMPLIFICATION_STRENGTH: 'digest_simplification_v1',
    AUTO_SIMPLIFY: 'digest_auto_simplify_v1',
    CUSTOM_PROMPT: 'digest_custom_prompt_v1',
    OVERLAY_POS: 'digest_overlay_pos_v1',
    OVERLAY_COLLAPSED: 'digest_overlay_collapsed_v1',
    FIRST_INSTALL: 'digest_installed_v1',
    API_TOKENS: 'digest_api_tokens_v1',
    PRICING: 'digest_pricing_v1',
    CACHE: 'digest_cache_v1',
    MODEL: 'digest_model_v1',
    // Article extraction selectors
    SELECTORS_GLOBAL: 'digest_selectors_v1',
    EXCLUDES_GLOBAL: 'digest_excludes_v1',
    DOMAIN_SELECTORS: 'digest_domain_selectors_v1',
    DOMAIN_EXCLUDES: 'digest_domain_excludes_v1',
};

// Default prompts
export const DEFAULT_PROMPTS = {
    summary_large: 'You will receive INPUT as article text. Summarize and simplify the content to approximately 50% of the original length. Make the language clearer and more direct while staying in the SAME language as input. CRITICAL: Do NOT change facts, numbers, names, quotes, or the actual meaning/details of the content. If the text contains direct quotes inside quotation marks, keep that quoted text VERBATIM. Preserve all factual information, statistics, proper nouns, and direct quotes exactly as they appear. Maintain paragraph structure where appropriate. Return ONLY the simplified text without any formatting, code blocks, or JSON.',
    summary_small: 'You will receive INPUT as article text. Create a concise summary at approximately 20% of the original length while staying in the SAME language as input. Focus on the most important points and key facts. CRITICAL: Do NOT change facts, numbers, names, or core meaning. Preserve important quotes, statistics, and proper nouns exactly as they appear. Condense the content aggressively to achieve the 20% length target while maintaining readability. Return ONLY the summary text without any formatting, code blocks, or JSON.'
};

// Simplification style levels (controls how aggressively language is simplified)
export const SIMPLIFICATION_LEVELS = {
    'Conservative': 0.1,
    'Balanced': 0.2,
    'Aggressive': 0.4
};
export const SIMPLIFICATION_ORDER = ['Conservative', 'Balanced', 'Aggressive'];

// Default article container selectors (ordered by specificity)
export const DEFAULT_SELECTORS = [
    '[itemprop="articleBody"]',
    'article[itemtype*="Article"]',
    '.article-body',
    '.post-content',
    '.entry-content',
    '[class*="article-content"]',
    ':is(div, section, article)[class*="post-body"]',
    // Greek news sites
    '[class*="articleContainer"] .cnt',
    '[class*="articleContainer"]',
    '.story-content',
    '.story-body',
    // Generic fallbacks
    'article',
    'main',
    '[role="main"]'
];

// Default exclusions (elements to skip when extracting text)
export const DEFAULT_EXCLUDES = {
    self: [],
    ancestors: [
        '.comment', '.comments', '.sidebar', '.navigation', '.menu',
        '.footer', '.header', 'nav', 'aside', '.related', '.recommended',
        '.advertisement', '.ad', '.social-share', '.author-bio'
    ]
};

// Default API pricing
export const DEFAULT_PRICING = {
    model: 'gpt-5-nano',
    inputPer1M: 0.05,
    outputPer1M: 0.40,
    lastUpdated: '2025-12-18',
    source: 'https://openai.com/api/pricing/'
};

// Cache settings
export const CACHE_LIMIT = 50;
export const CACHE_TRIM_TO = 30;
