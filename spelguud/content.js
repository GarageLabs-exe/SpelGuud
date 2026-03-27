//these console output lines are so you can make sure SpelGuud actually loads in the browser
console.log("DEBUG- SPELLRIGHT LOADED");

document.addEventListener("input", (e) => {
  console.log("DEBUG- SPELLRIGHT- INPUT DETECTED",);
});





(function () {
  'use strict';

  //State
  let settings = { enabled: true, underlineColor: '#e53e3e', underlineStyle: 'wavy', ignoredWords: [], addedWords: [] };
  let COMMON_WORDS = new Set(); 
  let dictionaryReady = false;
  let contextMenu = null;
  let activeOverlay = null;
  let activeInput = null;
  let checkTimer = null;
  let misspelledWords = [];

  async function loadCommonWords() {
    try {
      const response = await fetch(chrome.runtime.getURL('words_alpha.txt'));
      const text = await response.text();
      const matches = text.match(/"([^"]+)"/g);
      if (matches) {
        matches.forEach(m => COMMON_WORDS.add(m.replace(/"/g, '').toLowerCase()));
      }
      dictionaryReady = true;
      scanPage();
    } catch (error) {
      console.error("Dictionary load error:", error);
    }
  }

  //Load settings from background
  function loadSettings(cb) {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res && res.settings) {
        settings = res.settings;
      }
      if (cb) cb();
    });
  }

  // Check if a word is spelled correctly
  function isCorrect(word) {
    if (!dictionaryReady) return true; // Don't flag everything as red while loading
    if (!word || word.length < 2) return true;
    const w = word.toLowerCase().replace(/['']/g, "'");
    
    if (/^\d/.test(w)) return true;
    if (/https?:\/\/|www\.|@/.test(w)) return true;
    if (/^[A-Z]{2,}$/.test(word)) return true; 
    if (settings.ignoredWords && settings.ignoredWords.includes(w)) return true;
    if (settings.addedWords && settings.addedWords.includes(w)) return true;

    const base = w.replace(/'s$/, '').replace(/'t$/, '').replace(/'re$/, '')
                   .replace(/'ve$/, '').replace(/'d$/, '').replace(/'ll$/, '');
    return COMMON_WORDS.has(w) || COMMON_WORDS.has(base);
  }

  //Simple suggestions via edit-distance
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function getSuggestions(word) {
    const w = word.toLowerCase();
    const candidates = [];
    for (const dict of COMMON_WORDS) {
      if (Math.abs(dict.length - w.length) > 2) continue; // Tighter filter for performance
      const d = editDistance(w, dict);
      if (d <= 2) candidates.push({ word: dict, dist: d });
      if (candidates.length > 50) break; // Optimization
    }
    if (settings.addedWords) {
      for (const dict of settings.addedWords) {
        const d = editDistance(w, dict);
        if (d <= 2) candidates.push({ word: dict, dist: d });
      }
    }
    return candidates
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map(c => c.word);
  }

  //Tokenize text into words with positions
  function tokenize(text) {
    const tokens = [];
    const regex = /[a-zA-Z'']+/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    return tokens;
  }

  const overlays = new WeakMap();

  function getOrCreateOverlay(el) {
    if (overlays.has(el)) return overlays.get(el);

    const overlay = document.createElement('div');
    overlay.className = 'spellright-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    overlays.set(el, overlay);

    const obs = new MutationObserver(() => {
      if (!document.contains(el)) {
        overlay.remove();
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return overlay;
  }

  function syncOverlay(el, overlay) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    overlay.style.position = 'absolute';
    overlay.style.top = (rect.top + scrollY) + 'px';
    overlay.style.left = (rect.left + scrollX) + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483640';
    overlay.style.fontFamily = style.fontFamily;
    overlay.style.fontSize = style.fontSize;
    overlay.style.fontWeight = style.fontWeight;
    overlay.style.lineHeight = style.lineHeight;
    overlay.style.letterSpacing = style.letterSpacing;
    overlay.style.wordSpacing = style.wordSpacing;
    overlay.style.paddingTop = style.paddingTop;
    overlay.style.paddingRight = style.paddingRight;
    overlay.style.paddingBottom = style.paddingBottom;
    overlay.style.paddingLeft = style.paddingLeft;
    overlay.style.borderTop = style.borderTopWidth + ' solid transparent';
    overlay.style.borderRight = style.borderRightWidth + ' solid transparent';
    overlay.style.borderBottom = style.borderBottomWidth + ' solid transparent';
    overlay.style.borderLeft = style.borderLeftWidth + ' solid transparent';
    overlay.style.boxSizing = style.boxSizing;
    overlay.style.whiteSpace = el.tagName === 'TEXTAREA' ? style.whiteSpace || 'pre-wrap' : 'nowrap';
    overlay.style.wordBreak = style.wordBreak;
    overlay.style.wordWrap = style.wordWrap;
    overlay.style.background = 'transparent';
  }

  function renderUnderlines(el, tokens, misspelled) {
    if (!settings.enabled) return;
    const overlay = getOrCreateOverlay(el);
    syncOverlay(el, overlay);

    const text = el.value || el.innerText || '';
    const color = settings.underlineColor || '#e53e3e';
    const lineStyle = settings.underlineStyle || 'wavy';

    const misspelledSet = new Map();
    for (const t of misspelled) {
      misspelledSet.set(t.start, t);
    }

    let html = '';
    let i = 0;
    while (i < text.length) {
      if (misspelledSet.has(i)) {
        const t = misspelledSet.get(i);
        html += `<mark class="spellright-error" data-word="${escapeAttr(t.word)}" style="color:transparent;background:transparent;border-bottom:2px ${lineStyle} ${color};position:relative;">${escapeHtml(text.slice(i, t.end))}</mark>`;
        i = t.end;
      } else {
        html += `<span style="color:transparent;">${escapeHtml(text[i])}</span>`;
        i++;
      }
    }

    overlay.scrollTop = el.scrollTop;
    overlay.scrollLeft = el.scrollLeft;
    overlay.innerHTML = html;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;');
  }

  function checkElement(el) {
    if (!settings.enabled || !isCheckable(el)) return;
    const text = el.value !== undefined ? el.value : (el.textContent || el.innerText || '');
    const tokens = tokenize(text);
    misspelledWords = tokens.filter(t => !isCorrect(t.word));
    renderUnderlines(el, tokens, misspelledWords);
  }

  function removeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  async function showContextMenu(x, y, word, token, el) {
    removeContextMenu();
    const suggestions = getSuggestions(word);

    const menu = document.createElement('div');
    menu.className = 'spellright-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${y}px;
      left: ${x}px;
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 180px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding: 6px 12px; color: #718096; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #edf2f7;';
    header.textContent = `"${word}"`;
    menu.appendChild(header);

    if (suggestions.length === 0) {
      const none = document.createElement('div');
      none.style.cssText = 'padding: 8px 12px; color: #a0aec0; font-style: italic;';
      none.textContent = 'No suggestions found';
      menu.appendChild(none);
    } else {
      suggestions.forEach(sug => {
        const item = document.createElement('div');
        item.className = 'spellright-menu-item';
        item.style.cssText = 'padding: 7px 12px; cursor: pointer; color: #2d3748; font-weight: 500;';
        item.textContent = sug;
        item.addEventListener('mouseenter', () => item.style.background = '#ebf8ff');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          replaceWord(el, token, sug);
          removeContextMenu();
        });
        menu.appendChild(item);
      });
    }

    const div = document.createElement('div');
    div.style.cssText = 'border-top: 1px solid #edf2f7; margin-top: 4px; padding-top: 4px;';
    menu.appendChild(div);

    const addItem = document.createElement('div');
    addItem.className = 'spellright-menu-item';
    addItem.style.cssText = 'padding: 7px 12px; cursor: pointer; color: #38a169;';
    addItem.textContent = '✓ Add to dictionary';
    addItem.addEventListener('mouseenter', () => addItem.style.background = '#f0fff4');
    addItem.addEventListener('mouseleave', () => addItem.style.background = '');
    addItem.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'ADD_WORD', word: word.toLowerCase() }, () => {
        settings.addedWords = settings.addedWords || [];
        settings.addedWords.push(word.toLowerCase());
        checkElement(el);
      });
      removeContextMenu();
    });
    menu.appendChild(addItem);

    const ignoreItem = document.createElement('div');
    ignoreItem.className = 'spellright-menu-item';
    ignoreItem.style.cssText = 'padding: 7px 12px; cursor: pointer; color: #e53e3e;';
    ignoreItem.textContent = '✕ Ignore word';
    ignoreItem.addEventListener('mouseenter', () => ignoreItem.style.background = '#fff5f5');
    ignoreItem.addEventListener('mouseleave', () => ignoreItem.style.background = '');
    ignoreItem.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'IGNORE_WORD', word: word.toLowerCase() }, () => {
        settings.ignoredWords = settings.ignoredWords || [];
        settings.ignoredWords.push(word.toLowerCase());
        checkElement(el);
      });
      removeContextMenu();
    });
    menu.appendChild(ignoreItem);

    document.body.appendChild(menu);
    contextMenu = menu;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    setTimeout(() => {
      document.addEventListener('mousedown', removeContextMenu, { once: true });
    }, 0);
  }

  function replaceWord(el, token, replacement) {
    const start = token.start;
    const end = token.end;

    if (el.value !== undefined) {
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      el.value = before + replacement + after;
      el.selectionStart = el.selectionEnd = start + replacement.length;
    } else if (el.isContentEditable) {
      const text = el.textContent || '';
      const before = text.slice(0, start);
      const after = text.slice(end);
      el.textContent = before + replacement + after;

      const range = document.createRange();
      const sel = window.getSelection();
      const node = el.firstChild || el;
      range.setStart(node, Math.min(node.length || 0, start + replacement.length));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    checkElement(el);
  }

  function findMisspelledTokenAtOffset(el, offset) {
    const text = el.value !== undefined ? el.value : (el.textContent || el.innerText || '');
    const tokens = tokenize(text);
    const mis = tokens.filter(t => !isCorrect(t.word));
    for (const t of mis) {
      if (offset >= t.start && offset < t.end) return t;
    }
    return null;
  }

  function onContextMenu(e) {
    if (!settings.enabled) return;
    const el = e.target;
    if (!isCheckable(el)) return;

    const pos = getCaretOffset(el);
    const token = findMisspelledTokenAtOffset(el, pos);
    if (!token) return;

    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, token.word, token, el);
  }

  function isCheckable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', ''].includes(type);
    }
    if (el.isContentEditable || el.contentEditable === 'true') return true;
    return false;
  }

  function getCaretOffset(el) {
    if (el.selectionStart !== undefined && el.selectionStart !== null) {
      return el.selectionStart;
    }
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return 0;
      const range = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString().length;
    }
    return 0;
  }

  const attached = new WeakSet();

  function attach(el) {
    if (attached.has(el)) return;
    attached.add(el);

    let debounce;
    el.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => checkElement(el), 400);
    });
    el.addEventListener('focus', () => checkElement(el));
    el.addEventListener('scroll', () => {
      const overlay = overlays.get(el);
      if (overlay) {
        overlay.scrollTop = el.scrollTop;
        overlay.scrollLeft = el.scrollLeft;
      }
    });
    el.addEventListener('contextmenu', onContextMenu);

    checkElement(el);
  }

  function scanPage() {
    if (!settings.enabled || !dictionaryReady) return;
    document.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), [contenteditable="true"], [contenteditable=""]').forEach(el => {
      if (isCheckable(el)) attach(el);
    });
  }

  const pageObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (isCheckable(node)) attach(node);
        node.querySelectorAll && node.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type])').forEach(el => attach(el));
      }
    }
  });

  window.addEventListener('resize', () => {
    if (activeInput && overlays.has(activeInput)) {
      syncOverlay(activeInput, overlays.get(activeInput));
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue;
      document.querySelectorAll('textarea, input').forEach(el => {
        if (overlays.has(el)) checkElement(el);
      });
    }
  });

  //Init
  loadSettings(() => {
    loadCommonWords(); // Load dictionary then scan page
    pageObserver.observe(document.body, { childList: true, subtree: true });
  });

})();