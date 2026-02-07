// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if configured
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (!result.apiKey) {
      // Open options if no key
      chrome.runtime.openOptionsPage();
    } else {
      // Start capture
      startCapture(tab.id);
    }
  });
});

function startCapture(tabId) {
  console.log('📸 Starting capture for tab:', tabId);

  // Content script is already injected by manifest.json, so just send message
  // to start capture. If content script isn't ready, we'll get an error.
  chrome.tabs.sendMessage(tabId, { action: 'init' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('⚠️ Content script not ready, injecting manually...');
      // Fallback: inject if not loaded (e.g., on extension install/update)
      chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      }).then(() => {
        return chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
      }).then(() => {
        // Wait a bit then send init message
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'init' }, (response2) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Still failed after manual inject:', chrome.runtime.lastError.message);
            } else {
              console.log('✅ Capture started after manual inject!');
            }
          });
        }, 100);
      }).catch((error) => {
        console.error('❌ Injection failed:', error);
      });
    } else {
      console.log('✅ Capture started!');
    }
  });
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startCapture(request.tabId);
  }

  if (request.action === 'captureTab') {
    console.log('📷 Capturing visible tab...');
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Capture error:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('✅ Screenshot captured!');
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true; // Keep channel open for async response
  }
});

console.log('🚀 Background script ready');
