# Summarize The Web

A userscript that summarizes and simplifies web articles using the OpenAI API. Get quick summaries of any article or selected text directly in your browser.

> **Latest Version**: 1.1.0 | [See What's New](CHANGELOG.md)

## Features

- **Two Summary Sizes**: Choose between Large (50%) or Small (20%) summaries
- **Works with Articles & Selected Text**: Summarize entire articles or just highlight specific text
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
- **Restore**: Closes the summary overlay

### Userscript Menu Options

Access these via your userscript manager's menu:

**Configuration**
- Set / Validate OpenAI API key
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

## API Usage & Costs

The script uses OpenAI's `gpt-4o-mini` model. You can view your usage statistics including:
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