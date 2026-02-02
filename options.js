// Load saved config
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['apiKey', 'provider', 'targetLang', 'theme'], (result) => {
        if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
        if (result.provider) document.getElementById('provider').value = result.provider;
        if (result.targetLang) document.getElementById('targetLang').value = result.targetLang;

        // Set theme select
        const currentTheme = result.theme || 'light';
        document.getElementById('theme').value = currentTheme;
        applyTheme(currentTheme);
    });
});

// Save config
document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const provider = document.getElementById('provider').value;
    const targetLang = document.getElementById('targetLang').value;
    const theme = document.getElementById('theme').value;

    if (!apiKey) {
        showStatus('Vui lòng nhập API Key', 'error');
        return;
    }

    // Apply theme immediately
    applyTheme(theme);

    chrome.storage.sync.set({
        apiKey: apiKey,
        provider: provider,
        targetLang: targetLang,
        theme: theme
    }, () => {
        showStatus('Đã lưu cấu hình thành công!', 'success');
    });
});

document.getElementById('theme').addEventListener('change', (e) => {
    applyTheme(e.target.value);
});

function applyTheme(theme) {
    if (theme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    } else if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function showStatus(text, type) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.className = type;
    setTimeout(() => {
        status.className = '';
    }, 2000);
}
