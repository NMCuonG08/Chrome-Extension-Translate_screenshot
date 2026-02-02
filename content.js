// Initialize
console.log('✅ Screen OCR content script loaded');

let overlay, selectionBox, startX, startY, isDrawing = false;

// Listen for init message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'init') {
    console.log('🎯 Starting capture from message...');
    startCapture();
    sendResponse({ success: true });
  }
  return true;
});

// Auto-create FAB on load
(async function initFAB() {
  console.log('🚀 Initializing OCR FAB...');
  const config = await chrome.storage.sync.get(['theme', 'showFab']);

  // Check setting (default true)
  if (config.showFab === false) {
    removeFAB();
    return;
  }

  createOrUpdateFAB(config.theme);
})();

// Listen for storage changes to update FAB immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.showFab) {
      if (changes.showFab.newValue === false) {
        removeFAB();
      } else {
        chrome.storage.sync.get(['theme'], (result) => {
          createOrUpdateFAB(result.theme);
        });
      }
    }
    if (changes.theme) {
      // Update theme on existing FAB
      const fab = document.getElementById('ocr-fab');
      if (fab) {
        // Determine new class
        const theme = changes.theme.newValue || 'light';
        const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) fab.classList.add('ocr-theme-dark');
        else fab.classList.remove('ocr-theme-dark');
      }
    }
  }
});

function removeFAB() {
  const fab = document.getElementById('ocr-fab');
  if (fab) fab.remove();
}

function createOrUpdateFAB(theme) {
  if (document.getElementById('ocr-fab')) return; // Already exists

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeClass = isDark ? 'ocr-theme-dark' : '';

  const fab = document.createElement('div');
  fab.id = 'ocr-fab';
  if (themeClass) fab.classList.add(themeClass);

  // Force pointer events and z-index safety
  fab.style.pointerEvents = 'auto'; // Ensure clickable

  // Icon
  fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/></svg>`;

  document.body.appendChild(fab);

  // Use mousedown instead of click to avoid potential conflicts with drag listeners or other overlays
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔘 FAB Clicked');
    startCapture();
  });
}

let currentThemeClass = '';

async function startCapture() {
  // Clean up any existing overlay first
  cleanup();

  // Determine theme
  const config = await chrome.storage.sync.get(['theme']);
  const theme = config.theme || 'light';
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  currentThemeClass = isDark ? 'ocr-theme-dark' : '';

  console.log('📸 Creating overlay...');

  // Create overlay
  overlay = document.createElement('div');
  overlay.id = 'ocr-overlay';
  if (currentThemeClass) overlay.classList.add(currentThemeClass);

  overlay.innerHTML = `
    <div id="ocr-hint" class="${currentThemeClass}">Kéo chuột để chọn vùng • ESC để hủy</div>
    <div id="ocr-selection"></div>
  `;
  document.body.appendChild(overlay);

  selectionBox = document.getElementById('ocr-selection');

  console.log('✅ Overlay created, attaching events...');

  // Event listeners
  overlay.addEventListener('mousedown', onMouseDown, true);
  overlay.addEventListener('mousemove', onMouseMove, true);
  overlay.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('keydown', onKeyDown);
}

function onMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();
  isDrawing = true;
  startX = e.clientX;
  startY = e.clientY;

  console.log('🖱️ Mouse down:', startX, startY);

  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

function onMouseMove(e) {
  if (!isDrawing) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
}

async function onMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;

  console.log('🖱️ Mouse up');

  // Remove listeners immediately to prevent accidental capture
  overlay.removeEventListener('mousedown', onMouseDown, true);
  overlay.removeEventListener('mousemove', onMouseMove, true);
  overlay.removeEventListener('mouseup', onMouseUp, true);

  const rect = selectionBox.getBoundingClientRect();

  console.log('📏 Selection:', rect);

  if (rect.width < 20 || rect.height < 20) {
    console.log('⚠️ Too small');
    cleanup();
    return;
  }

  cleanup();

  // Show loading
  const loading = document.createElement('div');
  loading.id = 'ocr-loading';
  if (currentThemeClass) loading.classList.add(currentThemeClass);
  loading.textContent = 'Đang xử lý...';
  document.body.appendChild(loading);

  try {
    console.log('📸 Capturing tab...');

    // Get screenshot
    const response = await chrome.runtime.sendMessage({ action: 'captureTab' });

    if (response.error) {
      throw new Error(response.error);
    }

    console.log('✂️ Cropping...');

    const dataUrl = response.dataUrl;

    // Crop it
    const croppedImage = await cropImage(dataUrl, rect);

    console.log('🔑 Getting config...');

    // Get config
    const config = await chrome.storage.sync.get(['apiKey', 'provider', 'targetLang']);

    if (!config.apiKey) {
      throw new Error('Chưa cấu hình API key!');
    }

    console.log('🤖 Calling AI...');

    // Call AI
    const result = await callGroqAPI(croppedImage, config.apiKey, config.targetLang || 'vi');

    console.log('✅ Got result:', result);

    // Remove loading
    loading.remove();

    // Show result
    showResult(result, config.apiKey);

  } catch (error) {
    console.error('❌ Error:', error);
    if (document.getElementById('ocr-loading')) {
      document.getElementById('ocr-loading').remove();
    }
    showError('Lỗi xử lý', error.message);
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    console.log('❌ Cancelled');
    cleanup();
  }
}

function cleanup() {
  if (overlay && overlay.parentNode) {
    overlay.remove();
  }
  overlay = null;
  selectionBox = null;
  isDrawing = false;
  document.removeEventListener('keydown', onKeyDown);
}

// Crop image using canvas
function cropImage(dataUrl, rect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = window.devicePixelRatio || 1;

      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale,
        0, 0, rect.width * scale, rect.height * scale
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

// Call Groq API
async function callGroqAPI(imageBase64, apiKey, targetLang) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageBase64 } },
          {
            type: 'text',
            text: `Read text in image. Translate to ${targetLang}. Return JSON: {"original": "text", "translation": "translated", "language": "detected lang"}`
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API error');
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text);
}

// Translate Text Only
async function translateTextOnly(text, targetLang, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Translate the following text to ${targetLang}. Return JSON only: {"translation": "translated text"}\n\nText: ${text}`
      }],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Translation API error');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

