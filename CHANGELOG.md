# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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