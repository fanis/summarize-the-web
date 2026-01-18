# Build System

This document explains the modular architecture and build system for the Summarize The Web userscript.

## Overview

The project uses a modular ES6 architecture during development and bundles into a single userscript file for distribution.

### Why This Approach?

Modular source makes the code easier to maintain and test while the bundled output works with any userscript manager. Each module has a single responsibility and can be tested in isolation.

## Project Structure

```
summarize-the-web/
├── src/
│   ├── banner.txt              # Userscript metadata header
│   ├── main.js                 # Application entry point
│   └── modules/
│       ├── api.js              # OpenAI API integration
│       ├── cache.js            # LRU cache management
│       ├── config.js           # Configuration constants
│       ├── extraction.js       # Article text extraction
│       ├── inspection.js       # Inspection mode
│       ├── overlay.js          # Summary overlay UI
│       ├── selectors.js        # Selector & domain matching
│       ├── settings.js         # Settings dialogs
│       ├── storage.js          # Storage abstraction
│       └── utils.js            # Utility functions
├── dist/
│   └── summarize-the-web.js    # Bundled output
├── rollup.config.js            # Build configuration
└── package.json                # Dependencies & scripts
```

## Module Breakdown

### Core Modules (10 modules)

| Module | Purpose |
|--------|---------|
| `config.js` | Configuration constants, defaults, model options, storage keys |
| `utils.js` | Text processing, logging, escaping utilities |
| `storage.js` | GM → localStorage → memory fallback chain |
| `cache.js` | LRU cache with automatic trimming and periodic saves |
| `selectors.js` | Glob/regex pattern matching, CSS selector utilities |
| `api.js` | OpenAI API calls, token tracking, pricing |
| `extraction.js` | Article body extraction, text selection handling |
| `overlay.js` | Badge UI, summary overlay, drag functionality |
| `settings.js` | Settings dialogs, editors, model selection |
| `inspection.js` | Element inspection mode and diagnostics |

### Entry Point

**`main.js`**
- Imports all modules
- Initializes storage, cache, API tracking
- Loads persisted settings (domain mode, selectors, exclusions)
- Registers GM menu commands
- Sets up MutationObserver for badge persistence
- Bootstraps the application

## Build System

### Technology

- **Bundler**: Rollup
- **Output format**: IIFE (Immediately Invoked Function Expression)
- **Plugin**: `@rollup/plugin-node-resolve` (resolves ES6 imports)

### Build Configuration

**`rollup.config.js`**
```javascript
import resolve from '@rollup/plugin-node-resolve';
import { readFileSync } from 'fs';

const banner = readFileSync('./src/banner.txt', 'utf-8');

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/summarize-the-web.js',
    format: 'iife',
    banner: banner,
    strict: true
  },
  plugins: [resolve()]
};
```

## Development Workflow

### Initial Setup

```bash
npm install
```

### Development Mode

Watch mode - auto-rebuild on changes:
```bash
npm run dev
```

Or manually:
```bash
npm run build
npm run build:watch
```

### Build Output

The bundled file is created at:
```
dist/summarize-the-web.js
```

- **Format**: Single IIFE with userscript header
- **Compatible**: All userscript managers (Tampermonkey, Violentmonkey, Greasemonkey)

## Making Changes

### Modifying Code

1. Edit modules in `src/modules/`
2. Run `npm run build` to create the bundle
3. Install `dist/summarize-the-web.js` in your userscript manager

### Adding a New Module

1. Create `src/modules/mymodule.js`
2. Export functions/classes: `export function myFunction() { ... }`
3. Import in `src/main.js`: `import { myFunction } from './modules/mymodule.js'`
4. Run `npm run build`

## Troubleshooting

### Build fails with module not found

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Bundled script doesn't work

1. Check for syntax errors: `node --check dist/summarize-the-web.js`
2. Check userscript header is present
3. Verify IIFE wrapper exists at start/end
4. Test in browser console for JavaScript errors

---

Run `npm run build` to create `dist/summarize-the-web.js` from the modular source.
