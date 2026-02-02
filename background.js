// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    console.log('📸 Starting capture for tab:', request.tabId);
    
    // First inject CSS
    chrome.scripting.insertCSS({
      target: { tabId: request.tabId },
      files: ['content.css']
    }).then(() => {
      console.log('✅ CSS injected');
      // Then inject script
      return chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        files: ['content.js']
      });
    }).then(() => {
      console.log('✅ Script injected');
      // Wait a bit then send init message
      setTimeout(() => {
        chrome.tabs.sendMessage(request.tabId, { action: 'init' }, (response) => {
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
    return true;
  }
});

console.log('🚀 Background script ready');
