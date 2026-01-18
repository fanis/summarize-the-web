# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Install dependencies
npm install          
# Build the userscript (outputs to dist/summarize-the-web.js)
npm run build        
# Watch mode - auto-rebuild on changes
npm run dev          
```

The build uses Rollup to bundle ES6 modules into a single IIFE userscript with the metadata header from `src/banner.txt`.

## Architecture

This is a **browser userscript** for summarizing web articles using the OpenAI API. It runs in userscript managers (Tampermonkey, Violentmonkey, Greasemonkey).

### Module Structure

Entry point: `src/main.js` - Orchestrates initialization, loads settings, registers GM menu commands, and bootstraps the overlay.

Core modules in `src/modules/`:

| Module | Responsibility |
|--------|----------------|
| `config.js` | Constants, model options, storage keys, default prompts, selectors |
| `storage.js` | Storage abstraction with fallback chain: GM_getValue/GM_setValue -> localStorage -> memory |
| `cache.js` | LRU cache for summaries (avoids redundant API calls) |
| `api.js` | OpenAI API integration, token tracking, pricing calculations |
| `extraction.js` | Article text extraction using configurable CSS selectors, text selection handling |
| `selectors.js` | Glob/regex pattern matching for domains, CSS selector utilities |
| `overlay.js` | Badge UI, summary overlay, drag functionality |
| `settings.js` | Settings dialogs, editors, model/prompt configuration |
| `inspection.js` | Element inspection mode for debugging selector matching |
| `utils.js` | Text processing, logging utilities |

### Key Patterns

- **Storage fallback chain**: GM storage -> localStorage -> in-memory (see `storage.js`)
- **Global + domain-specific selectors**: Article extraction uses merged global and per-domain CSS selectors for container detection and exclusions
- **Domain allow/deny lists**: Script can run on allowlisted domains only (default) or everywhere except denylisted domains
- **Caching**: Summaries are cached by content hash to minimize API costs

### Data Flow

1. User clicks summarize button in overlay
2. `extraction.js` finds article container using selectors, extracts text
3. `cache.js` checks for cached summary
4. If not cached, `api.js` calls OpenAI with configured model/prompt
5. Result displayed in overlay, cached for future use

## Version Updates

When bumping version, update both:
- `package.json` version field
- `src/banner.txt` @version metadata
