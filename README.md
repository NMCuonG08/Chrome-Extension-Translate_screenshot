# Screen OCR & Translator

Extension Chrome đơn giản để chụp màn hình, OCR và dịch văn bản.

## ✨ Tính năng

- Kéo chuột chọn vùng (giống Snipping Tool)
- OCR văn bản bằng Groq API (MIỄN PHÍ)
- Dịch sang Tiếng Việt hoặc English
- Đơn giản, nhanh, đã test kỹ

## 🚀 Cài đặt

1. Mở Chrome → `chrome://extensions/`
2. Bật **Developer mode**
3. Click **Load unpacked**
4. Chọn folder `screen-ocr-translator`

**QUAN TRỌNG**: Sau khi load extension:
- **RELOAD extension** (click nút reload ở extension)
- **REFRESH trang web** bạn muốn test (F5)
- Nếu không sẽ không hoạt động!

## 🔑 Lấy Groq API Key (MIỄN PHÍ)

1. Truy cập https://console.groq.com/
2. Sign up (dùng Google account)
3. Vào API Keys → Create API Key
4. Copy key

## 📖 Sử dụng

1. Click icon extension
2. Nhập Groq API key
3. Chọn ngôn ngữ dịch
4. Click "Bắt đầu chụp"
5. **Màn hình sẽ MỜ ĐI** ✅
6. **KÉO CHUỘT** để chọn vùng có chữ
7. Thả chuột → Đợi 1-2 giây → Xem kết quả!

## 🐛 Troubleshooting

### Không thấy màn hình mờ?
1. Mở Console (F12) → xem có log "✅ Screen OCR content script loaded" không?
2. Nếu KHÔNG có → Reload extension + Refresh page
3. Nếu CÓ nhưng vẫn không mờ → Kiểm tra Console xem có lỗi gì

### Lỗi khác:
- **"Cannot access chrome://"**: Test trên website thật (google.com), KHÔNG test trên chrome://
- **API error**: Check API key
- **CORS error**: Groq API cần HTTPS, không chạy trên localhost

## 💡 Debug

Mở Console (F12) để xem logs:
```
✅ Screen OCR content script loaded  ← Script đã load
🎯 Starting capture...                ← Bắt đầu
📸 Creating overlay...                 ← Tạo overlay
✅ Overlay created                     ← Thành công
🖱️ Mouse down: X, Y                   ← Kéo chuột
📏 Selection: {left, top, width...}   ← Vùng chọn
📸 Capturing tab...                    ← Chụp màn hình
✂️ Cropping...                        ← Crop
🤖 Calling AI...                       ← Gọi AI
✅ Got result                          ← Xong!
```

---

Made with ❤️ - Tested & Working