// Show result
function showResult(result, apiKey) {
  // Remove existing result if any
  const existing = document.getElementById('ocr-result');
  if (existing) existing.remove();

  const resultBox = document.createElement('div');
  resultBox.id = 'ocr-result';
  if (currentThemeClass) resultBox.classList.add(currentThemeClass);

  // Available languages
  const languages = [
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ru', name: 'Russian' }
  ];

  const options = languages.map(l => `<option value="${l.code}">${l.name}</option>`).join('');

  resultBox.innerHTML = `
    <div id="ocr-result-header">
      <h3 id="ocr-result-title">Kết quả</h3>
      <button id="ocr-result-close">×</button>
    </div>
    <div id="ocr-result-content">
      <span class="ocr-label">
        Gốc (${escapeHtml(result.language || 'Unknown')}):
      </span>
      <div class="ocr-text-block" id="ocr-original-text">${escapeHtml(result.original)}</div>
      
      <!-- Actions for Original Text -->
      <div class="ocr-actions">
        <button class="ocr-icon-btn" id="ocr-btn-speak" title="Nghe đọc">
            <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            Nghe
        </button>
        <button class="ocr-icon-btn" id="ocr-btn-mic" title="Luyện phát âm">
            <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            Luyện Nói
        </button>
      </div>

      <div id="ocr-pronunciation-feedback">
        <strong>Kết quả phát âm:</strong> <span id="ocr-score-val">--</span>
        <div id="ocr-said-text" style="margin-top:5px; font-style:italic; color: #888;"></div>
        <button id="ocr-btn-retry">🔄 Thử lại (Try Again)</button>
      </div>

      <span class="ocr-label">
        Dịch sang:
        <select id="ocr-lang-select" class="ocr-lang-select">
          ${options}
        </select>
      </span>
      <div id="ocr-translation-text" class="ocr-text-block">${escapeHtml(result.translation)}</div>
      
      <button id="ocr-scan-next">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        Quét tiếp (Next Scan)
      </button>

    </div>
  `;
  document.body.appendChild(resultBox);

  setupResultEvents(result, apiKey, resultBox);

  // Make draggable
  makeDraggable(resultBox);
}

