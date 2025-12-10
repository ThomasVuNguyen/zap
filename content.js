// Generate a unique selector for an element
function generateSelector(element) {
  // Try ID first (most reliable)
  if (element.id) {
    const idSelector = `#${CSS.escape(element.id)}`;
    if (document.querySelectorAll(idSelector).length === 1) {
      return idSelector;
    }
  }
  
  // Try class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className
      .split(' ')
      .filter(c => c && !c.includes(':'))
      .map(c => CSS.escape(c))
      .join('.');
    
    if (classes) {
      const tagName = element.tagName.toLowerCase();
      const selector = `${tagName}.${classes}`;
      // Check if selector is unique
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (e) {
        // Invalid selector, continue to fallback
      }
    }
  }
  
  // Use path-based selector as fallback
  const path = [];
  let current = element;
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops
  
  while (current && current !== document.body && depth < maxDepth) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }
    
    const parent = current.parentElement;
    if (!parent) break;
    
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    
    if (index >= 0) {
      selector += `:nth-child(${index + 1})`;
      path.unshift(selector);
    }
    
    current = parent;
    depth++;
  }
  
  return path.join(' > ') || element.tagName.toLowerCase();
}

// Save zapped element to storage
async function saveZappedElement(selector) {
  const url = window.location.href;
  const key = `zapped_${url}`;
  
  const result = await chrome.storage.local.get([key]);
  const zappedElements = result[key] || [];
  
  if (!zappedElements.includes(selector)) {
    zappedElements.push(selector);
    await chrome.storage.local.set({ [key]: zappedElements });
  }
}

// Load and restore zapped elements
async function restoreZappedElements() {
  const url = window.location.href;
  const key = `zapped_${url}`;
  
  const result = await chrome.storage.local.get([key]);
  const zappedElements = result[key] || [];
  
  zappedElements.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.display = 'none';
        el.setAttribute('data-zapped', 'true');
      });
    } catch (e) {
      console.warn('Failed to restore zapped element:', selector, e);
    }
  });
}

// Zap an element
function zapElement(element) {
  const selector = generateSelector(element);
  console.log('⚡ Zapping element:', selector);
  
  // Hide the element with visual feedback
  element.style.transition = 'opacity 0.2s ease-out';
  element.style.opacity = '0';
  
  setTimeout(() => {
    element.style.display = 'none';
    element.setAttribute('data-zapped', 'true');
  }, 200);
  
  // Save to storage
  saveZappedElement(selector);
}

// Zap mode state
let zapModeActive = false;
let hoverOverlay = null;
let currentHoverElement = null;
let clickCaptureOverlay = null;
let zapModeStyle = null;

// Create hover overlay
function createHoverOverlay() {
  if (hoverOverlay) return hoverOverlay;
  
  const overlay = document.createElement('div');
  overlay.id = 'zap-hover-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 999999;
    border: 2px solid #6366f1;
    background: rgba(99, 102, 241, 0.1);
    transition: all 0.1s ease-out;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
  `;
  document.body.appendChild(overlay);
  
  const infoBox = document.createElement('div');
  infoBox.id = 'zap-info-box';
  infoBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 1000000;
    background: #1f2937;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    max-width: 300px;
    word-wrap: break-word;
    display: none;
  `;
  document.body.appendChild(infoBox);
  
  hoverOverlay = { overlay, infoBox };
  return hoverOverlay;
}

