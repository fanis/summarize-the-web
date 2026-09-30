/**
 * Configuration constants and settings for Summarize The Web
 */

export const CFG = {
    model: 'gpt-6-luna',
    DEBUG: false,
};

export const UI_ATTR = 'data-digest-ui';
export const LOG_PREFIX = '[summarize-the-web]';

// Available models with pricing
// Pricing source: https://developers.openai.com/api/docs/pricing (as of 2026-09-30)
// Note: OpenAI renamed "priority processing" to "Fast mode" on 2026-07-30;
// service_tier "priority" remains a valid API alias. Fast model IDs keep the
// -priority suffix for consistency with stored selections.
// reasoning: the reasoning.effort sent with every request. Valid values differ
// per model family (GPT-5.6/GPT-6 reject 'minimal', GPT-6.1 Sol also rejects
// 'none'), so each entry names its own; '' sends no reasoning parameter.
export const MODEL_OPTIONS = {
    'gpt-6-luna': {
        name: 'GPT-6 Luna',
        apiModel: 'gpt-6-luna',
        description: 'Low cost - Best value for most articles',
        inputPer1M: 0.10,
        outputPer1M: 0.50,
        recommended: true,
        priority: false,
        reasoning: 'low'
    },
    'gpt-6-luna-priority': {
        name: 'GPT-6 Luna Fast',
        apiModel: 'gpt-6-luna',
        description: 'Same model with faster processing',
        inputPer1M: 0.20,
        outputPer1M: 1.00,
        recommended: false,
        priority: true,
        reasoning: 'low'
    },
    'gpt-6.1-sol': {
        name: 'GPT-6.1 Sol',
        apiModel: 'gpt-6.1-sol',
        description: 'Higher quality - Keeps quotes and details more faithfully (about 20x the cost of Luna)',
        inputPer1M: 2.00,
        outputPer1M: 10.00,
        recommended: false,
        priority: false,
        reasoning: 'low'
    }
};

// Identifier for the user-defined model entry in MODEL_OPTIONS
export const CUSTOM_MODEL_ID = 'custom';

// Valid reasoning effort values for the custom model definition
// ('minimal' is for original GPT-5 models; newer models use 'none' instead)
export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

// Display names for model IDs that earlier versions offered, so the model
// change notice can name the user's previous model
export const REMOVED_MODEL_NAMES = {
    'gpt-5-nano': 'GPT-5 Nano',
    'gpt-5-mini': 'GPT-5 Mini',
    'gpt-5.2-priority': 'GPT-5.2 Priority',
    'gpt-5.6-luna': 'GPT-5.6 Luna',
    'gpt-4.1-nano-priority': 'GPT-4.1 Nano Fast',
    'gpt-5-mini-priority': 'GPT-5 Mini Fast',
    'gpt-5.6-terra-priority': 'GPT-5.6 Terra Fast',
    [CUSTOM_MODEL_ID]: 'your custom model'
};

// Default model of versions up to 2.9.x. Those versions did not save the
// default selection, so an existing user with no saved model was using this one.
export const LEGACY_DEFAULT_MODEL = 'gpt-5-nano';

// OpenAI API model IDs with announced shutdown dates
// (https://developers.openai.com/api/docs/deprecations). An active custom model
// using one of them gets a one-time notice once the date has passed.
// gpt-5-nano and gpt-5-mini: OpenAI announced the shutdown of their 2025-08-07
// snapshots, which are the only snapshots behind those aliases.
export const RETIRED_API_MODELS = {
    'gpt-4.1-nano': '2026-10-23',
    'gpt-4.1-nano-2025-04-14': '2026-10-23',
    'gpt-5-nano': '2026-12-11',
    'gpt-5-nano-2025-08-07': '2026-12-11',
    'gpt-5-mini': '2026-12-11',
    'gpt-5-mini-2025-08-07': '2026-12-11'
};