function setupResultEvents(result, apiKey, resultBox) {
  // 1. Language Change
  const select = document.getElementById('ocr-lang-select');
  select.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    const transDiv = document.getElementById('ocr-translation-text');

    transDiv.textContent = 'Đang dịch lại...';
    transDiv.style.opacity = '0.7';

    try {
      const newResult = await translateTextOnly(result.original, newLang, apiKey);
      transDiv.textContent = newResult.translation;
      transDiv.style.opacity = '1';
    } catch (err) {
      showError('Lỗi dịch', err.message);
      transDiv.textContent = 'Lỗi: ' + err.message;
    }
  });

  // 2. TTS (Speak)
  const speakBtn = document.getElementById('ocr-btn-speak');
  speakBtn.addEventListener('click', () => {
    // New: Google TTS
    const langName = result.language || 'English';
    const langCode = mapLanguageToCode(langName);
    playGoogleTTS(result.original, langCode);
  });

  // 3. Pronunciation (Mic)
  const micBtn = document.getElementById('ocr-btn-mic');

  const handleMicClick = () => {
    if (!('webkitSpeechRecognition' in window)) {
      showError('Lỗi', 'Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    // Map language for recognition
    const langName = result.language || 'English';
    recognition.lang = mapLanguageToCode(langName, true); // true for full locale like vi-VN

    // Helper to start recording
    const startRecording = () => {
      micBtn.innerHTML = '🎤 Đang nghe...';
      micBtn.style.color = '#d63031';

      const feedbackBox = document.getElementById('ocr-pronunciation-feedback');
      feedbackBox.classList.add('active');
      document.getElementById('ocr-said-text').textContent = 'Hãy đọc đoạn văn bản trên...';
      document.getElementById('ocr-score-val').textContent = '--';
      document.getElementById('ocr-btn-retry').style.display = 'none';

      try { recognition.start(); } catch (e) { console.warn('Recognition already started'); }
    };

    // Initial start
    startRecording();

    // Retry button logic
    const retryBtn = document.getElementById('ocr-btn-retry');
    retryBtn.onclick = startRecording;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const score = calculateSimilarity(result.original, transcript);

      document.getElementById('ocr-said-text').textContent = `Bạn nói: "${transcript}"`;

      const scoreEl = document.getElementById('ocr-score-val');
      scoreEl.textContent = `${Math.round(score * 100)}%`;
      scoreEl.className = score > 0.8 ? 'ocr-score-high' : (score > 0.5 ? 'ocr-score-mid' : 'ocr-score-low');

      // Show retry
      document.getElementById('ocr-btn-retry').style.display = 'block';

      micBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Luyện Nói`;
      micBtn.style.color = '';
    };

    recognition.onerror = (event) => {
      console.error('Speech error', event);
      micBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Luyện Nói`;
      micBtn.style.color = '';

      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showError('Lỗi Micro', event.error);
      }
    };

    recognition.onend = () => {
      if (micBtn.innerHTML.includes('Đang nghe')) {
        micBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Luyện Nói`;
        micBtn.style.color = '';
      }
    };
  };

  micBtn.addEventListener('click', handleMicClick);

  // 4. Close
  const closeBtn = document.getElementById('ocr-result-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resultBox.remove();
    });
  }

  // 5. Scan Next
  const nextBtn = document.getElementById('ocr-scan-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      resultBox.remove();
      startCapture();
    });
  }
}

// Google TTS Helper
function playGoogleTTS(text, lang) {
  // Basic cleaning
  const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
  if (!cleanText) return;

  // Google TTS URL (unofficial but standard for extensions)
  // client=gtx, tl=targetLang, q=query
  const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&dt=t&q=${encodeURIComponent(cleanText)}`;

  const audio = new Audio(url);
  audio.play().catch(e => {
    console.error('GTTS Play failed', e);
    // Fallback to browser
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  });
}

// Language Map Helper
function mapLanguageToCode(langName, fullLocale = false) {
  const l = (langName || '').toLowerCase();

  if (l.includes('vietnam')) return fullLocale ? 'vi-VN' : 'vi';
  if (l.includes('japan')) return fullLocale ? 'ja-JP' : 'ja';
  if (l.includes('korea')) return fullLocale ? 'ko-KR' : 'ko';
  if (l.includes('china')) return fullLocale ? 'zh-CN' : 'zh-CN';
  if (l.includes('french')) return fullLocale ? 'fr-FR' : 'fr';
  if (l.includes('german')) return fullLocale ? 'de-DE' : 'de';
  if (l.includes('russia')) return fullLocale ? 'ru-RU' : 'ru';

  // Default English
  return fullLocale ? 'en-US' : 'en';
}

// Simple logic to compare strings (Levenshtein-like or just word overlap)
function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const cleanS1 = s1.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/).filter(x => x);
  const cleanS2 = s2.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/).filter(x => x);

  if (cleanS1.length === 0) return 0;

  let matches = 0;
  const set1 = new Set(cleanS1);
  // Simple word match count. For stricter check, we need sequence alignment.
  // But for "fun" scoring, this is enough.
  cleanS2.forEach(w => {
    if (set1.has(w)) matches++;
  });

  // Cap at 1.0
  let score = matches / Math.max(cleanS1.length, cleanS2.length);
  if (score > 1) score = 1;
  return score;
}

