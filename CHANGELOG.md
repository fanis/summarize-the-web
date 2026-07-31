# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Model selection dialog taller than the viewport (since the custom model fields were added) could clip the Save/Cancel buttons with no way to scroll to them; the dialog now caps at 90% of the viewport height and scrolls internally

## [2.9.0] - 2026-07-31

### Added
- **Custom model**: the model selection dialog now includes a "Custom model" option where you can enter any OpenAI model ID with your own input/output prices per 1M tokens, a reasoning effort (minimal/low/medium/high, or the model default), and an optional Fast mode flag. Cost statistics use the prices you enter.
- **Model removal notice**: if a previously selected model is removed from the list in a later version, the script falls back to the default GPT-5 Nano (never a more expensive model) and shows a one-time toast with a link to the model settings.

### Changed
- **Model lineup refresh** (pricing source: OpenAI pricing docs, 2026-07-31):
  - Added GPT-5.6 Luna ($0.20/$1.20 per 1M tokens) and GPT-5.6 Terra Fast ($4.00/$24.00)
  - Removed GPT-5 Mini and GPT-5.2 Priority: adjacent price points are covered by the new GPT-5.6 models
  - Renamed the "Priority" labels to "Fast", following OpenAI's rename of priority processing to Fast mode (the API `service_tier` value is unchanged)
- Pricing snapshot used for cost statistics now always re-syncs to the active model at startup, fixing stale rates after a model list change

## [2.8.0] - 2026-07-24

### Added
- **Text-density fallback for article detection**: when no configured selector matches anything usable (unrecognized themes, div-soup page builders), the script now guesses the article container by finding the tightest element holding at least 80% of the page's paragraph/list/quote text (navigation, header, footer and sidebar text is ignored). Pages like wired.com.gr (Elementor, no `<article>`/`<main>` and no standard content classes) now work out of the box.
- **Default selectors for popular themes and platforms**: Elementor (`.elementor-widget-theme-post-content`), WordPress block themes (`.wp-block-post-content`), tagDiv Newspaper (`.td-post-content`), Divi (`[class*="et_pb_post_content"]`), Ghost/Casper (`.gh-content`, `.post-full-content`), Substack (`.available-content`), Drupal 8+ (`.field--name-body`), and Shopify blogs (`.article-template__content`, `.article__content`).

## [2.7.0] - 2026-07-04

### Fixed
- **Greasemonkey compatibility**: menu commands were registered via bare `GM_registerMenuCommand?.()`, which throws a ReferenceError on Greasemonkey 4 (the legacy function is not declared there) and killed the whole script. Menu registration now goes through a guarded helper with a `GM.registerMenuCommand` fallback, and the metadata block grants `GM.registerMenuCommand`.
- **macOS keyboard shortcuts**: shortcuts are now matched and recorded via `event.code`, so Alt/Option-composed characters (e.g. Alt+Shift+L producing "Ò") no longer prevent shortcuts from firing. The Meta/Cmd modifier is now part of the match, so Cmd+Alt+Shift+L no longer triggers the Alt+Shift+L shortcut.
- **Trusted Types hardening**: `setHTML()` no longer throws when the site's CSP allowlists specific policy names or when the policy was already created (script injected twice).
- Closing a summary no longer rewrites the article container's `innerHTML` (a leftover of the old replace-in-place mode). This previously destroyed the site's own event listeners (embedded players, comment forms) on close.
- The summary overlay's Escape-key listener is now removed on every close path, not just when Escape itself closed it — stale listeners could accumulate and re-trigger closes of long-gone overlays.
- The API-key dialog can be reopened after being cancelled; previously a cancelled dialog left a "shown" flag set and blocked all future key prompts until reload.
- Overlay creation lock is released even when a storage read fails, so a transient error can no longer permanently block badge creation on a page.
- Text selection is preserved when clicking the badge's Large/Small buttons, making "summarize selection" work consistently across browsers.
- Pending token-usage writes are flushed on page hide so quick navigations don't lose them.
- Dialog textareas (custom prompts, domain lists, generic editors) now HTML-escape their content, matching the selector editor.

### Changed
- **Cache keys are now content hashes** (FNV-1a) instead of the full article text. The cache blob is dramatically smaller and is no longer parsed on every page load — it loads lazily on first use. The legacy full-text cache (`digest_cache_v1`) is deleted on first run; summaries re-cache on demand.
- Startup storage reads are batched into a single parallel request instead of ~20 sequential round-trips through the GM storage bridge.
- Removed the 5-second cache auto-save interval; the cache persists immediately on write.
- Removed ~320 lines of dead page-level fallback CSS (`ensureCSS`): both the badge and the summary overlay live in shadow roots, which document-level styles cannot reach.
- All settings/inspection dialogs now share a single `createDialog()` shell (shadow DOM, backdrop/Escape close, focus handling).
- Container-candidate selection logic is shared between extraction and the "Included in summary" highlighter (previously duplicated), and exclusion matching lives in one helper.
- "Included in summary" highlighting no longer does an O(n²) nested-element scan on long articles.
- Playwright can now run Firefox and WebKit projects via `ALL_BROWSERS=1` (Chromium remains the default).

