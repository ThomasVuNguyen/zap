// Background service worker for Zap extension
// Handles storage cleanup and management

// Clean up old zapped data periodically (optional)
chrome.runtime.onInstalled.addListener(() => {
  console.log('Zap extension installed');
});

// Optional: Add context menu for easier access
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'zap-element',
      title: 'Zap this element',
      contexts: ['all']
    });
    chrome.contextMenus.create({
      id: 'activate-zap-mode',
      title: 'Activate Zap Mode',
      contexts: ['all']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'zap-element') {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'zapElement', 
      x: info.pageX,
      y: info.pageY
    });
  } else if (info.menuItemId === 'activate-zap-mode') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleZapMode',
      active: true
    });
  }
});

// Handle messages from content script to get current tab
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs[0]?.id });
    });
    return true; // Keep message channel open
  }
});

