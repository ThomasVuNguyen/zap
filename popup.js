// Popup script for Zap extension
let zapModeActive = false;

// Get current tab and check zap mode status
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  
  const tabId = tab.id;
  const url = tab.url;
  
  // Check if this is a chrome:// page or similar where content scripts don't work
  if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://'))) {
    showError('Zap mode doesn\'t work on browser internal pages. Please navigate to a regular website.');
    return;
  }
  
  // Check if zap mode is active for this tab
  chrome.storage.local.get([`zapMode_${tabId}`], (result) => {
    zapModeActive = result[`zapMode_${tabId}`] || false;
    updateUI();
  });
});

function updateUI() {
  const button = document.getElementById('zapToggle');
  const status = document.getElementById('status');
  
  if (zapModeActive) {
    button.textContent = 'Deactivate Zap Mode';
    button.className = 'zap-button active';
    status.textContent = '⚡ Zap mode is ON';
    status.className = 'status active';
  } else {
    button.textContent = 'Activate Zap Mode';
    button.className = 'zap-button inactive';
    status.textContent = 'Zap mode is OFF';
    status.className = 'status inactive';
  }
}

function showError(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status error';
  status.style.background = '#fee2e2';
  status.style.color = '#991b1b';
}

function showLoading() {
  const button = document.getElementById('zapToggle');
  button.disabled = true;
  button.textContent = 'Loading...';
}

function hideLoading() {
  const button = document.getElementById('zapToggle');
  button.disabled = false;
  updateUI();
}

document.getElementById('zapToggle').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    
    const tabId = tab.id;
    const url = tab.url;
    
    // Check if this is a chrome:// page
    if (url && (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://'))) {
      showError('Zap mode doesn\'t work on browser internal pages.');
      return;
    }
    
    showLoading();
    zapModeActive = !zapModeActive;
    
    // Save state
    chrome.storage.local.set({ [`zapMode_${tabId}`]: zapModeActive }, () => {
      // Send message to content script
      chrome.tabs.sendMessage(tabId, {
        action: 'toggleZapMode',
        active: zapModeActive
      }, (response) => {
        hideLoading();
        
        if (chrome.runtime.lastError) {
          // Content script might not be loaded, try injecting it
          console.log('Content script not loaded, injecting...', chrome.runtime.lastError);
          
          // Try to inject the script
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              showError('Failed to activate zap mode. Please refresh the page and try again.');
              zapModeActive = !zapModeActive; // Revert
              chrome.storage.local.set({ [`zapMode_${tabId}`]: zapModeActive });
            } else {
              // Wait a bit then send message again
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, {
                  action: 'toggleZapMode',
                  active: zapModeActive
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    showError('Failed to activate zap mode.');
                    zapModeActive = !zapModeActive;
                    chrome.storage.local.set({ [`zapMode_${tabId}`]: zapModeActive });
                  } else {
                    updateUI();
                    // Close popup after a short delay so user can see zap mode indicator
                    setTimeout(() => window.close(), 300);
                  }
                });
              }, 100);
            }
          });
        } else {
          updateUI();
          // Close popup after activation so user can see the page
          if (zapModeActive) {
            setTimeout(() => window.close(), 300);
          }
        }
      });
    });
  });
});

