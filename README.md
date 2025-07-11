# Pyilot

**Pyilot** is an AI-powered desktop assistant that turns your natural language commands into executable Python code — right on your computer. It uses **Google Gemini AI** to generate scripts, and lets you interact with your system intelligently.

![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Open-Source](https://img.shields.io/badge/Open-source-green.svg)
![Tested on Windows 11](https://img.shields.io/badge/Tested%20on-Windows%2011-blue?logo=windows)
![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-2b2e3a.svg?logo=electron)
![Made with TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-3178c6.svg?logo=typescript)
![Made with React](https://img.shields.io/badge/Frontend-React-61dafb.svg?logo=react)
![Python Backend](https://img.shields.io/badge/Backend-Python-3776ab.svg?logo=python)
![Gemini API](https://img.shields.io/badge/AI-Gemini%20API-blueviolet.svg?logo=google)


---

## 🚀 Features

- 💡 Ask anything — the AI will generate Python code to help
- 🔒 Safe Mode — detects dangerous commands and asks for your permission
- 📂 Folder Resolver — AI understands folder names like "Documents", "Downloads"
- 🧠 Persistent memory — remembers your past prompts across sessions
- 🖥️ Simple UI
- ⚡ Run code directly from inside the app
- ⌨️ Keyboard Shortcuts

---

## Built With

- [Electron](https://www.electronjs.org/) 
- [TypeScript](https://www.typescriptlang.org/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [ShadCN UI](https://ui.shadcn.dev/)
- [Python 3](https://www.python.org/) 
- [Google Gemini API](https://aistudio.google.com/) 


---
## Requirements
- Node.js v18 or later
- Python 3 installed and available in PATH
- Internet connection (for Gemini API)

## Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/x0root/Pyilot
   cd Pyilot
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add your Gemini API key inside pyilotCore.js:
   ```Typescript
   const API_KEY = "YOUR_GEMINI_API_KEY";
    ```
4. Install dependencies:
   ```bash
   npm install
   npm install --save-dev electron
   ```
5. Start the app:
   ```bash
   npm start
   ```
---
⌨️ Keyboard Shortcuts:

| Shortcut     | Action                    |
|--------------|---------------------------|
| Ctrl + N     | Start a new chat session  |
| Ctrl + K     | Focus input field         |
| Ctrl + H     | Toggle sidebar            |
| Shift + Enter| Newline in input box      |
| Enter        | Send message              |

---

How It Works:
---

Type:
"List all files in the Documents folder and their sizes"



Pyilot:
- Sends the prompt to Gemini
- Displays the generated Python code
- Executes the code when you confirm
- Saves the script to logs/ and remembers the command in memory.json

# License
This project is licensed under the GPL v3 License.

This application uses Google Gemini AI via API. You must comply with Google's terms of use when using this app.

# Note
This project is still in development.
If you like this project, consider giving it a ⭐!
