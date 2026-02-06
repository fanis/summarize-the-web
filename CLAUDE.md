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

# Run unit tests (vitest)
npm test

# Run E2E tests (Playwright)
npm run test:e2e

# Run all tests
npm run test:all
```

The build uses Rollup to bundle ES6 modules into a single IIFE userscript with the metadata header from `src/banner.txt`.

## Tools

GitHub CLI: `"/c/Program Files/GitHub CLI/gh.exe"` (use full path)

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

## Release Checklist

Before creating a new release:

1. Update version in both files:
   - `package.json` version field
   - `src/banner.txt` @version metadata

2. Update `CHANGELOG.md` with new version section

3. Update `README.md` if features changed

4. Run tests: `npm run test:all`

5. Build: `npm run build`

6. Commit all changes

7. Create and push tag:
   ```bash
   git tag X.Y.Z
   git push origin X.Y.Z
   ```

The GitHub Actions workflow (`.github/workflows/release.yml`) automatically creates a release with the changelog and attaches the built script.

## Documentation Style

When writing code blocks with commands that IDEs can detect and run, put comments on the line above the command, not inline. Inline comments break IDE click-to-run functionality.

## Workflow Rules

- Only run build and tests when actual code is edited (src/*, tests/*), not for documentation-only changes (README, CHANGELOG, etc.)
- Git push to GitHub requires manual execution for authentication - remind user to push