function showError(title, message) {
  const toast = document.createElement('div');
  toast.id = 'ocr-error-toast';
  if (currentThemeClass) toast.classList.add(currentThemeClass);
  toast.innerHTML = `
        <div style="font-size: 24px;">⚠️</div>
        <div>
            <span id="ocr-error-title">${escapeHtml(title)}</span>
            <div id="ocr-error-message">${escapeHtml(message)}</div>
        </div>
    `;
  document.body.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function makeDraggable(element) {
  // Attached to the element itself now, not just header
  // But we need to be careful not to block text selection if the user clicks slightly on text
  // However, user requested "drag anywhere", so we prioritize that or find a middle ground.
  // We will allow dragging from anywhere, but if it's on an input/button, we ignore.
  // For text blocks, we might want to allow selection? 
  // User said "press anywhere to move". To support both text selection and moving,
  // we can treat it like a window: title bar moves, body doesn't? 
  // BUT user explicitly said "header only is wrong".
  // So we enable drag on body. Text selection might be tricky.
  // We will try to detect standard text selection behavior vs drag.
  // Actually, easiest valid UX for "Drag Anywhere" + "Copy Text" is:
  // Drag works on the container background.
  // We make sure there is padding/gaps.
  // AND we enforce boundary checks so it's never lost.

  let isDragging = false;
  let startX;
  let startY;
  let initialLeft;
  let initialTop;
  let requestId = null;

  element.addEventListener('mousedown', dragStart);

  function dragStart(e) {
    // Ignore interactive elements
    if (e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'SELECT' ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.closest('button') ||
      e.target.closest('select')) {
      return;
    }

    // Special handling for text content:
    // If clicking on text, we prefer selection over dragging?
    // User requested "press anywhere to move".
    // If we just allow dragging, selection prevents text copy.
    // We will exclude the text-block content from starting a drag
    // UNLESS the user holds a modifier? No.
    // We will exclude clicks strictly INSIDE the text block's text?
    // Let's rely on the class 'ocr-text-block'. 
    // If user clicks on the text block, let them select.
    if (e.target.classList.contains('ocr-text-block') || e.target.closest('.ocr-text-block')) {
      return;
    }

    e.preventDefault();
    isDragging = true;

    startX = e.clientX;
    startY = e.clientY;

    // Get current position
    const rect = element.getBoundingClientRect();

    // Switch to absolute positioning if not already
    // (We did this in CSS 'transform: translate', so we need to lock to pixels)
    // Note: If we are already dragging, style.left is set.
    // If it's the first time (centered), we need to calculate.

    // Current computed style might be centered transform.
    // We disable transform and set explicit left/top.
    element.style.transform = 'none';
    element.style.left = rect.left + 'px';
    element.style.top = rect.top + 'px';
    element.style.margin = '0';

    initialLeft = rect.left;
    initialTop = rect.top;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', dragEnd);
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (requestId) {
      cancelAnimationFrame(requestId);
    }

    requestId = requestAnimationFrame(() => {
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      // Boundary Checks (Keep at least 20px on screen)
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const rect = element.getBoundingClientRect(); // current size

      // Prevent going off left
      if (newLeft + rect.width < 50) newLeft = 50 - rect.width;
      // Prevent going off right
      if (newLeft > windowWidth - 50) newLeft = windowWidth - 50;
      // Prevent going off top (keep header usable)
      if (newTop < 0) newTop = 0;
      // Prevent going off bottom
      if (newTop > windowHeight - 50) newTop = windowHeight - 50;

      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
    });
  }

  function dragEnd(e) {
    isDragging = false;
    if (requestId) {
      cancelAnimationFrame(requestId);
      requestId = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', dragEnd);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
