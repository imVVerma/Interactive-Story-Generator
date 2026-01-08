# ImagiStory AI - Setup Guide

Transform your travel memories into epic narratives using the power of **Gemini Flash**.

## 1. Get your Gemini API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Click on **Get API key** in the sidebar.
3.  Create a new API key in a new project.
4.  Copy your key.

## 2. Environment Configuration

1.  Create a file named `.env` in the root directory.
2.  Paste your key into the file:
    ```env
    PORT=3001
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

## 3. Running the Project

You will need two terminal windows open:

### Terminal 1: Backend Proxy
This handles the AI processing securely.
```bash
node server.js
```

### Terminal 2: Frontend App
The actual user interface.
```bash
npm run dev
```

---

## Why this version?
- **Zero Cost**: Optimized for the Gemini free tier in AI Studio (No billing required).
- **Privacy First**: Images are processed in real-time and never stored permanently.
- **Side-by-Side PDF**: Professional journal layout for your downloaded stories.
- **Smart Sharing**: Built-in Web Share API and clipboard fallbacks.
