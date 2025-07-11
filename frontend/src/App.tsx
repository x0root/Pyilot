import "./index.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { electron } from "./bridge";

// Add Google Fonts import
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link  );

// Force disable scrolling on the entire page
const style = document.createElement('style');
style.innerHTML = `
  html, body {
    overflow: hidden;
  }
`;
document.head.appendChild(style);


type Message = { role: "user" | "ai"; content: string };

// ADJUSTED: New component to handle rendering markdown bold text
const FormattedContent = ({ content }: { content: string }) => {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return (
    <div className="whitespace-pre-wrap font-medium" style={{ overflowWrap: 'break-word', wordBreak: 'break-all' }}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </div>
  );
};


export default function App() {
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [chatSessions, setChatSessions] = useState<{ id: string; title: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState(() => "session-" + Date.now());
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= 250 && newWidth <= 500) {
          setSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'default';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isResizing]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    (async () => {
      const sessions = await electron.invoke("list-sessions");
      setChatSessions(sessions);
      setChatHistory(sessions.map((s: any) => s.id));
    })();
  }, []);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      const focused = document.activeElement === inputRef.current;
      if (focused && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const newId = "session-" + Date.now();
        setSessionId(newId);
        setMessages([]);
        setInput("");
      }
      if (focused && e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        if (
          historyRef.current.length > 0 &&
          historyIndex.current < historyRef.current.length - 1
        ) {
          historyIndex.current++;
          setInput(
            historyRef.current[
              historyRef.current.length - 1 - historyIndex.current
            ]
          );
        }
      }
      if (focused && e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex.current > 0) {
          historyIndex.current--;
          setInput(
            historyRef.current[
              historyRef.current.length - 1 - historyIndex.current
            ]
          );
        } else {
          historyIndex.current = -1;
          setInput("");
        }
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...newMessages, { role: "ai", content: "🧠 Thinking..." }]);
    historyRef.current.push(trimmed);
    historyIndex.current = -1;
    setInput("");

    try {
      const aiRaw = await electron.invoke("ai-response", {
        prompt: trimmed,
        sessionId,
      });

      const codeMatch = aiRaw.match(/```(?:python)?\s*([\s\S]*?)```/i);
      let finalCode = codeMatch ? codeMatch[1] : "";

      if (
        finalCode.includes("webbrowser") &&
        finalCode.includes("sys.argv[1]") &&
        !finalCode.includes("folder") &&
        !finalCode.includes("os.path")
      ) {
        console.log("⚠️ Fixing AI-generated code: replacing argv[1] with argv[2]");
        finalCode = finalCode.replace(/sys\.argv\[1\]/g, "sys.argv[2]");
      }

      if (finalCode) {
        const confirm = await electron.invoke("confirm-run", finalCode);
        if (confirm === 0) {
          const output = await electron.invoke("execute-code", {
            code: finalCode,
            prompt: trimmed,
          });

          setMessages((m) => {
            const updated = [...m];
            updated[updated.length - 1] = {
              role: "ai",
              content: `${aiRaw}\n\n🖥️ Output:\n\`\`\`\n${output || "✅ Task completed with no output."}\n\`\`\``,
            };
            return updated;
          });
        } else {
          setMessages((m) => [
            ...m.slice(0, -1),
            { role: "ai", content: "❌ Code execution cancelled." },
          ]);
        }
      } else {
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: "ai", content: aiRaw };
          return updated;
        });
      }

      await electron.invoke("save-message", {
        sessionId,
        role: "user",
        content: trimmed,
      });
      await electron.invoke("save-message", {
        sessionId,
        role: "ai",
        content: aiRaw,
      });

      if (!chatHistory.includes(sessionId)) {
        const title = trimmed.length > 40 ? trimmed.slice(0, 40) + "..." : trimmed;
        setChatHistory((prev) => [...prev, sessionId]);
        setChatSessions((prev) => [...prev, { id: sessionId, title }]);
      }
    } catch (err) {
      setMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = {
          role: "ai",
          content: "❌ Failed to get response.",
        };
        return updated;
      });
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 z-50 text-white px-6 py-4 rounded-lg transition-all duration-200 shadow-lg text-xl font-bold"
          style={{ backgroundColor: '#212121', color: '#C1C1C1' }}
        >
          &gt;
        </button>
      )}

      {sidebarOpen && (
        <aside 
          className="bg-gradient-to-b from-black/40 to-gray-900/40 backdrop-blur-sm border-r border-white/10 shadow-2xl text-white flex flex-col relative"
          style={{ width: sidebarWidth }}
        >
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20">
            <Button
              variant="secondary"
              className="text-white bg-[#212121] hover:bg-[#212121]/80 border-0 shadow-lg transition-all duration-200 font-medium"
              style={{ color: '#F1FCF8' }}
              onClick={() => {
                const newId = "session-" + Date.now();
                setSessionId(newId);
                setMessages([]);
              }}
            >
              <span className="mr-2">+</span>
              New Chat
            </Button>
            <Button
              variant="ghost"
              className="ml-2 px-6 py-4 text-xl font-bold rounded-lg transition-all duration-200"
              style={{ backgroundColor: '#212121', color: '#C1C1C1' }}
              onClick={() => setSidebarOpen(false)}
            >
              &lt;
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatSessions.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                <p className="font-medium">No conversations yet</p>
              </div>
            ) : (
              chatSessions.map(({ id, title }) => (
                <div
                  key={id}
                  className={`group bg-gradient-to-r from-gray-800/60 to-gray-700/60 backdrop-blur-sm hover:from-gray-700/80 hover:to-gray-600/80 p-4 rounded-lg border border-white/10 transition-all duration-200 cursor-pointer ${
                    sessionId === id ? 'ring-2 ring-blue-500/50 bg-gradient-to-r from-blue-900/40 to-purple-900/40' : ''
                  }`}
                  onClick={async () => {
                    const session = await electron.invoke("load-session", id);
                    setSessionId(id);
                    setMessages(session || []);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate pr-2 text-sm leading-relaxed font-medium">
                      {title}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 ml-2 bg-[#212121] hover:bg-[#212121]/80 transition-all duration-200 rounded-lg border border-red-500/20 hover:border-red-500/40 flex items-center justify-center"
                      style={{ padding: '4px' }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Delete this chat?")) {
                          await electron.invoke("delete-session", id);
                          setChatHistory((prev) => prev.filter((s) => s !== id));
                          setChatSessions((prev) => prev.filter((s) => s.id !== id));
                        }
                      }}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ stroke: '#C1C1C1' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resize Handle */}
          <div
            ref={resizeRef}
            className="absolute right-0 top-0 bottom-0 w-2 bg-white/10 hover:bg-white/20 cursor-col-resize transition-colors duration-200"
            onMouseDown={() => setIsResizing(true)}
            style={{ userSelect: 'none' }}
          />
        </aside>
      )}

      <main className="flex flex-col flex-1 h-screen relative">
        {/* Chat messages area */}
        <div
          ref={chatBoxRef}
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: '#212121' }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white/70 max-w-md">
                <div style={{ width: '128px', height: '128px' }} className="mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <svg style={{ width: '64px', height: '64px' }} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
                <p className="text-white/50 font-medium">Start a conversation with your AI assistant. I can help with coding, questions, and execute Python scripts.</p>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ marginBottom: '1.5rem' }} 
              >
                <div
                  style={{ borderRadius: '4px' }}
                  className={`max-w-[75%] text-sm p-4 backdrop-blur-sm shadow-lg transition-all duration-200 ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border border-blue-500/20"
                      : "bg-gradient-to-r from-gray-800/80 to-gray-700/80 text-white border border-white/10"
                  }`}
                >
                  {m.content.includes("```") ? (
                    <div className="space-y-3">
                      {m.content.split("```").map((part, i) => (
                        <div key={i}>
                          {i % 2 === 0 ? (
                            // ADJUSTED: Use the new FormattedContent component for non-code parts
                            <FormattedContent content={part} />
                          ) : (
                            <pre className="bg-black/40 border border-white/10 text-green-400 font-mono p-4 rounded-md overflow-x-auto backdrop-blur-sm">
                              <code>{part.replace(/^(?:python)?\s*/i, "").trim()}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // ADJUSTED: Use the new FormattedContent component for messages without code
                    <FormattedContent content={m.content} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 bg-gradient-to-r from-black/40 to-gray-900/40 backdrop-blur-sm p-4">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 w-full h-12 min-h-[48px] max-h-[120px] resize-none text-white placeholder:text-white/40 border border-white/20 rounded-2xl shadow-lg px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 font-medium leading-tight"
              style={{ backgroundColor: '#303030' }}
              rows={1}
            />
            <Button
              className="p-0 text-black border-0 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center z-10"
              style={{ backgroundColor: '#C1C1C1', width: '56px', height: '56px', borderRadius: '4px' }}
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <svg style={{ width: '28px', height: '28px' }} fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
