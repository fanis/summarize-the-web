# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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