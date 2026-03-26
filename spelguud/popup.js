// SpellRight Popup Script

const toggle = document.getElementById('enableToggle');
const enableLabel = document.getElementById('enableLabel');
const colorPicker = document.getElementById('colorPicker');
const colorHex = document.getElementById('colorHex');
const wordList = document.getElementById('wordList');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const styleBtns = document.querySelectorAll('.style-btn');

let settings = {};

function loadAndRender() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    settings = res.settings || {};
    render();
  });
}

function render() {
  toggle.checked = settings.enabled !== false;
  enableLabel.textContent = settings.enabled !== false ? 'On' : 'Off';
  colorPicker.value = settings.underlineColor || '#e53e3e';
  colorHex.textContent = settings.underlineColor || '#e53e3e';

  // Style buttons
  styleBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === (settings.underlineStyle || 'wavy'));
  });

  // Status
  if (settings.enabled !== false) {
    statusDot.classList.remove('off');
    statusText.textContent = 'Active on this page';
  } else {
    statusDot.classList.add('off');
    statusText.textContent = 'Spell checking disabled';
  }

  // Word list
  const words = settings.addedWords || [];
  if (words.length === 0) {
    wordList.innerHTML = '<span class="empty-list">No custom words yet</span>';
  } else {
    wordList.innerHTML = words.map(w =>
      `<span class="word-chip">${escapeHtml(w)}<span class="word-chip-remove" data-word="${escapeAttr(w)}">×</span></span>`
    ).join('');
    wordList.querySelectorAll('.word-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => removeWord(btn.dataset.word));
    });
  }
}

function saveSettings() {
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings }, () => {});
}

function removeWord(word) {
  settings.addedWords = (settings.addedWords || []).filter(w => w !== word);
  saveSettings();
  render();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// Events
toggle.addEventListener('change', () => {
  settings.enabled = toggle.checked;
  saveSettings();
  render();
});

colorPicker.addEventListener('input', () => {
  settings.underlineColor = colorPicker.value;
  colorHex.textContent = colorPicker.value;
  saveSettings();
});

styleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    settings.underlineStyle = btn.dataset.style;
    saveSettings();
    render();
  });
});

loadAndRender();
