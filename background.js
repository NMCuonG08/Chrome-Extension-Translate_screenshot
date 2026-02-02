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

  // First inject CSS
  chrome.scripting.insertCSS({
    target: { tabId: tabId },
    files: ['content.css']
  }).then(() => {
    console.log('✅ CSS injected');
    // Then inject script
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  }).then(() => {
    console.log('✅ Script injected');
    // Wait a bit then send init message
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'init' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Message error:', chrome.runtime.lastError.message);
        } else {
          console.log('✅ Capture started!');
        }
      });
    }, 100);
  }).catch((error) => {
    console.error('❌ Injection failed:', error);
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