## [2.6.1] - 2026-06-28

### Fixed
- Badge vertical position no longer occasionally resets to the very top. The position is now clamped non-destructively against a reliable viewport height (measured after the badge is in the DOM), and re-clamped on resize/orientation change so the badge stays on-screen and returns to its saved spot when space comes back.

## [2.6.0] - 2026-04-27

### Changed
- **Print stylesheet**: Badge is hidden when printing the page. If a summary overlay is open, it now prints inline at the top of the page (no fixed positioning, no dark backdrop, no max-height) with interactive buttons hidden.

## [2.5.0] - 2026-04-08

### Added
- **Re-summarize button** in summary overlay header: quickly switch between Large and Small summaries without closing the overlay. Uses cached results when available to avoid extra API calls.

## [2.4.2] - 2026-04-03

### Fixed
- Overlay automatically opens expanded when enabling a previously disabled domain, instead of staying collapsed on first load

## [2.4.1] - 2026-03-24

### Fixed
- Badge header ("Summarize" / "The Web") invisible on some sites due to `:host` background not rendering in shadow DOM. Moved visual styles (gradient, border, box-shadow) from `:host` to an inner wrapper element.

## [2.4.0] - 2026-03-12

### Changed
- **Shadow DOM for Badge**: Badge UI now uses Shadow DOM for complete CSS isolation, matching the summary overlay pattern. Eliminates interference from host page styles on all sites.
- **Trusted Types CSP support**: All innerHTML assignments use a new `setHTML()` helper that creates a Trusted Types policy when required by CSP (e.g., Gmail), fixing the "Sink type mismatch" error.

### Fixed
- Badge and settings UI no longer broken on sites with strict Content Security Policy (Trusted Types)
- Badge styles no longer affected by host page CSS resets or `all: initial` rules

## [2.3.3] - 2026-02-26

### Fixed
- Badge button text (Large/Small) now centered on sites that override button text-align (e.g., observer.co.uk)

## [2.3.2] - 2026-02-16

### Fixed
- Badge settings popover now opens below when badge is near top of viewport, preventing clipping

## [2.3.1] - 2026-02-10

### Fixed
- Background page no longer scrolls when summary modal is open (scrollbar, mousewheel, keyboard)
- Added `overscroll-behavior: contain` to prevent scroll chaining from modal content to page

## [2.3.0] - 2026-02-06

### Changed
- **Shadow DOM for Summary Overlay**: Summary overlay now uses Shadow DOM for complete CSS isolation from host page styles, fixing display issues on sites with aggressive CSS (e.g., kathimerini.com.cy)

### Fixed
- Font size, line height, and dark mode settings now work reliably on all sites due to Shadow DOM isolation
- Added `stopPropagation()` to settings button click handlers to prevent site script interference

## [2.2.0] - 2026-02-06

### Added
- **Edit Selectors Dialog**: Unified dialog accessible from badge UI and GM menu for editing global and domain-specific CSS selectors
- Segmented control tabs (iOS-style) for better tab visibility in Edit Selectors dialog
- Comprehensive test suite for Edit Selectors dialog (39 tests)

### Fixed
- Action button hover colors: explicit color prevents unreadable text on hover
- Edit Selectors modal anchored to top so height changes expand downward without jumping

## [2.1.0] - 2026-01-29

### Added
- **Show Included Elements**: New feature to highlight which page elements would be included in a summary (green border visualization)
- `@noframes` directive to prevent script running in iframes

### Fixed
- Duplicate badge overlay when Headlines Neutralizer also active on page (DOM-based creation lock)
- CSS conflicts with other userscripts by using ID-based selectors for badge styling
- Summary overlay settings buttons now properly styled (were unstyled after CSS refactor)
- Handle hover animation now extends width to prevent visual gap/disconnect

### Changed
- All badge CSS selectors now use `#summarizer-overlay-singleton` prefix for isolation
- Renamed "Included in Summary" button to "Show Included Elements"

## [2.0.0] - 2026-01-26

### Added
- **Display Settings**: Configurable font size (Small/Default/Large) and line spacing (Compact/Default/Comfortable) in badge settings
- **Dark Mode**: Light/Dark/Auto theme support following system `prefers-color-scheme`
- **Keyboard Shortcuts**: Configurable shortcuts for triggering summaries (default: Alt+Shift+L for Large, Alt+Shift+S for Small)
- **Live Preview Settings**: Gear icon in summary header for adjusting display settings while viewing summary
- New unit tests for config and overlay modules (182 total tests)

### Changed
- Badge UI restructured: footer layout with status text and gear icon
- Inspect button moved into settings popover for cleaner interface
- Settings popover always opens upward to prevent screen edge cutoff

