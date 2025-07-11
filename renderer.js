const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const { ipcRenderer } = require("electron");

const API_KEY = "AIzaSyAy9RQYz8BJPfChq0i87IpsyVMU3CW5V4Y"; // Replace this

const memoryPath = "memory.json";
const sessionPath = "chatSessions.json";
const logTxtPath = "logs.txt";
const pyFolder = "python/";
const backupPath = `${pyFolder}last_code_backup.py`;

let currentSessionId = Date.now().toString();
let allChats = {};

// ===== INIT =====
if (!fs.existsSync(pyFolder)) fs.mkdirSync(pyFolder);
if (!fs.existsSync(sessionPath)) fs.writeFileSync(sessionPath, "{}");
if (!fs.existsSync(logTxtPath)) fs.writeFileSync(logTxtPath, "");

loadChatSessions();
loadChatHistory();
loadMessages(currentSessionId);

document.getElementById("send").onclick = sendMessage;
document.getElementById("newChat").onclick = () => {
  currentSessionId = Date.now().toString();
  allChats[currentSessionId] = [];
  saveChatSessions();
  loadChatHistory();
  loadMessages(currentSessionId);
};

// ===== MAIN =====
function sendMessage() {
  const inputBox = document.getElementById("userInput");
  const userText = inputBox.value.trim();
  if (!userText) return;

  inputBox.value = "";
  addMessage("user", userText);
  saveMessage("user", userText);

  const isCodeTask = /(python|script|code|list files|scan|folder|directory|file size|make program|generate script|read file|loop|path|os\.|print|open browser)/i.test(userText);

  const sessionMemory = (allChats[currentSessionId] || [])
    .map(msg => `${msg.role}: ${msg.content}`)
    .join("\n");

  const geminiPrompt = isCodeTask
    ? `
You are a Python coding assistant. When the user describes a task (like "list files in documents"), generate a clean Python script.

🔒 RULES:
- DO NOT hardcode any folder like "documents".
- Use sys.argv[1] as the folder path or input.
- Use sys.argv[2] as the user-specific input (like a URL).
- Wrap your code in a single \`\`\`python block.
- Handle folder not found and other errors gracefully.

Context:\n${sessionMemory}\n\nUser request: ${userText}`
    : `You are a friendly AI assistant. Respond naturally, do not include Python code unless asked. If the user asks to "open Google" or perform a task, generate a clean Python script instead.\n\nContext:\n${sessionMemory}\n\nUser: ${userText}`;

  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
  })
    .then(res => res.json())
    .then(async data => {
      const aiRaw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No response.";
      addMessage("ai", aiRaw);
      saveMessage("ai", aiRaw);

      const code = extractCode(aiRaw);
      if (code && isPythonCode(code)) {
        const confirm = await ipcRenderer.invoke("confirm-run", code);
        if (confirm === 0) {
          runPythonCode(code, userText);
        } else {
          addMessage("ai", "❌ Code execution cancelled by user.");
        }
      }
    })
    .catch(err => {
      addMessage("ai", `❌ Error: ${err.message}`);
    });
}

// ===== HELPERS =====

