# 🐛 DEBUG GUIDE - Tại sao màn hình KHÔNG MỜ

## ✅ Checklist debug từng bước:

### Bước 1: Load Extension
1. Mở `chrome://extensions/`
2. Bật **Developer mode**  
3. Click **Remove** extension cũ (nếu có)
4. Click **Load unpacked**
5. Chọn folder `screen-ocr-translator`
6. ✅ Check: Extension xuất hiện trong list

### Bước 2: Mở Console để xem logs
1. Ở `chrome://extensions/`, tìm extension
2. Click vào **service worker** (hoặc **background page**)
3. Console của background script sẽ mở
4. ✅ Check: Thấy log `🚀 Background script ready`

### Bước 3: Test trên trang WEB THẬT
1. Mở tab MỚI
2. Truy cập **google.com** (KHÔNG phải chrome://)
3. Mở DevTools (F12) → Tab **Console**
4. ✅ Check: Thấy log `🚀 Content script loaded and ready`

> ⚠️ NẾU KHÔNG thấy log này → Content script CHƯA LOAD!

### Bước 4: Trigger Extension
1. Click vào icon extension trên toolbar
2. Nhập Groq API key
3. Chọn ngôn ngữ
4. Click "Bắt đầu chụp"

### Bước 5: Xem logs
Trong Console của **tab google.com**, bạn sẽ thấy:

```
📨 Message received: init
🎯 Initializing capture mode...
✅ Starting capture...
✅ Overlay created and added to body
✅ Event listeners attached
```

Trong Console của **background script**, bạn sẽ thấy:

```
📸 Starting capture for tab: 123
✅ CSS injected
✅ Script injected  
✅ Capture started!
```

### Bước 6: Check màn hình
- ✅ Màn hình phải MỜ ĐEN (rgba(0,0,0,0.5))
- ✅ Cursor phải thành crosshair (+)
- ✅ Hint "Kéo chuột..." ở trên đầu

## ❌ Troubleshooting

### Vấn đề 1: Không thấy log "Content script loaded"
**Nguyên nhân**: Content script không được inject  
**Fix**:
1. Reload extension: `chrome://extensions/` → Click reload ↻
2. Refresh trang web (F5)
3. Thử lại

### Vấn đề 2: Thấy log nhưng KHÔNG thấy overlay
**Nguyên nhân**: CSS không load hoặc bị conflict  
**Fix**:
1. Mở Elements tab trong DevTools
2. Tìm `<div id="ocr-overlay">`
3. Nếu KHÔNG TÌM THẤY → Script có lỗi, xem Console
4. Nếu TÌM THẤY nhưng không hiển thị → Check CSS

### Vấn đề 3: Màn hình không mờ
**Nguyên nhân**: CSS không áp dụng  
**Debug**:
```javascript
// Paste vào Console:
const overlay = document.getElementById('ocr-overlay');
console.log('Overlay exists:', !!overlay);
if (overlay) {
  console.log('Overlay styles:', window.getComputedStyle(overlay));
}
```

### Vấn đề 4: Thấy overlay nhưng không kéo được
**Nguyên nhân**: Event listeners chưa attach  
**Debug**:
```javascript
// Paste vào Console:
const overlay = document.getElementById('ocr-overlay');
overlay.click();
// Xem có log "🖱️ Mouse down" không
```

## 🧪 Test thủ công

Paste code này vào Console của trang web để test trực tiếp:

```javascript
// Test tạo overlay
const testOverlay = document.createElement('div');
testOverlay.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2147483647;
`;
document.body.appendChild(testOverlay);

// Nếu thấy màn hình mờ → CSS hoạt động!
// Xóa test: testOverlay.remove();
```

## 📋 Expected Flow

```
1. User clicks extension → popup opens
2. User clicks "Bắt đầu chụp" → popup sends message to background
3. Background injects CSS + JS into current tab
4. Content script receives "init" message
5. Content script creates overlay → SCREEN GOES DARK ✅
6. User drags mouse → selection box appears
7. User releases mouse → screenshot captured
8. AI processes → result shown
```

## 🔍 Most Common Issue

**90% trường hợp**: Extension được test trên trang `chrome://extensions/` hoặc `chrome://` URLs.

**Solution**: Test trên **google.com, facebook.com, wikipedia.org**, etc.

---

Nếu follow hết các bước trên mà vẫn không được, gửi screenshot của:
1. Console logs từ background script
2. Console logs từ tab website  
3. Elements tab showing (hoặc không showing) overlay element
