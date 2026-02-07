// Load saved config
chrome.storage.sync.get(['apiKey', 'provider', 'targetLang', 'theme', 'showFab', 'hotkeyMode', 'translationMode'], (result) => {
  if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
  if (result.provider) document.getElementById('provider').value = result.provider;
  if (result.targetLang) document.getElementById('targetLang').value = result.targetLang;
  if (result.theme) document.getElementById('theme').value = result.theme;
  document.getElementById('showFab').checked = result.showFab !== false; // Default true

  // Hotkey default: alt_q
  const mode = result.hotkeyMode || 'alt_q';
  document.getElementById('hotkeyMode').value = mode;

  // Translation Mode default: vocabulary
  const transMode = result.translationMode || 'vocabulary';
  document.getElementById('translationMode').value = transMode;
});

// Save on change
document.getElementById('apiKey').addEventListener('input', saveConfig);
document.getElementById('provider').addEventListener('change', saveConfig);
document.getElementById('targetLang').addEventListener('change', saveConfig);
document.getElementById('theme').addEventListener('change', saveConfig);
document.getElementById('showFab').addEventListener('change', saveConfig);
document.getElementById('hotkeyMode').addEventListener('change', saveConfig);
document.getElementById('translationMode').addEventListener('change', saveConfig);

function saveConfig() {
  return new Promise((resolve) => {
    const config = {
      apiKey: document.getElementById('apiKey').value,
      provider: document.getElementById('provider').value,
      targetLang: document.getElementById('targetLang').value,
      theme: document.getElementById('theme').value,
      showFab: document.getElementById('showFab').checked,
      hotkeyMode: document.getElementById('hotkeyMode').value,
      translationMode: document.getElementById('translationMode').value
    };
    chrome.storage.sync.set(config, resolve);
  });
}

// Start capture
document.getElementById('startBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value;

  if (!apiKey) {
    alert('Vui lòng nhập API key!');
    return;
  }

  // Save first and wait
  await saveConfig();

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
