const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with your actual key

const memoryPath = "memory.json";
const sessionPath = "chatSessions.json";
const logTxtPath = "logs.txt";
const pyFolder = "python/";
const backupPath = `${pyFolder}last_code_backup.py`;

if (!fs.existsSync(pyFolder)) fs.mkdirSync(pyFolder);
if (!fs.existsSync(sessionPath)) fs.writeFileSync(sessionPath, "{}");
if (!fs.existsSync(logTxtPath)) fs.writeFileSync(logTxtPath, "");

let allChats = {};
try {
  if (fs.existsSync(sessionPath)) {
    const content = fs.readFileSync(sessionPath, "utf-8").trim();
    if (content) {
      allChats = JSON.parse(content);
    }
  }
} catch (err) {
  console.error("⚠️ Failed to load sessions:", err);
  allChats = {};
}


function saveChatSessions() {
  fs.writeFileSync(sessionPath, JSON.stringify(allChats, null, 2));
}

function saveMessage(sessionId, role, content) {
  if (!allChats[sessionId]) {
    allChats[sessionId] = {
      title: "", // We'll set this below
      messages: [],
    };
  }

  const safeContent = typeof content === "string" ? content : JSON.stringify(content);

  // ✅ Set title if it's the first user message
  if (role === "user" && allChats[sessionId].title === "") {
    const clean = safeContent.trim().replace(/\s+/g, " ");
    allChats[sessionId].title = clean.slice(0, 35) + (clean.length > 35 ? "..." : "");
  }

  allChats[sessionId].messages.push({ role, content: safeContent });
  saveChatSessions();
}