// Update hover overlay position and info
function updateHoverOverlay(element) {
  if (!zapModeActive || !element || element === document.body || element === document.documentElement) {
    hideHoverOverlay();
    return;
  }
  
  // Don't show overlay for our own elements
  if (element.id === 'zap-hover-overlay' || 
      element.id === 'zap-info-box' || 
      element.id === 'zap-mode-indicator' ||
      element.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')) {
    return;
  }
  
  const { overlay, infoBox } = createHoverOverlay();
  
  try {
    const rect = element.getBoundingClientRect();
    
    // Skip if element has no dimensions
    if (rect.width === 0 && rect.height === 0) {
      return;
    }
    
    // Update overlay position
    overlay.style.display = 'block';
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${Math.max(rect.width, 1)}px`;
    overlay.style.height = `${Math.max(rect.height, 1)}px`;
    
    // Get element info
    const tagName = element.tagName ? element.tagName.toLowerCase() : 'element';
    const id = element.id ? `#${element.id}` : '';
    let classes = '';
    if (element.className && typeof element.className === 'string') {
      const classList = element.className.split(' ').filter(c => c && c.trim()).slice(0, 3);
      classes = classList.length > 0 ? `.${classList.join('.')}` : '';
    }
    const text = element.textContent ? element.textContent.trim().substring(0, 50) : '';
    
    // Update info box
    infoBox.style.display = 'block';
    infoBox.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">${tagName}${id}${classes}</div>
      ${text ? `<div style="color: #9ca3af; font-size: 11px;">${text}${text.length >= 50 ? '...' : ''}</div>` : ''}
      <div style="color: #6366f1; margin-top: 4px; font-size: 11px;">Click to zap</div>
    `;
    
    // Force layout calculation
    infoBox.offsetHeight;
    
    // Position info box above or below element
    const infoRect = infoBox.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceAbove > infoRect.height + 10) {
      // Position above
      infoBox.style.top = `${rect.top + window.scrollY - infoRect.height - 8}px`;
      infoBox.style.left = `${rect.left + window.scrollX}px`;
    } else {
      // Position below
      infoBox.style.top = `${rect.bottom + window.scrollY + 8}px`;
      infoBox.style.left = `${rect.left + window.scrollX}px`;
    }
    
    currentHoverElement = element;
  } catch (e) {
    console.warn('Error updating hover overlay:', e);
  }
}

// Hide hover overlay
function hideHoverOverlay() {
  if (hoverOverlay) {
    hoverOverlay.overlay.style.display = 'none';
    hoverOverlay.infoBox.style.display = 'none';
  }
  currentHoverElement = null;
}

// Handle mouse move in zap mode
function handleZapModeMouseMove(event) {
  if (!zapModeActive) return;
  
  // Throttle for performance
  if (handleZapModeMouseMove._throttle) {
    clearTimeout(handleZapModeMouseMove._throttle);
  }
  
  handleZapModeMouseMove._throttle = setTimeout(() => {
    handleZapModeMouseMove._throttle = null;
    
    // Get element from point - this works even with pointer-events: none
    let element = document.elementFromPoint(event.clientX, event.clientY);
    
    // Skip our own overlay elements
    if (element && (
      element.id === 'zap-hover-overlay' || 
      element.id === 'zap-info-box' || 
      element.id === 'zap-mode-indicator' ||
      element.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')
    )) {
      return;
    }
    
    // Skip body and html elements
    if (element && element !== document.body && element !== document.documentElement) {
      // Find a meaningful element to highlight (not just text nodes)
      while (element && (
        element.nodeType === Node.TEXT_NODE ||
        element === document.body ||
        element === document.documentElement ||
        element.id === 'zap-hover-overlay' ||
        element.id === 'zap-info-box' ||
        element.id === 'zap-mode-indicator'
      )) {
        element = element.parentElement;
      }
      
      if (element && element !== document.body && element !== document.documentElement) {
        updateHoverOverlay(element);
      } else {
        hideHoverOverlay();
      }
    } else {
      hideHoverOverlay();
    }
  }, 16); // ~60fps throttling
}

// Handle mousedown in zap mode (capture early to prevent default behavior)
function handleZapModeMouseDown(event) {
  if (!zapModeActive) return;
  
  // Don't zap if clicking on overlay or popup
  const target = event.target;
  if (target.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')) {
    return;
  }
  
  // Prevent all default behaviors immediately - this must happen first
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  // Get element from click coordinates (use the original target, not elementFromPoint)
  let elementToZap = target;
  
  // If it's a link or button, zap the element itself
  if (elementToZap.tagName === 'A' || elementToZap.tagName === 'BUTTON' || 
      elementToZap.onclick || elementToZap.getAttribute('href')) {
    // Zap this element
  } else {
    // Find the closest zap-able parent
    while (elementToZap && elementToZap !== document.body) {
      if (elementToZap.getAttribute('data-zapped') !== 'true') {
        break;
      }
      elementToZap = elementToZap.parentElement;
    }
  }
  
  if (elementToZap && elementToZap !== document.body && elementToZap !== document.documentElement) {
    zapElement(elementToZap);
    hideHoverOverlay();
  }
  
  return false;
}

// Handle click in zap mode (backup handler)
function handleZapModeClick(event) {
  if (!zapModeActive) return;
  
  // Don't zap if clicking on overlay or popup
  if (event.target.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')) {
    return;
  }
  
  // Prevent all default behaviors
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  // Get element from click coordinates
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (element && !element.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')) {
    zapElement(element);
    hideHoverOverlay();
  }
  
  return false;
}

// Handle ESC key to exit zap mode
function handleKeyDown(event) {
  if (event.key === 'Escape' && zapModeActive) {
    deactivateZapMode();
  }
}

// Activate zap mode
function activateZapMode() {
  zapModeActive = true;
  document.body.style.cursor = 'crosshair';
  
  // Inject CSS to prevent default click behaviors on interactive elements
  // Note: pointer-events: none doesn't prevent elementFromPoint from working
  if (!zapModeStyle) {
    zapModeStyle = document.createElement('style');
    zapModeStyle.id = 'zap-mode-style';
    zapModeStyle.textContent = `
      body[data-zap-mode="true"] a,
      body[data-zap-mode="true"] button,
      body[data-zap-mode="true"] input[type="button"],
      body[data-zap-mode="true"] input[type="submit"],
      body[data-zap-mode="true"] [role="button"],
      body[data-zap-mode="true"] [onclick],
      body[data-zap-mode="true"] [href]:not([href=""]) {
        pointer-events: none !important;
        cursor: crosshair !important;
      }
      body[data-zap-mode="true"] {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(zapModeStyle);
  }
  document.body.setAttribute('data-zap-mode', 'true');
  
  // Add event listeners in capture phase to intercept clicks early
  document.addEventListener('mousemove', handleZapModeMouseMove, true);
  document.addEventListener('mousedown', handleZapModeMouseDown, true);
  document.addEventListener('click', handleZapModeClick, true);
  document.addEventListener('keydown', handleKeyDown);
  
  // Prevent context menu in zap mode
  document.addEventListener('contextmenu', (e) => {
    if (zapModeActive && !e.target.closest('#zap-hover-overlay, #zap-info-box, #zap-mode-indicator')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  
  // Show indicator
  const indicator = document.createElement('div');
  indicator.id = 'zap-mode-indicator';
  indicator.textContent = '⚡ Zap Mode Active - Click elements to zap, ESC to exit';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #6366f1;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    z-index: 999999;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  `;
  document.body.appendChild(indicator);
  
  console.log('⚡ Zap mode activated');
}

// Deactivate zap mode
function deactivateZapMode() {
  zapModeActive = false;
  document.body.style.cursor = '';
  document.body.removeAttribute('data-zap-mode');
  
  window.removeEventListener('mousemove', handleZapModeMouseMove, true);
  document.removeEventListener('mousedown', handleZapModeMouseDown, true);
  document.removeEventListener('click', handleZapModeClick, true);
  document.removeEventListener('keydown', handleKeyDown);
  
  // Clear throttle
  if (handleZapModeMouseMove._throttle) {
    clearTimeout(handleZapModeMouseMove._throttle);
    handleZapModeMouseMove._throttle = null;
  }
  
  hideHoverOverlay();
  
  // Remove click capture overlay
  if (clickCaptureOverlay) {
    clickCaptureOverlay.remove();
    clickCaptureOverlay = null;
  }
  
  // Remove indicator
  const indicator = document.getElementById('zap-mode-indicator');
  if (indicator) {
    indicator.remove();
  }
  
  // Remove overlay elements
  if (hoverOverlay) {
    hoverOverlay.overlay.remove();
    hoverOverlay.infoBox.remove();
    hoverOverlay = null;
  }
  
  console.log('⚡ Zap mode deactivated');
}

// Handle click to zap elements (legacy Ctrl/Cmd + Click)
function handleZapClick(event) {
  // Check if we're in zap mode (Ctrl/Cmd + Click)
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    
    zapElement(event.target);
    
    return false;
  }
}

// Initialize
function init() {
  console.log('⚡ Zap extension loaded');
  
  // Restore zapped elements on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreZappedElements);
  } else {
    restoreZappedElements();
  }
  
  // Handle dynamic content (for SPAs)
  const observer = new MutationObserver(() => {
    restoreZappedElements();
  });
  
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Listen for zap clicks (Ctrl/Cmd + Click) - legacy method
  document.addEventListener('click', handleZapClick, true);
  
  // Listen for messages from popup and background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleZapMode') {
      if (request.active) {
        activateZapMode();
      } else {
        deactivateZapMode();
      }
      sendResponse({ success: true });
    } else if (request.action === 'zapElement') {
      const element = document.elementFromPoint(request.x || 0, request.y || 0);
      if (element) {
        zapElement(element);
        sendResponse({ success: true });
      }
    }
    return true; // Keep message channel open for async response
  });
  
  // Check if zap mode should be active on load
  // We'll check this when the popup opens or when a message is received
  // For now, zap mode starts inactive and is activated via popup
}

// Wait for document to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
