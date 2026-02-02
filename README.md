# Screen OCR Translator

[Insert Introduction Video Here]

## Overview

**Screen OCR Translator** is a powerful Chrome Extension that allows you to instantly capture any part of your screen, recognize the text within it (OCR), and translate it into your desired language. Powered by the advanced **Groq AI (Llama models)**, it provides lightning-fast and accurate results.

Designed with a modern, user-friendly interface, it fits perfectly into your browsing workflow, whether you are reading foreign comics, documentation, or study materials.

## ✨ Key Features

*   **⚡ Instant Screen Capture**: Select any area on your webpage to capture text immediately.
*   **🤖 AI-Powered OCR & Translation**: Uses state-of-the-art AI (Groq/Llama) for high-accuracy text recognition and context-aware translation.
*   **🔘 Floating Quick Button (FAB)**: A convenient floating button appears on pages for 1-click access (can be toggled on/off).
*   **🎨 Modern & Draggable UI**: The result window is sleek, supports **Dark/Light** themes, and can be dragged anywhere on the screen.
*   **🗣️ Multi-Language Support**: Pinpoint accuracy in translating to Vietnamese, English, Japanese, Korean, Chinese, French, and more.
*   **🔄 Instant Re-translation**: Change the target language directly in the result window to re-translate without re-capturing.
*   **🛠️ Customizable**: easily configure API keys, default languages, and themes via the popup menu.

## 🚀 Installation

Since this is a developer extension, you need to load it manually:

1.  Download or Clone this repository to your computer.
2.  Open your browser (Chrome, Edge, Brave, etc.) and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (usually a toggle in the top-right corner).
4.  Click **Load unpacked**.
5.  Select the folder containing this project (the folder where `manifest.json` is located).

## ⚙️ Configuration

1.  Click the **Extension Icon** in your browser toolbar.
2.  A popup settings menu will appear.
3.  **API Key**: Enter your **Groq API Key** (You can get a free key at [console.groq.com](https://console.groq.com)).
4.  **Target Language**: Select your preferred default translation language (e.g., Vietnamese).
5.  **Theme**: Choose between Light, Dark, or Auto mode.
6.  *Optional*: Toggle the "Floating Button" if you prefer a cleaner interface.

## 📖 How to Use

1.  **Start Capture**:
    *   Click the **Floating Button** (bottom-right corner of the page).
    *   **OR** click the Extension Icon and select "Start Capture" (if configured differently).
2.  **Select Area**:
    *   Your cursor will turn into a crosshair. Click and drag to draw a box around the text you want to translate.
3.  **View Results**:
    *   The extension will process the image and display the original text and translation in a floating window.
    *   You can drag this window around to uncover underlying content.
    *   Change the language in the dropdown to translate to another language instantly.
4.  **Close**:
    *   Click the **X** button, or press **ESC** to cancel/close.

## 🛠️ Technologies

*   **Manifest V3**: Modern Chrome Extension standard.
*   **Vanilla JavaScript**: Lightweight and fast performance without heavy frameworks.
*   **CSS3**: Custom layouts, animations, and responsive design.
*   **Groq API**: High-speed AI inference for OCR and translation task.

## 📝 License

This project is open-source. Feel free to modify and improve it!
