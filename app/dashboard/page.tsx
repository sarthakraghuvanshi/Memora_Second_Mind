"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Brain, 
  Plus, 
  MessageSquare, 
  Upload, 
  Globe, 
  FileText,
  LogOut,
  Sparkles,
  Paperclip,
  X,
  ArrowUp,
  Pencil,
  Trash2,
  Check,
  Copy,
  CheckCheck,
  Mic,
  Volume2,
  ImageIcon,
  CodeIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/app/components/ui/sidebar";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Chat state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [chatting, setChatting] = useState(false);
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  
  // Edit state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  // Copy state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // Voice mode state
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false); // Use ref to track across async calls
  const voiceSessionIdRef = useRef<string | null>(null); // Track session ID across voice loop
  const audioElementRef = useRef<HTMLAudioElement | null>(null); // Reuse audio element
  const [voiceState, setVoiceState] = useState<'idle' | 'greeting' | 'listening' | 'transcribing' | 'processing' | 'speaking'>('idle');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);

  const createNewSession = async () => {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      const data = await response.json();
      
      if (response.ok && data.session) {
        setChatSessions((prev) => [data.session, ...prev]);
        setCurrentSessionId(data.session.id);
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  // Load sessions from database on mount (but don't open any)
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch("/api/sessions");
        const data = await response.json();
        
        if (response.ok && data.sessions && data.sessions.length > 0) {
          setChatSessions(data.sessions);
          // Don't set currentSessionId - always start fresh
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    };

    if (session) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Get current session
  const currentSession = chatSessions.find((s) => s.id === currentSessionId);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
          <p className="text-zinc-900">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  const handleNewChat = () => {
    setStreamingResponse("");
    setChatQuery("");
    setCurrentSessionId(null); // Clear current session to show empty state
  };

  const handleEditTitle = async (sessionId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        setChatSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
        );
        setEditingSessionId(null);
      }
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this chat?")) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const startVoiceMode = async () => {
    try {
      console.log("🎤 Starting voice mode...");
      
      // Create and unlock audio element with user gesture
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
        // Play silent audio to unlock
        audioElementRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        try {
          await audioElementRef.current.play();
          audioElementRef.current.pause();
          audioElementRef.current.currentTime = 0;
          console.log("✅ Audio element unlocked");
        } catch (e) {
          console.warn("Audio unlock failed:", e);
        }
      }
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setVoiceMode(true);
      voiceModeRef.current = true; // Set ref immediately
      voiceSessionIdRef.current = currentSessionId; // Store current session ID
      console.log("Voice mode set to true, session:", voiceSessionIdRef.current);
      
      // Play greeting if no messages
      if (!currentSession || currentSession.messages.length === 0) {
        console.log("Playing greeting...");
        await playGreeting();
        console.log("Greeting completed");
      }
      
      // Start recording
      console.log("Starting recording...");
      startRecording(stream);
    } catch (error) {
      console.error("Failed to start voice mode:", error);
      alert("Microphone access denied. Please enable microphone permissions.");
    }
  };

  const playGreeting = async () => {
    setVoiceState('greeting');
    const greetingText = "Hello! I'm Memora, your AI-powered second brain. How can I help you today?";
    
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: greetingText }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        return new Promise<void>((resolve) => {
          audio.onended = () => {
            console.log("Greeting finished");
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            console.error("Greeting audio error");
            resolve(); // Resolve anyway to continue
          };
          audio.play()
            .then(() => console.log("Greeting started"))
            .catch((error) => {
              console.error("Greeting play failed:", error);
              resolve(); // Resolve anyway
            });
        });
      }
    } catch (error) {
      console.error("Failed to play greeting:", error);
    }
  };

  const startRecording = (stream: MediaStream) => {
    setVoiceState('listening');
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      await transcribeAndSend(audioBlob);
    };

    recorder.start();
    setMediaRecorder(recorder);

    // Auto-stop after 2 seconds of silence (simplified - using fixed timeout)
    const timer = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }
    }, 10000); // Max 10 seconds per recording

    setSilenceTimer(timer);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    }
  };

  const transcribeAndSend = async (audioBlob: Blob) => {
    setVoiceState('transcribing');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok && data.text) {
        // Set the transcribed text and auto-send
        setChatQuery(data.text);
        
        // Wait a moment for state to update, then send
        setTimeout(async () => {
          setVoiceState('processing');
          await handleVoiceChat(data.text);
        }, 100);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      // Restart recording on error
      if (voiceModeRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startRecording(stream);
      }
    }
  };

  const handleVoiceChat = async (text: string) => {
    if (!text.trim()) return;

    // Use ref to get/create session (persists across async calls)
    let sessionId = voiceSessionIdRef.current || currentSessionId;
    
    if (!sessionId) {
      console.log("No session in voice mode, creating new one...");
      const newSessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      
      const newSessionData = await newSessionResponse.json();
      if (newSessionResponse.ok && newSessionData.session) {
        sessionId = newSessionData.session.id;
        voiceSessionIdRef.current = sessionId; // Store in ref for voice mode
        console.log("Created new session for voice:", sessionId);
        setChatSessions((prev) => [newSessionData.session, ...prev]);
        setCurrentSessionId(sessionId);
      }
    } else {
      console.log("Using existing voice session:", sessionId);
    }

    if (!sessionId) {
      console.error("Failed to get/create session");
      return;
    }

    // Add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, messages: [...session.messages, tempUserMessage] }
          : session
      )
    );

    // Save to DB
    fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: text }),
    }).catch(console.error);

    // Get AI response
    try {
      // Get updated conversation history (including the message we just added)
      const currentSessionData = chatSessions.find((s) => s.id === sessionId);
      const conversationHistory = currentSessionData?.messages || [];
      
      console.log("Voice chat - sending with history of", conversationHistory.length, "messages");
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text,
          history: conversationHistory.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                }
              } catch (e) {}
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `temp-${Date.now() + 1}`,
        role: "assistant",
        content: fullResponse,
        createdAt: new Date(),
      };

      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? { ...session, messages: [...session.messages, assistantMessage] }
            : session
        )
      );

      // Save to DB
      fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: fullResponse }),
      }).catch(console.error);

      // Speak the response
      console.log("About to speak, voiceModeRef:", voiceModeRef.current);
      try {
        await speakResponse(fullResponse);
        console.log("✅ Speech completed, restarting recording...");
        console.log("Current voiceModeRef:", voiceModeRef.current);
        
        // Small delay before restarting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Loop: Start recording again (use ref, not state)
        if (voiceModeRef.current) {
          console.log("Restarting recording loop...");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          startRecording(stream);
        } else {
          console.log("⚠️ VoiceMode is false, not restarting");
        }
      } catch (speakError) {
        console.error("❌ Speaking error:", speakError);
        // Still try to restart recording
        if (voiceModeRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          startRecording(stream);
        }
      }
    } catch (error) {
      console.error("Voice chat error:", error);
      // Try to recover by restarting recording
      if (voiceModeRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          startRecording(stream);
        } catch (recoverError) {
          console.error("Failed to recover:", recoverError);
          exitVoiceMode();
        }
      }
    }
  };

  const speakResponse = async (text: string) => {
    console.log("🔊 Starting to speak response, text length:", text.length);
    setVoiceState('speaking');
    
    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      console.log("TTS API response:", response.status);

      if (response.ok) {
        const audioBlob = await response.blob();
        console.log("Audio blob size:", audioBlob.size);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Reuse the unlocked audio element
        const audio = audioElementRef.current || new Audio();
        audio.src = audioUrl;
        
        console.log("Starting audio playback...");
        
        // Wait for audio to finish playing
        return new Promise<void>((resolve, reject) => {
          audio.onloadeddata = () => {
            console.log("Audio loaded, duration:", audio.duration);
          };
          
          audio.onended = () => {
            console.log("✅ Audio finished playing!");
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          
          audio.onerror = (error) => {
            console.error("❌ Audio playback error:", error);
            resolve(); // Resolve anyway to continue loop
          };
          
          audio.play()
            .then(() => console.log("Audio play() started"))
            .catch((error) => {
              console.error("Audio play() failed:", error);
              resolve(); // Resolve anyway to continue loop
            });
        });
      } else {
        throw new Error(`TTS API failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to speak response:', error);
      throw error;
    }
  };

  const exitVoiceMode = () => {
    console.log("🛑 Exiting voice mode");
    setVoiceMode(false);
    voiceModeRef.current = false;
    voiceSessionIdRef.current = null; // Clear session ref
    setVoiceState('idle');
    stopRecording();
    setChatQuery("");
  };

  const handleCopyMessage = async (content: string, messageId: string, element?: HTMLElement) => {
    try {
      if (element) {
        // Copy rendered HTML from the message element
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
        selection?.removeAllRanges();
        
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } else {
        // Fallback: plain text copy
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
      // Final fallback
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (fallbackError) {
        console.error("All copy methods failed:", fallbackError);
      }
    }
  };

  const handleChat = async () => {
    if (!chatQuery.trim()) return;

    const userMessageText = chatQuery.trim();
    setChatQuery(""); // Clear input immediately

    // If no current session, create one first
    let sessionId = currentSessionId;
    if (!sessionId) {
      console.log("No session - creating new one");
      const newSessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      
      const newSessionData = await newSessionResponse.json();
      if (newSessionResponse.ok && newSessionData.session) {
        sessionId = newSessionData.session.id;
        setChatSessions((prev) => [newSessionData.session, ...prev]);
        setCurrentSessionId(sessionId);
      } else {
        setMessage("❌ Failed to create chat session");
        return;
      }
    }

    // Add user message to current session (optimistic update)
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessageText,
      createdAt: new Date(),
    };

    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, messages: [...session.messages, tempUserMessage] }
          : session
      )
    );

    // Save user message to database
    console.log("Saving user message to session:", sessionId);
    fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "user",
        content: userMessageText,
      }),
    })
      .then((res) => {
        console.log("User message save response:", res.status);
        return res.json();
      })
      .then((data) => console.log("User message saved:", data))
      .catch((error) => {
        console.error("Failed to save user message:", error);
      });

    setChatting(true);
    setStreamingResponse("");
    setMessage("");

    try {
      // Get conversation history from current session
      const currentSessionData = chatSessions.find((s) => s.id === sessionId);
      const conversationHistory = currentSessionData?.messages || [];
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: userMessageText,
          history: conversationHistory.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setStreamingResponse(fullResponse);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Add assistant message to session
      const assistantMessage: ChatMessage = {
        id: `temp-${Date.now() + 1}`,
        role: "assistant",
        content: fullResponse,
        createdAt: new Date(),
      };

      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? { ...session, messages: [...session.messages, assistantMessage] }
            : session
        )
      );

      setStreamingResponse("");

      // Save assistant message to database
      console.log("Saving assistant message to session:", sessionId);
      fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: fullResponse,
        }),
      })
        .then((res) => {
          console.log("Assistant message save response:", res.status);
          return res.json();
        })
        .then((data) => console.log("Assistant message saved:", data))
        .catch((error) => {
          console.error("Failed to save assistant message:", error);
        });

      // Generate title if this is the first exchange (2 messages: user + assistant)
      const sessionData = chatSessions.find((s) => s.id === sessionId);
      if (sessionData && sessionData.messages.length === 2 && sessionData.title === "New Chat") {
        // This is the first exchange, generate a title
        fetch("/api/sessions/generate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstMessage: userMessageText }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.title) {
              // Update session title
              return fetch(`/api/sessions/${sessionId}/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: data.title }),
              });
            }
          })
          .then(() => {
            // Reload sessions to get updated title
            fetch("/api/sessions")
              .then((res) => res.json())
              .then((data) => {
                if (data.sessions) {
                  setChatSessions(data.sessions);
                }
              });
          })
          .catch((error) => {
            console.error("Failed to generate title:", error);
          });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessage("❌ Failed to get response");
    } finally {
      setChatting(false);
    }
  };

  const handleTextUpload = async () => {
    if (!textContent.trim()) return;

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: textContent,
          title: textTitle || "Untitled Note",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("✅ Text saved successfully!");
        setTextContent("");
        setTextTitle("");
        // Auto-close modal after success
        setTimeout(() => {
          setShowUploadModal(false);
          setMessage("");
        }, 1500);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage("❌ Failed to save text");
    } finally {
      setUploading(false);
    }
  };

  const handleWebUpload = async () => {
    if (!webUrl.trim()) return;

    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("/api/ingest/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Saved: ${data.metadata.title}`);
        setWebUrl("");
        // Auto-close modal after success
        setTimeout(() => {
          setShowUploadModal(false);
          setMessage("");
        }, 1500);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage("❌ Failed to save web content");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ingest/document", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Uploaded: ${data.metadata.title}`);
        // Auto-close modal after success
        setTimeout(() => {
          setShowUploadModal(false);
          setMessage("");
        }, 1500);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage("❌ Failed to upload document");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-stone-100">
        {/* Collapsible Sidebar */}
        <Sidebar className="border-r border-stone-200 bg-stone-50">
          <SidebarHeader className="p-4 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-6 h-6 text-blue-600" />
              <span className="text-lg font-bold text-zinc-900">Memora</span>
            </div>
            <Button
              onClick={handleNewChat}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </SidebarHeader>

          <SidebarContent className="bg-stone-50">
            <SidebarGroup>
              <SidebarGroupLabel className="text-zinc-500 text-xs uppercase">Chat History</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {chatSessions.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8 px-2">
                      No chats yet
                    </div>
                  ) : (
                    chatSessions.map((chatSession) => (
                      <SidebarMenuItem key={chatSession.id}>
                        <div className="group relative">
                          {editingSessionId === chatSession.id ? (
                            <div className="flex items-center gap-2 p-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    handleEditTitle(chatSession.id, editTitle);
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-sm bg-white border border-zinc-300 rounded"
                                autoFocus
                              />
                              <button
                                onClick={() => handleEditTitle(chatSession.id, editTitle)}
                                className="p-1 hover:bg-zinc-200 rounded"
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => setEditingSessionId(null)}
                                className="p-1 hover:bg-zinc-200 rounded"
                              >
                                <X className="w-4 h-4 text-zinc-600" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <SidebarMenuButton
                                onClick={() => setCurrentSessionId(chatSession.id)}
                                isActive={currentSessionId === chatSession.id}
                                className={`w-full justify-start ${
                                  currentSessionId === chatSession.id
                                    ? "bg-amber-100 text-zinc-900 border border-amber-200"
                                    : "text-zinc-700 hover:text-zinc-900 hover:bg-stone-100"
                                }`}
                              >
                                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm font-medium truncate flex-1">{chatSession.title}</span>
                              </SidebarMenuButton>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded p-1 border border-zinc-200">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSessionId(chatSession.id);
                                    setEditTitle(chatSession.title || "New Chat");
                                  }}
                                  className="p-1 hover:bg-zinc-100 rounded"
                                  title="Rename"
                                >
                                  <Pencil className="w-3 h-3 text-zinc-600" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(chatSession.id);
                                  }}
                                  className="p-1 hover:bg-red-100 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 bg-stone-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user?.name || "User"}
                    className="w-9 h-9 rounded-full border-2 border-blue-200"
                  />
                ) : (
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                    {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {session.user?.name || "User"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {session.user?.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-zinc-600 hover:text-red-600 hover:bg-zinc-100"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-stone-100 relative">
          {/* Floating Upload Button */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              onClick={() => setShowUploadModal(true)}
              className="border border-zinc-300 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 shadow-sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>

          {/* Floating Sidebar Toggle (Mobile) */}
          <div className="absolute top-4 left-4 z-10 md:hidden">
            <SidebarTrigger className="text-zinc-600 hover:text-zinc-900 hover:bg-white shadow-sm" />
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-20">
            {(!currentSession || (currentSession.messages.length === 0 && !chatting && !streamingResponse)) ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Brain className="w-16 h-16 text-blue-600 mb-4 opacity-50" />
                <h2 className="text-2xl font-bold mb-2 text-zinc-900">Start a conversation</h2>
                <p className="text-zinc-600 max-w-md">
                  Ask questions about your documents or search your knowledge base
                </p>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Display all messages in current session */}
                {currentSession?.messages.map((message) => (
                  <div key={message.id} className="flex gap-4 group">
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className={`flex-1 rounded-2xl p-4 relative ${
                      message.role === "user"
                        ? "bg-blue-50 border border-blue-100 ml-auto max-w-[80%]"
                        : "bg-amber-50/50 border border-stone-200 shadow-sm"
                    }`}>
                      {message.role === "assistant" ? (
                        <>
                          <div 
                            id={`message-${message.id}`}
                            className="prose prose-sm prose-zinc max-w-none
                            prose-headings:text-zinc-900 prose-headings:font-semibold
                            prose-p:text-zinc-800 prose-p:leading-relaxed
                            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                            prose-strong:text-zinc-900 prose-strong:font-semibold
                            prose-code:text-zinc-900 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                            prose-pre:bg-zinc-900 prose-pre:text-zinc-100
                            prose-ul:text-zinc-800 prose-ol:text-zinc-800
                            prose-li:text-zinc-800">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          <button
                            onClick={() => {
                              const element = document.getElementById(`message-${message.id}`);
                              handleCopyMessage(message.content, message.id, element || undefined);
                            }}
                            className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm hover:bg-white border border-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy response"
                          >
                            {copiedMessageId === message.id ? (
                              <CheckCheck className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-zinc-600" />
                            )}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      )}
                    </div>
                    {message.role === "user" && <div className="w-8" />}
                  </div>
                ))}

                {/* Streaming response */}
                {streamingResponse && (
                  <div className="flex gap-4 group">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div className="flex-1 bg-amber-50/50 rounded-2xl p-4 border border-stone-200 shadow-sm relative">
                      <div 
                        id="message-streaming"
                        className="prose prose-sm prose-zinc max-w-none
                        prose-headings:text-zinc-900 prose-headings:font-semibold
                        prose-p:text-zinc-800 prose-p:leading-relaxed
                        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-zinc-900 prose-strong:font-semibold
                        prose-code:text-zinc-900 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-zinc-900 prose-pre:text-zinc-100
                        prose-ul:text-zinc-800 prose-ol:text-zinc-800
                        prose-li:text-zinc-800">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingResponse}
                        </ReactMarkdown>
                      </div>
                      <button
                        onClick={() => {
                          const element = document.getElementById("message-streaming");
                          handleCopyMessage(streamingResponse, "streaming", element || undefined);
                        }}
                        className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm hover:bg-white border border-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy response"
                      >
                        {copiedMessageId === "streaming" ? (
                          <CheckCheck className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-zinc-600" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Thinking indicator */}
                {chatting && !streamingResponse && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div className="flex-1 bg-amber-50/50 rounded-2xl p-4 border border-stone-200 shadow-sm">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-6 bg-stone-100">
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask anything about your documents..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                  disabled={chatting}
                  className="w-full px-6 py-4 pr-28 bg-white border border-zinc-300 rounded-3xl text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                />
                <button
                  onClick={startVoiceMode}
                  disabled={chatting}
                  className="absolute right-14 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-700 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  title="Voice mode"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={handleChat}
                  disabled={!chatQuery.trim() || chatting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-700 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all hover:scale-110"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Mode Overlay */}
      {voiceMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-600/95 to-orange-500/95 backdrop-blur-md">
          <button
            onClick={exitVoiceMode}
            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition text-white"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center text-white">
            {/* Voice State Indicator */}
            <div className="mb-8">
              {voiceState === 'greeting' && (
                <div className="flex flex-col items-center">
                  <Volume2 className="w-24 h-24 mb-4 animate-pulse" />
                  <p className="text-2xl font-semibold">Playing greeting...</p>
                </div>
              )}
              
              {voiceState === 'listening' && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Mic className="w-24 h-24 mb-4 animate-pulse" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      <div className="w-1 h-8 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-12 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <div className="w-1 h-16 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      <div className="w-1 h-12 bg-white rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                      <div className="w-1 h-8 bg-white rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold mt-8">Listening...</p>
                  <p className="text-sm opacity-80 mt-2">Speak naturally</p>
                </div>
              )}
              
              {voiceState === 'transcribing' && (
                <div className="flex flex-col items-center">
                  <Brain className="w-24 h-24 mb-4 animate-spin" style={{ animationDuration: '3s' }} />
                  <p className="text-2xl font-semibold">Transcribing...</p>
                </div>
              )}
              
              {voiceState === 'processing' && (
                <div className="flex flex-col items-center">
                  <Brain className="w-24 h-24 mb-4 animate-pulse" />
                  <p className="text-2xl font-semibold">Memora is thinking...</p>
                  {chatQuery && (
                    <p className="text-sm opacity-80 mt-4 max-w-md">"{chatQuery}"</p>
                  )}
                </div>
              )}
              
              {voiceState === 'speaking' && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Volume2 className="w-24 h-24 mb-4" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      <div className="w-1 h-12 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-16 bg-white rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                      <div className="w-1 h-20 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                      <div className="w-1 h-16 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      <div className="w-1 h-12 bg-white rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold mt-8">Memora is speaking...</p>
                </div>
              )}
            </div>

            {/* Transcript Display */}
            {chatQuery && voiceState !== 'listening' && (
              <div className="mt-8 max-w-2xl mx-auto p-6 bg-white/10 backdrop-blur-sm rounded-2xl">
                <p className="text-sm opacity-80 mb-2">You said:</p>
                <p className="text-lg">{chatQuery}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden relative shadow-2xl flex flex-col">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setMessage("");
              }}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition text-zinc-700 z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 pb-6">
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
                Upload Content
              </h2>
              <p className="text-sm text-zinc-600">
                Choose how you want to add content to your knowledge base
              </p>
            </div>

            {/* Status Banner (Fixed at top, visible) */}
            {message && (
              <div className={`px-8 py-4 ${
                message.startsWith('✅') 
                  ? 'bg-green-50 border-y border-green-200' 
                  : 'bg-red-50 border-y border-red-200'
              }`}>
                <p className={`text-sm font-medium ${
                  message.startsWith('✅') ? 'text-green-800' : 'text-red-800'
                }`}>
                  {message}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6">
              {/* Text Note */}
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">Text Note</h3>
                      <p className="text-xs text-zinc-600">Quick notes and ideas</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <textarea
                    placeholder="Enter your text..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <Button
                    onClick={handleTextUpload}
                    disabled={!textContent.trim() || uploading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {uploading ? "Saving..." : "Save Text"}
                  </Button>
                </div>
              </div>

              {/* Web URL */}
              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 hover:border-orange-300 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Globe className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">Web Content</h3>
                      <p className="text-xs text-zinc-600">Articles, blogs, web pages</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="url"
                    placeholder="https://example.com/article"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleWebUpload()}
                    className="w-full px-4 py-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                  <Button
                    onClick={handleWebUpload}
                    disabled={!webUrl.trim() || uploading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {uploading ? "Saving..." : "Save URL"}
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div className="p-6 bg-cyan-50 rounded-2xl border border-cyan-100 hover:border-cyan-300 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">Upload Files</h3>
                      <p className="text-xs text-zinc-600">50+ formats supported</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 mb-3">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>PDF, Word, Excel</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>Images, Screenshots</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mic className="w-3 h-3" />
                      <span>Audio, Voice Memos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CodeIcon className="w-3 h-3" />
                      <span>Code, JSON, YAML</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-zinc-700
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-600 file:text-white
                      hover:file:bg-blue-700
                      file:cursor-pointer cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Message */}
              {message && (
                <div className="p-4 bg-zinc-100 rounded-lg border border-zinc-200">
                  <p className="text-sm text-zinc-700">{message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
