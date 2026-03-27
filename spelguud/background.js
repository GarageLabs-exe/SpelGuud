

const DEFAULT_SETTINGS = {
  enabled: true,
  underlineColor: '#e53e3e',
  underlineStyle: 'wavy', 
  ignoredWords: [],
  addedWords: [] //The user's custom dictionary
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get('settings', (data) => {
      sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
    });
    return true;
  }

  if (msg.type === 'ADD_WORD') {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      if (!settings.addedWords.includes(msg.word.toLowerCase())) {
        settings.addedWords.push(msg.word.toLowerCase());
        chrome.storage.sync.set({ settings }, () => {
          sendResponse({ ok: true });
        });
      } else {
        sendResponse({ ok: true });
      }
    });
    return true;
  }

  if (msg.type === 'IGNORE_WORD') {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      if (!settings.ignoredWords.includes(msg.word.toLowerCase())) {
        settings.ignoredWords.push(msg.word.toLowerCase());
        chrome.storage.sync.set({ settings }, () => {
          sendResponse({ ok: true });
        });
      } else {
        sendResponse({ ok: true });
      }
    });
    return true;
  }

  if (msg.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.get('settings', (data) => {
      const settings = { ...(data.settings || DEFAULT_SETTINGS), ...msg.settings };
      chrome.storage.sync.set({ settings }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }
});
