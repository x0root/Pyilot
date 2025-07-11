// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const pyilotCore = require("./pyilotCore.js"); // ✅ Import AI backend logic

// ✅ Destructure extractUrl explicitly if needed
const { extractUrl, resolveFolder, runPythonCode } = pyilotCore;


function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "Pyilot",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile("frontend/dist/index.html");
  win.webContents.openDevTools(); // Optional: disable for production
}

app.whenReady().then(createWindow);

// ========== IPC HANDLERS ==========

ipcMain.handle("confirm-run", async (_, code) => {
  return dialog.showMessageBoxSync({
    type: "question",
    buttons: ["Run", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "Pyilot — Run Script?",
    message: "Do you want to run this AI-generated script?",
    detail: code,
  });
});

ipcMain.handle("danger-check", async (_, dangers) => {
  return dialog.showMessageBoxSync({
    type: "warning",
    buttons: ["Allow", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "⚠️ Pyilot — Dangerous Code Detected",
    message: `This script contains potentially destructive actions:\n\n${dangers.join(", ")}\n\nAre you sure you want to continue?`,
  });
});

// ✅ AI Prompt → Response
ipcMain.handle("ai-response", async (_, { prompt, sessionId }) => {
  return await pyilotCore.runAI(prompt, sessionId);
});


// ✅ Safe Code Execution (only runs after confirm)
ipcMain.handle("execute-code", async (_, { code, prompt }) => {
  const folder = pyilotCore.resolveFolder(prompt);
  const secondArg = pyilotCore.extractUrl(prompt);

  return await new Promise((resolve) => {
    let output = "";
    pyilotCore.runPythonCode(
      code,
      prompt,
      folder,
      (msg) => output += msg, // append stdout
      (err) => output += err, // append stderr
      () => {
        const clean = output.trim();
        resolve(clean || "✅ Task completed.");
      },
      () => {}, // installing
      secondArg
    );
  });
});

ipcMain.handle("get-sessions", () => {
  // return { id: title }
  const sessions = {};
  for (const id in pyilotCore.allChats) {
    sessions[id] = pyilotCore.allChats[id].title || id;
  }
  return sessions;
});

ipcMain.handle("delete-session", async (_, sessionId) => {
  try {
    delete pyilotCore.allChats[sessionId];
    pyilotCore.saveChatSessions(); // Make sure this persists to disk
    // Return updated session list
    return Object.entries(pyilotCore.allChats).map(([id, data]) => ({
      id,
      title: data.title || "Untitled",
    }));
  } catch (err) {
    console.error("Failed to delete session:", err);
    return []; // fallback to empty
  }
});



ipcMain.handle("load-session", async (_, sessionId) => {
  const session = pyilotCore.allChats[sessionId];
  return session ? session.messages : [];
});

ipcMain.handle("list-sessions", async () => {
  const sessions = pyilotCore.allChats;
  return Object.entries(sessions).map(([id, data]) => ({
    id,
    title: data.title || "Untitled",
  }));
});


ipcMain.handle("save-message", (_, msg) => {
  pyilotCore.saveMessage(msg.sessionId, msg.role, msg.content);
});

ipcMain.handle("get-session-title", (_, id) => {
  return allChats[id]?.title || "Untitled";
});