## [1.6.2] - 2026-01-26

### Changed
- Summary overlay max-width reduced from 1200px to 760px to match text column width
- Slide handle position adjusted to prevent overlap with main badge UI

## [1.6.1] - 2026-01-25

### Improved
- Summary overlay readability on wide displays
  - Text column constrained to 680px max-width for optimal line length (~65-75 characters)
  - Centered text column within overlay
  - Increased font size (16px → 17px) and line height (1.7 → 1.8)
  - Added subtle letter-spacing and word-spacing for improved readability
  - Proportional paragraph margins using em units

## [1.6.0] - 2026-01-20

### Added
- Multiple container combining: when no single container is dominant, combines text from multiple significant containers
  - Dominant = >70% of page text AND next best <50% of dominant
  - Significant = >15% of page text AND meets minimum length
  - Filters out nested containers to avoid duplicate text
  - Useful for pages with content split across multiple sections

## [1.5.0] - 2026-01-18

### Changed
- Text extraction now uses `innerText` instead of querying specific elements (p, li, blockquote)
  - Better support for non-semantic HTML (Gmail, web apps using divs)
  - Headings (h1-h6), tables, and all visible text now extracted automatically

### Added
- Configurable minimum text length (default: 100 characters)
  - New menu option: "Minimum text length (X chars)"
  - Helps with short emails or content that was previously rejected
- Specific error messages for extraction failures:
  - "Selected text is too short (X chars)"
  - "Article text is too short (X chars)"
  - "No article container found"
  - "Container found but no text inside"
- Comprehensive extraction test suite (48 tests covering container detection, exclusions, Gmail-style content, minLength configuration)

## [1.4.0] - 2026-01-18

### Changed
- Simplification style now uses prompt instructions instead of temperature parameter (GPT-5 models don't support temperature)
- GPT-5 models now use `reasoning.effort: minimal` to prevent token exhaustion on reasoning

### Added
- `MAX_OUTPUT_TOKENS` config in `config.js` for easier customization
- Better error messages for incomplete API responses (shows reasoning token usage)
- GitHub Actions workflow for automatic releases on tag push

### Fixed
- GPT-5 model compatibility (removed unsupported temperature parameter)
- Summary overlay close button null reference error
- Simplification style menu now updates after changing selection
- BUILD.md inline comments no longer break IDE click-to-run

## [1.3.1] - 2026-01-02

### Fixed
- Menu now appears on disabled domains, allowing users to enable the script or change settings
- Improved article container selector matching

## [1.3.0] - 2025-12-31

### Changed
- **Complete refactoring to modular ES6 architecture**
  - Split monolithic file into 11 focused modules for better maintainability
  - Entry point (`src/main.js`) orchestrates module imports and bootstrapping
  - Modules: api.js, cache.js, config.js, extraction.js, inspection.js, overlay.js, selectors.js, settings.js, storage.js, utils.js
- **Build system with Rollup**
  - Bundler creates single IIFE userscript from ES6 modules
  - Watch mode for development (`npm run dev`)
  - Output: `dist/summarize-the-web.js`

### Added
- **Element Inspection Mode** - Click "Inspect element" in menu, then click any element to analyze
  - Shows element details (tag, classes, ID, CSS selector)
  - Shows matching global/local inclusion and exclusion selectors
  - Smart action buttons: Add/Remove for inclusions and exclusions
  - Buttons intelligently enable/disable based on current match state
- **Configurable article container selectors**
  - Edit global container selectors (all domains)
  - Edit domain-specific container selectors
  - Edit global exclusions (elements and ancestors)
  - Edit domain-specific exclusions

### Fixed
- Script now only runs in top-level windows (not in iframes) to prevent multiple badges


## [1.2.0] - 2025-12-18

### Added
- AI model selection - Users can now choose from 5 different OpenAI models
- Model configuration dialog with pricing information and descriptions
- Support for GPT-5 models (gpt-5-nano, gpt-5-mini, gpt-5.2)
- Support for GPT-4.1 models (gpt-4.1-nano)
- Priority tier support - Models can use `service_tier=priority` for faster processing
- Menu item showing currently selected model with option to change
- Model information displayed in usage statistics

### Changed
- **Default model changed from gpt-4o-mini to gpt-5-nano** (3x cheaper: $0.05/$0.40 vs $0.15/$0.60 per 1M tokens)
- Updated pricing to latest OpenAI rates (as of 2025-12-18)
- Model selection now automatically reloads page to update menu

### Removed
- "Restore" button from actions dialog (no longer needed with overlay-based summaries)

### Fixed
- Cache properly clears when switching models to prevent stale summaries

## [1.1.0] - 2025-12-18

### Added
- Touch event support for dragging the actions dialog on mobile devices

### Fixed
- Actions dialog is now draggable on mobile/tablet touchscreens

### Changed
- Improved log messages

## [1.0.0] - 2025-12-17

Initial release.