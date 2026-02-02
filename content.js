// Initialize
console.log('✅ Screen OCR content script loaded');

let overlay, selectionBox, startX, startY, isDrawing = false;

// Listen for init message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'init') {
    console.log('🎯 Starting capture...');
    startCapture();
    sendResponse({ success: true });
  }
  return true;
});

function startCapture() {
  // Clean up any existing overlay first
  cleanup();

  console.log('📸 Creating overlay...');

  // Create overlay
  overlay = document.createElement('div');
  overlay.id = 'ocr-overlay';
  overlay.innerHTML = `
    <div id="ocr-hint">Kéo chuột để chọn vùng • ESC để hủy</div>
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
  e.preventDefault();
  e.stopPropagation();

  const currentX = e.clientX;
  const currentY = e.clientY;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

async function onMouseUp(e) {
  if (!isDrawing) return;
  e.preventDefault();
  e.stopPropagation();
  isDrawing = false;

  const rect = {
    left: parseInt(selectionBox.style.left),
    top: parseInt(selectionBox.style.top),
    width: parseInt(selectionBox.style.width),
    height: parseInt(selectionBox.style.height)
  };

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
      <div class="ocr-text-block">${escapeHtml(result.original)}</div>
      
      <span class="ocr-label">
        Dịch sang:
        <select id="ocr-lang-select" class="ocr-lang-select">
          ${options}
        </select>
      </span>
      <div id="ocr-translation-text" class="ocr-text-block">${escapeHtml(result.translation)}</div>
    </div>
  `;
  document.body.appendChild(resultBox);

  // Set initial select value (heuristic: detect if translation is english, etc. but simple default is fine or passed from config)
  // We don't have current targetLang handy easily without passing it down, but 'vi' is default usually.

  const select = document.getElementById('ocr-lang-select');

  // Handle language change
  select.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    const transDiv = document.getElementById('ocr-translation-text');
    const originalText = result.original;

    transDiv.textContent = 'Đang dịch lại...';
    transDiv.style.opacity = '0.7';

    try {
      const newResult = await translateTextOnly(originalText, newLang, apiKey);
      transDiv.textContent = newResult.translation;
      transDiv.style.opacity = '1';
    } catch (err) {
      showError('Lỗi dịch', err.message);
      transDiv.textContent = 'Lỗi: ' + err.message;
    }
  });

  // Close button event
  const closeBtn = document.getElementById('ocr-result-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag start if clicked on button
      resultBox.remove();
    });
  }

  // Make draggable
  makeDraggable(resultBox);
}

function showError(title, message) {
  const toast = document.createElement('div');
  toast.id = 'ocr-error-toast';
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