function addMessage(role, text) {
  const box = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addProgressBar(initialText) {
  const box = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.className = "message ai";
  div.textContent = initialText;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function updateProgressBar(div, newText) {
  if (typeof div === "string") {
    const elements = document.querySelectorAll(".message.ai");
    const last = elements[elements.length - 1];
    if (last) last.textContent = newText;
  } else {
    div.textContent = newText;
  }
}

function saveMessage(role, content) {
  if (!allChats[currentSessionId]) allChats[currentSessionId] = [];
  allChats[currentSessionId].push({ role, content });
  saveChatSessions();
}

function loadChatSessions() {
  try {
    const raw = fs.readFileSync(sessionPath);
    allChats = JSON.parse(raw);
  } catch {
    allChats = {};
  }
}

function saveChatSessions() {
  fs.writeFileSync(sessionPath, JSON.stringify(allChats, null, 2));
}

function loadChatHistory() {
  const historyList = document.getElementById("chatHistory");
  historyList.innerHTML = "";

  for (const id in allChats) {
    const title = allChats[id][0]?.content.slice(0, 30) || "New Chat";

    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = title;
    span.onclick = () => {
      currentSessionId = id;
      loadMessages(id);
    };

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.className = "delete-btn";
    del.onclick = (e) => {
      e.stopPropagation(); // prevent triggering load
      if (confirm("Delete this chat history?")) {
        delete allChats[id];
        saveChatSessions();
        loadChatHistory();
        if (currentSessionId === id) {
          currentSessionId = Date.now().toString();
          allChats[currentSessionId] = [];
          saveChatSessions();
          loadMessages(currentSessionId);
        }
      }
    };

    li.appendChild(span);
    li.appendChild(del);
    historyList.appendChild(li);
  }
}

function loadMessages(sessionId) {
  const box = document.getElementById("chatBox");
  box.innerHTML = "";
  const messages = allChats[sessionId] || [];
  messages.forEach(m => addMessage(m.role, m.content));
}

function extractCode(text = "") {
  const match = text.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

function isPythonCode(code) {
  return /import|def |print|os\.|pathlib|open\(/.test(code);
}

function runPythonCode(code, promptText) {
  const folder = resolveFolder(promptText);
  if (fs.existsSync(`${pyFolder}run_code.py`)) {
    fs.copyFileSync(`${pyFolder}run_code.py`, backupPath);
  }

  fs.writeFileSync(`${pyFolder}run_code.py`, code);

  const timestamp = new Date().toISOString();
  const logEntry = `\n=== ${timestamp} ===\nPrompt: ${promptText}\n\n${code}\n`;
  fs.appendFileSync(logTxtPath, logEntry);

  const imports = [...code.matchAll(/^import\s+(\w+)|^from\s+(\w+)/gm)]
    .map(match => match[1] || match[2])
    .filter((mod, idx, arr) => mod && arr.indexOf(mod) === idx);

  const skipList = ["os", "sys", "time", "math", "json", "re", "random", "datetime", "pathlib"];

  const checkAndInstall = (i = 0) => {
    if (i >= imports.length) return runFinalScript();

    const module = imports[i];
    if (skipList.includes(module)) return checkAndInstall(i + 1);

    const test = spawn("python", ["-c", `import ${module}`]);

    test.on("exit", (code) => {
      if (code === 0) {
        checkAndInstall(i + 1);
      } else {
        const progress = addProgressBar(`📦 Installing missing package: ${module}`);
        const install = spawn("pip", ["install", module]);

        install.stdout.on("data", data => {
          updateProgressBar(progress, `📦 ${module}: ${data.toString()}`);
        });

        install.stderr.on("data", err => {
          addMessage("ai", `❗ ${err.toString()}`);
        });

        install.on("exit", () => {
          updateProgressBar(progress, `✅ ${module} installed.`);
          checkAndInstall(i + 1);
        });
      }
    });
  };

  const runFinalScript = () => {
    const proc = spawn("python", [`${pyFolder}run_code.py`, folder]);
    addMessage("ai", `🟢 Running Python script...\n📂 Folder: ${folder}`);

    proc.stdout.on("data", data => {
      addMessage("ai", `🟢 Output:\n${data.toString()}`);
    });

    proc.stderr.on("data", err => {
      addMessage("ai", `🔴 Error:\n${err.toString()}`);
    });

    proc.on("close", code => {
      addMessage("ai", `✅ Script finished. Exit code ${code}`);
    });
  };

  checkAndInstall();
}

function resolveFolder(text) {
  const home = os.homedir().replace(/\\/g, "/");
  const folders = {
    documents: `${home}/Documents`,
    downloads: `${home}/Downloads`,
    desktop: `${home}/Desktop`,
    pictures: `${home}/Pictures`,
    videos: `${home}/Videos`
  };
  for (const key in folders) {
    if (text.toLowerCase().includes(key)) return folders[key];
  }
  return ".";
}
