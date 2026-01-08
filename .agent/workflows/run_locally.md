---
description: How to run the AI Story Generator (v2) locally
---

To see your AI Story Generator in action, follow these steps:

## 1. Prerequisites
Make sure you have **Node.js** installed on your computer. You can check by running `node -v` in your terminal.

## 2. Navigate to the Project
Open your terminal (PowerShell or Command Prompt) and navigate to the project folder:
```powershell
cd "c:/Users/Vaibhav Verma/Documents/VV-Plak/WB/Img_Story"
```

## 3. Install Dependencies
Run this command to install the required libraries (React, Framer Motion, etc.):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
```

## 4. Launch the App
Start the development server:
```powershell
npm run dev
```

## 5. View in Browser
After running the command, look for a line in the terminal that says:
`➜ Local: http://localhost:5173/`

**Ctrl + Click** that link to open the app in your browser!

---

### 🛠️ Troubleshooting
- **Execution Policy Error**: If you see an error about "running scripts is disabled", always run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first in your terminal.
- **Port Busy**: If `5173` is taken, Vite will automatically pick another one (like `5174`). Use the URL shown in YOUR terminal.
