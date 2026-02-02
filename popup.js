// Load saved config
chrome.storage.sync.get(['apiKey', 'provider', 'targetLang', 'theme', 'showFab'], (result) => {
  if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
  if (result.provider) document.getElementById('provider').value = result.provider;
  if (result.targetLang) document.getElementById('targetLang').value = result.targetLang;
  if (result.theme) document.getElementById('theme').value = result.theme;
  document.getElementById('showFab').checked = result.showFab !== false; // Default true
});

// Save on change
document.getElementById('apiKey').addEventListener('input', saveConfig);
document.getElementById('provider').addEventListener('change', saveConfig);
document.getElementById('targetLang').addEventListener('change', saveConfig);
document.getElementById('theme').addEventListener('change', saveConfig);
document.getElementById('showFab').addEventListener('change', saveConfig);

function saveConfig() {
  const config = {
    apiKey: document.getElementById('apiKey').value,
    provider: document.getElementById('provider').value,
    targetLang: document.getElementById('targetLang').value,
    theme: document.getElementById('theme').value,
    showFab: document.getElementById('showFab').checked
  };
  chrome.storage.sync.set(config);
}

// Start capture
document.getElementById('startBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value;

  if (!apiKey) {
    alert('Vui lòng nhập API key!');
    return;
  }

  // Save first
  saveConfig();

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Send message to background to start capture
  chrome.runtime.sendMessage({
    action: 'startCapture',
    tabId: tab.id
  });

  // Close popup
  window.close();
});
