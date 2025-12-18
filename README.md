# Summarize The Web

A userscript that summarizes and simplifies web articles using the OpenAI API. Get quick summaries of any article or selected text directly in your browser.

> **Latest Version**: 1.2.0 | [See What's New](CHANGELOG.md)

## Features

- **Two Summary Sizes**: Choose between Large (50%) or Small (20%) summaries
- **Works with Articles & Selected Text**: Summarize entire articles or just highlight specific text
- **AI Model Selection**: Choose from 5 different OpenAI models (GPT-5, GPT-4.1) with different pricing and quality levels
- **Caching**: Previously generated summaries are cached to save API costs
- **Customizable Prompts**: Modify the AI prompts to suit your needs
- **Simplification Styles**: Choose from Conservative, Balanced, or Aggressive simplification
- **Domain Controls**: Enable/disable on specific websites using allowlist or denylist
- **Auto-Simplify**: Optionally auto-summarize articles on page load
- **Usage Statistics**: Track API token usage and estimated costs
- **Mobile-Friendly**: Overlay auto-hides when viewing summaries on mobile, with full touch support for dragging

## Installation

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)

2. Install the userscript from the `src/summarize-the-web.js` file

3. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

4. Configure your API key via the userscript menu

## Usage

### Quick Start

1. Navigate to any article page
2. **Enable** the script for the current domain from the menu
3. Click the **Summarize** panel that appears on the right side of the screen
4. Choose **Large** (50% length) or **Small** (20% length) summary
5. View your summary in the overlay that appears

### Summarizing Selected Text

1. Highlight any text on a webpage (minimum 100 characters)
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