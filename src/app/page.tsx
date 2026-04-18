"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Report {
  date: string;
  filename?: string;
  object_name?: string;
  size: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://fitness-app-backend-production-920e.up.railway.app";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("user_1");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch reports when userId changes
  useEffect(() => {
    fetchReports();
  }, [userId]);

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    }
  };

  const viewReport = async (date: string) => {
    try {
      setSelectedReport(date);
      const response = await fetch(`${API_BASE_URL}/api/v1/report/${userId}?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setReportContent(data.response);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    }
  };

  const sendTextMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/input/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: input }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Sorry, something went wrong.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Refresh reports after each message (agent might have saved a report)
      fetchReports();
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ Failed to connect to the server. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((track) => track.stop());
        await sendAudioMessage(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: "🎤 [Voice message sent]",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("audio_file", audioBlob, "recording.wav");

      const response = await fetch(`${API_BASE_URL}/api/v1/input/audio`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.transcription
          ? `📝 *Transcribed:* "${data.transcription}"\n\n${data.response}`
          : data.response || "Sorry, something went wrong.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      fetchReports();
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ Failed to process audio. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <main className="min-h-screen flex">
      {/* Reports Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 border-r border-white/10 bg-dark-800/50 backdrop-blur-sm flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-white/10">
          <h2 className="font-display font-semibold text-lg gradient-text flex items-center gap-2">
            📊 Reports
          </h2>
          <p className="text-xs text-gray-400 mt-1">Your daily fitness logs</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <p>No reports yet</p>
              <p className="text-xs mt-1">Start logging to see reports here</p>
            </div>
          ) : (
            reports.map((report) => (
              <button
                key={report.date}
                onClick={() => viewReport(report.date)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                  selectedReport === report.date
                    ? "bg-primary-500/20 border border-primary-500/50"
                    : "bg-dark-700 hover:bg-dark-600 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-sm font-medium text-white">{report.date}</p>
                    <p className="text-xs text-gray-400">
                      {(report.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Report Preview */}
        {reportContent && (
          <div className="border-t border-white/10 max-h-64 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary-400">
                  Report: {selectedReport}
                </h3>
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setReportContent(null);
                  }}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-dark-900 rounded-lg p-2 max-h-40 overflow-y-auto">
                {reportContent}
              </pre>
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-sm bg-dark-800/50 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 rounded-lg bg-dark-700 hover:bg-dark-600 flex items-center justify-center transition-colors"
              >
                <span className="text-lg">{sidebarOpen ? "◀" : "▶"}</span>
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-teal flex items-center justify-center">
                <span className="text-xl">🏋️</span>
              </div>
              <div>
                <h1 className="font-display font-semibold text-lg gradient-text">
                  FitTrack AI
                </h1>
                <p className="text-xs text-gray-400">Your Proactive Fitness Coach</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">User:</span>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="bg-transparent text-sm text-white w-24 focus:outline-none"
                  placeholder="user_id"
                />
              </div>
              <button
                onClick={fetchReports}
                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded-lg transition-colors"
                title="Refresh reports"
              >
                🔄
              </button>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-teal/20 flex items-center justify-center">
                  <span className="text-4xl">💪</span>
                </div>
                <h2 className="text-2xl font-display font-semibold mb-2 gradient-text">
                  Welcome to FitTrack AI
                </h2>
                <p className="text-gray-400 max-w-md mx-auto mb-4">
                  Just tell me what you ate, how you trained, or how you're feeling.
                  I'll automatically log everything and give you helpful tips!
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    "🍳 I had eggs and toast",
                    "🏃 Went for a morning jog",
                    "😴 Slept 7 hours",
                    "💧 Feeling a bit tired",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-full text-sm text-gray-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-enter flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-primary-600 to-primary-500 text-white"
                      : "bg-dark-700 text-gray-100 border border-white/5"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-2 opacity-50">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start message-enter">
                <div className="bg-dark-700 rounded-2xl px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span className="text-sm text-gray-400">Logging & thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 backdrop-blur-sm bg-dark-800/80 sticky bottom-0">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              {/* Voice Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isRecording
                    ? "bg-accent-coral animate-pulse-soft glow-green"
                    : "bg-dark-700 hover:bg-dark-600"
                } disabled:opacity-50`}
              >
                <span className="text-xl">{isRecording ? "⏹️" : "🎤"}</span>
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tell me about your meals, training, sleep, mood..."
                  disabled={isLoading || isRecording}
                  className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all disabled:opacity-50"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={sendTextMessage}
                disabled={isLoading || !input.trim()}
                className="w-12 h-12 rounded-xl bg-gradient-to-r from-primary-500 to-accent-teal flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 glow-green"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