// Storage keys
export const STORAGE_KEYS = {
    OPENAI_KEY: 'OPENAI_KEY',
    CUSTOM_MODEL: 'digest_custom_model_v1',
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
    CACHE: 'digest_cache_v2',
    MODEL: 'digest_model_v1',
    RETIRED_NOTICE: 'digest_retired_notice_v1',
    // Article extraction selectors
    SELECTORS_GLOBAL: 'digest_selectors_v1',
    EXCLUDES_GLOBAL: 'digest_excludes_v1',
    DOMAIN_SELECTORS: 'digest_domain_selectors_v1',
    DOMAIN_EXCLUDES: 'digest_domain_excludes_v1',
    MIN_TEXT_LENGTH: 'digest_min_text_length_v1',
    JUST_ENABLED: 'digest_just_enabled_v1',
    // Display settings
    SUMMARY_FONT_SIZE: 'digest_summary_font_size_v1',
    SUMMARY_LINE_HEIGHT: 'digest_summary_line_height_v1',
    THEME: 'digest_theme_v1',
    SHORTCUT_LARGE: 'digest_shortcut_large_v1',
    SHORTCUT_SMALL: 'digest_shortcut_small_v1',
};

// Theme options
export const THEME_OPTIONS = ['light', 'dark', 'auto'];

// Default keyboard shortcuts
export const DEFAULT_SHORTCUTS = {
    large: { key: 'L', alt: true, shift: true, ctrl: false },
    small: { key: 'S', alt: true, shift: true, ctrl: false }
};

// Summary display settings
export const SUMMARY_FONT_SIZES = {
    small: 15,
    default: 17,
    large: 20
};

export const SUMMARY_LINE_HEIGHTS = {
    compact: 1.5,
    default: 1.8,
    comfortable: 2.1
};

// Minimum text length for extraction (in characters)
export const DEFAULT_MIN_TEXT_LENGTH = 100;

// Default prompts
export const DEFAULT_PROMPTS = {
    summary_large: 'You will receive INPUT as article text. Summarize and simplify the content to approximately 50% of the original length. Make the language clearer and more direct while staying in the SAME language as input. CRITICAL: Do NOT change facts, numbers, names, quotes, or the actual meaning/details of the content. If the text contains direct quotes inside quotation marks, keep that quoted text VERBATIM. Preserve all factual information, statistics, proper nouns, and direct quotes exactly as they appear. Maintain paragraph structure where appropriate. Return ONLY the simplified text without any formatting, code blocks, or JSON.',
    summary_small: 'You will receive INPUT as article text. Create a concise summary at approximately 20% of the original length while staying in the SAME language as input. Focus on the most important points and key facts. CRITICAL: Do NOT change facts, numbers, names, or core meaning. Preserve important quotes, statistics, and proper nouns exactly as they appear. Condense the content aggressively to achieve the 20% length target while maintaining readability. Return ONLY the summary text without any formatting, code blocks, or JSON.'
};

// Simplification style levels
export const SIMPLIFICATION_LEVELS = ['Conservative', 'Balanced', 'Aggressive'];

// Style instructions appended to prompts
export const STYLE_INSTRUCTIONS = {
    'Conservative': ' Minimize rephrasing. Preserve original wording and sentence structure where possible.',
    'Balanced': '',
    'Aggressive': ' Maximize simplification. Use simpler vocabulary and shorter sentences.'
};

// Default article container selectors (ordered by specificity)
export const DEFAULT_SELECTORS = [
    '[itemprop="articleBody"]',
    'article[itemtype*="Article"]',
    '.article-body',
    '.post-content',
    '.entry-content',
    '[class*="article-content"]',
    ':is(div, section, article)[class*="post-body"]',
    // WordPress page builders / themes
    '.elementor-widget-theme-post-content',
    '.wp-block-post-content',
    '.td-post-content',
    '[class*="et_pb_post_content"]',
    // Ghost (Casper and derived themes)
    '.gh-content',
    '.post-full-content',
    // Substack
    '.available-content',
    // Drupal 8+
    '.field--name-body',
    // Shopify blogs (Dawn and BEM-style themes)
    '.article-template__content',
    '.article__content',
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
    model: 'gpt-6-luna',
    inputPer1M: 0.10,
    outputPer1M: 0.50,
    lastUpdated: '2026-09-30',
    source: 'https://developers.openai.com/api/docs/pricing'
};

// Cache settings
export const CACHE_LIMIT = 50;
export const CACHE_TRIM_TO = 30;

// Max output tokens per summary mode
export const MAX_OUTPUT_TOKENS = {
    large: 4000,
    small: 2000
};