function extractCode(text = "") {
  const match = text.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

function isPythonCode(code) {
  return /import|def |print|os\.|pathlib|open\(/.test(code);
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
  return "."; // fallback
}


function extractUrl(text) {
  // Match full URLs
  const fullUrlMatch = text.match(/https?:\/\/[^\s'"`]+/);
  if (fullUrlMatch) return fullUrlMatch[0];

  // Match domain names like "google.com"
  const domainMatch = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/);
  if (domainMatch) return "https://" + domainMatch[0];

  return "";
}


function fetchGeminiResponse(prompt, isCodeTask, sessionId) {
  const sessionMessages = allChats[sessionId]?.messages || [];

  const systemPrompt = isCodeTask
    ? `You are a Python coding assistant. When the user describes a task (like "list files in downloads"), generate a clean Python script.

🔒 RULES:
- DO NOT hardcode folder paths (like "Documents" or "Downloads").
- Use sys.argv[1] for folder paths.
- Use sys.argv[2] for URLs or external input.
- DO NOT print "URL to open:" if the value is empty.
- ALWAYS wrap code in a single \`\`\`python block.
- Handle errors cleanly, don't crash.
- Don't ask questions like "what would you like me to do?"
- Even if unclear, try to help with code.
`
    : `You are a helpful, friendly AI assistant.

Guidelines:
- Respond naturally, like you're chatting with a human.
- Do NOT say things like "there was a technical issue."
- Only give Python code if clearly asked.
- Never say "I'm not sure what to do with that."
`;

  const safeMessages = sessionMessages
    .filter((m) => typeof m.content === "string")
    .slice(-10) // last 10 messages for memory context
    .map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const payload = {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...safeMessages,
      { role: "user", parts: [{ text: prompt }] },
    ],
  };

  console.log("📤 Gemini Request Payload:", JSON.stringify(payload, null, 2));

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
    .then((res) => res.json())
    .then((data) => {
      console.log("🌐 Gemini API raw response:", JSON.stringify(data, null, 2));
      return data;
    });
}




// ✅ UPDATED: now includes automatic package checking and pip install
function runPythonCode(
  code,
  promptText,
  folder,
  onOutput,
  onError,
  onDone,
  onInstalling,
  secondArg = ""
) {
  secondArg = secondArg || extractUrl(promptText);

  if (fs.existsSync(`${pyFolder}run_code.py`)) {
    fs.copyFileSync(`${pyFolder}run_code.py`, backupPath);
  }

  fs.writeFileSync(`${pyFolder}run_code.py`, code);

  const timestamp = new Date().toISOString();
  fs.appendFileSync(logTxtPath, `\n=== ${timestamp} ===\nPrompt: ${promptText}\n\n${code}\n`);

  const imports = [...code.matchAll(/^import\s+(\w+)|^from\s+(\w+)/gm)]
    .map((match) => match[1] || match[2])
    .filter((mod, idx, arr) => mod && arr.indexOf(mod) === idx);

  const skipList = [
    "os", "sys", "time", "math", "json", "re", "random", "datetime",
    "pathlib", "webbrowser", "subprocess", "shutil", "string"
  ];

  const checkAndInstall = (i = 0) => {
    if (i >= imports.length) return runFinal();

    const mod = imports[i];
    if (skipList.includes(mod)) return checkAndInstall(i + 1);

    const test = spawn("python", ["-c", `import ${mod}`]);
    test.on("exit", (code) => {
      if (code === 0) {
        checkAndInstall(i + 1); // Already installed
      } else {
        onInstalling?.(mod);
        const install = spawn("pip", ["install", mod]);

        install.stdout.on("data", (d) => {
          onOutput?.(`📦 Installing ${mod}: ` + d.toString());
        });
        install.stderr.on("data", (e) => {
          onOutput?.(`⚠️ pip error: ${e.toString()}`);
        });

        install.on("close", () => checkAndInstall(i + 1));
      }
    });
  };

  const runFinal = () => {
    console.log("🚀 Executing:", "python", [`${pyFolder}run_code.py`, folder, secondArg]);
    onOutput?.("🚀 Running script...\n");
    const proc = spawn("python", [`${pyFolder}run_code.py`, folder, secondArg]);

    proc.stdout.on("data", (d) => onOutput?.(d.toString()));
    proc.stderr.on("data", (e) => onError?.(e.toString()));
    proc.on("close", (code) => onDone?.(code));
  };

  checkAndInstall();
}

async function runAI(prompt, sessionId = Date.now().toString()) {
  const isCodeTask = /(?:python|code|script|open|list files|folder|terminal|command)/i.test(prompt);

  const sessionMessages = allChats[sessionId]?.messages || [];

  // Only send valid Gemini messages
  const safeMessages = sessionMessages
    .filter(msg => typeof msg.content === "string")
    .map(msg => ({
      role: msg.role === "ai" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  // System prompt must also use "user" role in Gemini
  const systemPrompt = {
    role: "user",
    parts: [
      {
        text: isCodeTask
          ? `Dont be dumb, always read the rules. You are a Python coding assistant, DO NOT HARD CODE ANY FOLDER PATH, FORCE THEM FOR EXAMPLE IF USER ASK TO LIST FILE IN DOCUUMENT, DO YOUR BEST TO SHOW IT.

Rules:
- Dont be dumb, always read the rules.
- You MUST always try to generate Python code if a task can be solved with it.
- DO NOT say “I’m not sure” or “I cannot help.” Instead, assume what the user likely means.
- DO NOT hardcode folder paths like "Downloads".
- Use sys.argv[1] for folder paths.
- Use sys.argv[2] for URLs.
- ALWAYS wrap your code in a single \`\`\`python block.
- If you Cannot do what user asked, try to help with code.
- Be helpful, polite, and concise.`
          : `You are a helpful, friendly AI assistant.

Guidelines:
- Respond naturally, like you're chatting with a human.
- DO NOT say things like "there was a technical issue."
- If you Cannot do what user asked, try to help with code.
- You MUST always try to generate Python code if a task can be solved with it.
- DO NOT say "I'm not sure what to do with that."
- Only provide Python code if clearly asked.`,
      },
    ],
  };

  const payload = {
    contents: [
      systemPrompt,
      ...safeMessages,
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  };

  console.log("📤 Gemini Request Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();

  console.log("🌐 Gemini API raw response:", JSON.stringify(data, null, 2));

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "❌ No response.";

  // Save the messages to memory
  saveMessage(sessionId, "user", prompt);
  saveMessage(sessionId, "ai", reply);

  return reply;
}



module.exports = {
  fetchGeminiResponse,
  saveMessage,
  extractCode,
  isPythonCode,
  resolveFolder,
  runPythonCode,
  saveChatSessions,
  extractUrl,
  allChats,
  runAI,
};
