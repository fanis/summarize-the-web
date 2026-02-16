# Summarize The Web

A userscript that summarizes and simplifies web articles using the OpenAI API. Get quick summaries of any article or selected text directly in your browser.

> **Latest Version**: 2.3.2 | [See What's New](CHANGELOG.md)

## Features

- **Two Summary Sizes**: Choose between Large (50%) or Small (20%) summaries
- **Works with Articles & Selected Text**: Summarize entire articles or just highlight specific text
- **AI Model Selection**: Choose from 5 different OpenAI models (GPT-5, GPT-4.1) with different pricing and quality levels
- **Display Settings**: Configurable font size and line spacing for comfortable reading
- **Dark Mode**: Light/Dark/Auto themes following system preference
- **Keyboard Shortcuts**: Configurable hotkeys for quick summarization (default: Alt+Shift+L/S)
- **Show Included Elements**: Highlight which page elements would be included in a summary
- **Element Inspection Mode**: Diagnostic tool to troubleshoot why elements are/aren't being detected
- **Configurable Selectors**: Global + per-domain CSS selector configuration for article containers
- **Caching**: Previously generated summaries are cached to save API costs
- **Customizable Prompts**: Modify the AI prompts to suit your needs
- **Simplification Styles**: Choose from Conservative, Balanced, or Aggressive simplification
- **Domain Controls**: Enable/disable on specific websites using allowlist or denylist
- **Auto-Simplify**: Optionally auto-summarize articles on page load
- **Usage Statistics**: Track API token usage and estimated costs
- **Mobile-Friendly**: Overlay auto-hides when viewing summaries on mobile, with full touch support for dragging

**New in 2.2.0:** Edit Selectors dialog for managing global and domain-specific CSS selectors from the badge UI.

**New in 2.1.0:** Show Included Elements feature to visualize what will be summarized, plus CSS isolation fixes for compatibility with other userscripts.

## Installation

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)

2. Install the userscript from the `dist/summarize-the-web.js` file

3. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

4. Configure your API key via the userscript menu

## Development

This project uses a modular ES6 architecture with a build system for easy development.

### Building from Source

```bash
# Install dependencies
npm install

# Build the userscript
npm run build

# Output: dist/summarize-the-web.js
```

**Development workflow:**
```bash
# Watch mode - auto-rebuild on changes
npm run dev

# Single build
npm run build
```

**Testing:**
```bash
# Run unit tests (vitest)
npm test

# Run E2E tests (Playwright)
npm run test:e2e

# Run all tests
npm run test:all
```

The source code is organized into modules:
- `src/main.js` - Application entry point
- `src/modules/` - Individual feature modules
- `src/banner.txt` - Userscript metadata header

After building, install `dist/summarize-the-web.js` in your userscript manager.

For detailed build documentation, see [BUILD.md](BUILD.md).

## Usage

### Quick Start

1. Navigate to any article page
2. **Enable** the script for the current domain from the menu
3. Click the **Summarize** panel that appears on the right side of the screen
4. Choose **Large** (50% length) or **Small** (20% length) summary
5. View your summary in the overlay that appears

### Summarizing Selected Text

1. Highlight any text on a webpage (minimum 100 characters by default, configurable)
2. Click **Large** or **Small** in the Summarize panel
3. The summary will appear in an overlay

### Controls

- **Large**: Creates a summary at ~50% of the original length
- **Small**: Creates a concise summary at ~20% of the original length
- Click the **X** button in the summary overlay to close it

### Userscript Menu Options

Access these via your userscript manager's menu:

**Configuration**
- Set / Validate OpenAI API key
- AI model selection (choose from 5 models with different pricing/quality)
- Configure custom prompts
- Simplification style (Conservative/Balanced/Aggressive)
- Minimum text length (configure minimum characters required for summarization)

**Domain Controls**
- Toggle between ALLOW and DENY mode
- Edit allowlist/denylist
- Enable/disable for current domain

**Toggles**
- Auto-simplify (automatically summarize articles on page load)
- DEBUG logs

**Actions**
- Show usage statistics
- Clear cache & reload
- Reset API usage stats

## Configuration

### Domain Modes

- **ALLOW mode** (default): Script only runs on domains in the allowlist
- **DENY mode**: Script runs everywhere except domains in the denylist

Domain patterns support:
- Exact matches: `example.com`
- Wildcards: `*.example.com`
- Regex: `/pattern/`

### Custom Prompts

You can customize the AI prompts for both Large and Small summaries via the userscript menu. Changes will clear the cache to ensure new summaries use the updated prompts.

### Simplification Styles

- **Conservative**: Minimal rephrasing, preserves original style
- **Balanced**: Good balance of clarity and faithfulness (recommended)
- **Aggressive**: Maximum simplification for easier reading

### AI Model Selection

Choose from 5 different OpenAI models based on your needs and budget:

**Regular Tier:**
- **GPT-5 Nano** (Recommended) - $0.05/$0.40 per 1M tokens - Ultra-affordable, best value
- **GPT-5 Mini** - $0.25/$2.00 per 1M tokens - Better quality, still affordable

**Priority Tier (Faster Processing):**
- **GPT-4.1 Nano Priority** - $0.20/$0.80 per 1M tokens - Fast + cheaper than regular GPT-5 Mini
- **GPT-5 Mini Priority** - $0.45/$3.60 per 1M tokens - Better quality + faster
- **GPT-5.2 Priority** - $2.50/$20.00 per 1M tokens - Premium quality + fastest

Access model selection via the userscript menu. Changing models clears the cache and reloads the page.

## API Usage & Costs

The script defaults to OpenAI's `gpt-5-nano` model (ultra-affordable at $0.05/$0.40 per 1M tokens), but you can select from 5 different models. You can view your usage statistics including:
- Total API calls
- Token usage (input/output)
- Estimated cost based on current pricing

Summaries are cached locally to reduce API calls when re-summarizing the same content.

## Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Userscript manager extension
- OpenAI API key with available credits


## Provenance
This UserScript was authored by [Fanis Hatzidakis](https://github.com/fanis/summarize-the-web) with assistance from large-language-model tooling (ChatGPT and Claude Code).
All code was reviewed, tested, and adapted by Fanis.


## Licence

Copyright (c) 2025 Fanis Hatzidakis

Licensed under PolyForm Internal Use License 1.0.0

See LICENCE.md