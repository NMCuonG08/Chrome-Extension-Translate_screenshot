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
    showResult(result);

  } catch (error) {
    console.error('❌ Error:', error);
    loading.remove();
    alert('Lỗi: ' + error.message);
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
            text: `Read all text in this image and translate to ${targetLang === 'vi' ? 'Vietnamese' : 'English'}.

Response format:
{
  "original": "text in image",
  "translation": "translated text",
  "language": "detected language"
}`
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API error');
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Parse error' };
}

// Show result
function showResult(result) {
  // Remove existing result if any
  const existing = document.getElementById('ocr-result');
  if (existing) existing.remove();

  const resultBox = document.createElement('div');
  resultBox.id = 'ocr-result';

  resultBox.innerHTML = `
    <div id="ocr-result-header">
      <h3 id="ocr-result-title">Kết quả</h3>
      <button id="ocr-result-close">×</button>
    </div>
    <div id="ocr-result-content">
      <span class="ocr-label">Gốc (${escapeHtml(result.language || 'Unknown')}):</span>
      <div class="ocr-text-block">${escapeHtml(result.original)}</div>
      <span class="ocr-label">Dịch:</span>
      <div class="ocr-text-block">${escapeHtml(result.translation)}</div>
    </div>
  `;
  document.body.appendChild(resultBox);

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

function makeDraggable(element) {
  const header = element.querySelector('#ocr-result-header');
  if (!header) return;

  let isDragging = false;
  let initialX;
  let initialY;

  header.addEventListener('mousedown', dragStart);

  function dragStart(e) {
    // Ignore clicks on buttons/interactive elements inside header
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

    // Calculate click offset relative to the element's top-left
    const rect = element.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;

    isDragging = true;

    // Once we start dragging, we need to switch from 'translate(-50%, -50%)' centering 
    // to fixed positioning to follow the mouse accurately.
    // Set explicit position and remove transform
    element.style.transform = 'none';
    element.style.left = rect.left + 'px';
    element.style.top = rect.top + 'px';
    // Ensure width is maintained if it was implicitly set
    element.style.width = rect.width + 'px';

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      const currentX = e.clientX - initialX;
      const currentY = e.clientY - initialY;

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
    }
  }

  function dragEnd(e) {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
