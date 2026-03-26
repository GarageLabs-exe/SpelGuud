# SpellRight – Chrome Spell Checker Extension

A lightweight, privacy-first spell checker for Chrome. No AI, no tracking, just accurate spell checking in every text field.

## Features
- ✅ Spell checks all text inputs and textareas on any website
- ✅ Right-click on a misspelled word to see suggestions
- ✅ Add words to your personal dictionary
- ✅ Ignore words session-wide
- ✅ Customizable underline color and style (wavy, solid, dashed)
- ✅ Enable/disable via popup
- ✅ Works completely offline – no data leaves your browser

## How to Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `spellcheck-extension` folder
5. The SpellRight icon will appear in your toolbar!

## How to Use

- Start typing in any text box on any website — misspelled words will get a red underline
- **Right-click** on a misspelled word to see:
  - Suggested corrections (click to replace)
  - "Add to dictionary" – word will never be flagged again
  - "Ignore word" – ignored for this session
- Click the **SpellRight icon** in the toolbar to:
  - Toggle spell checking on/off
  - Change underline color
  - Change underline style (wavy / solid / dashed)
  - View and manage your custom dictionary

## File Structure

```
spellcheck-extension/
├── manifest.json       # Extension configuration
├── background.js       # Settings storage & management
├── content.js          # Spell-check logic injected into pages
├── content.css         # Overlay styles
├── popup.html          # Settings popup UI
├── popup.js            # Settings popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Extending the Dictionary

The built-in dictionary covers the most common ~2,000 English words. You can:
- Right-click any word → "Add to dictionary" to grow your personal word list
- The extension also recognizes acronyms (ALL CAPS), numbers, URLs, and email addresses as valid

For a much larger dictionary, consider replacing `COMMON_WORDS` in `content.js` with a full Hunspell word list loaded from a bundled file.
