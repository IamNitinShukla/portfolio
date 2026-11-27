"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowUp,
  AudioLines,
  BriefcaseBusiness,
  Code2,
  FolderGit2,
  Globe,
  Mail,
  Square,
  SquarePen,
  X,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { generateLocalFallback } from "@/lib/assistantKnowledge";
import {
  type Message,
  generateId,
  purgeLegacyStorage,
} from "@/lib/conversationStorage";
import { useVoiceAssistant } from "@/lib/useVoiceAssistant";
import VoiceAssistantOverlay from "./VoiceAssistantOverlay";
import styles from "./MascotInteraction.module.css";

const welcomeHeading = "Hey there! 👋";
const welcomeBody =
  "Hello! I'm Friday, Nitin Sir's personal AI assistant. I can help you explore his projects, technical skills, experience, and answer general questions.";

const topics = [
  {
    label: "Tech stack",
    icon: Code2,
    question: "What technologies and frameworks does Nitin Sir specialize in?",
  },
  {
    label: "Experience",
    icon: BriefcaseBusiness,
    question: "Can you summarize Nitin Sir's engineering experience and past roles?",
  },
  {
    label: "Projects",
    icon: FolderGit2,
    question: "Which featured projects has Nitin Sir built, and what are their architectures?",
  },
  {
    label: "Hire me",
    icon: Mail,
    question: "How can I work with Nitin Sir or hire him for 2025/2026 roles?",
  },
];

/**
 * Paints decoded video frames from the floating mascot into each assistant reply avatar canvas.
 * Avoids spawning duplicate video decoders while maintaining the authentic transparent animated mascot.
 * Robust across streaming responses, follow-up messages, and feed scrolling.
 */
function useReplyAvatars(
  source: RefObject<HTMLVideoElement> | undefined,
  feed: RefObject<HTMLDivElement>,
  count: number
) {
  useEffect(() => {
    let animId: number;
    let fallbackVideo: HTMLVideoElement | null = null;
    let isDisposed = false;

    // Dedicated fallback video element if source video is paused, not mounted, or unavailable
    const getFallbackVideo = () => {
      if (!fallbackVideo && typeof document !== "undefined") {
        fallbackVideo = document.createElement("video");
        fallbackVideo.src = "/mascot/animations/idle.webm";
        fallbackVideo.muted = true;
        fallbackVideo.loop = true;
        fallbackVideo.playsInline = true;
        fallbackVideo.autoplay = true;
        fallbackVideo.play().catch(() => {});
      }
      return fallbackVideo;
    };

    const paint = () => {
      if (isDisposed) return;

      const root = feed.current;
      if (root) {
        // Choose source video if available, ready and playing; otherwise use fallback video
        let activeVideo = source?.current;
        if (!activeVideo || activeVideo.readyState < 2 || activeVideo.paused) {
          const fallback = getFallbackVideo();
          if (fallback && fallback.readyState >= 2) {
            activeVideo = fallback;
          }
        }

        if (activeVideo && activeVideo.readyState >= 2) {
          const size = activeVideo.videoWidth || 300;
          // Directly query all assistant reply avatar canvases in the feed
          const canvases = root.querySelectorAll<HTMLCanvasElement>("canvas");
          canvases.forEach(canvas => {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Crop transparent outer margins to frame the character closely
            ctx.drawImage(
              activeVideo,
              size * 0.26,
              size * 0.29,
              size * 0.48,
              size * 0.48,
              0,
              0,
              canvas.width,
              canvas.height
            );
          });
        }
      }

      animId = requestAnimationFrame(paint);
    };

    animId = requestAnimationFrame(paint);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      if (fallbackVideo) {
        fallbackVideo.pause();
        fallbackVideo.removeAttribute("src");
        fallbackVideo.load();
        fallbackVideo = null;
      }
    };
  }, [source, feed, count]);
}

function renderFormattedText(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, lIdx) => {
    const isBullet = /^\s*[*•-]\s+/.test(line);
    const content = line.replace(/^\s*[*•-]\s+/, "");

    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    const renderedParts = parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pIdx} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <span key={lIdx} className="block pl-3 relative my-0.5">
          <span className="absolute left-0 text-[#E63946] select-none">•</span>
          {renderedParts}
        </span>
      );
    }

    return (
      <span key={lIdx}>
        {renderedParts}
        {lIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function checkIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth < 768 ||
    window.matchMedia("(pointer: coarse)").matches ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export default function MascotAssistantDialog({
  id,
  onDismiss,
  mascotVideo,
  startInVoiceMode = false,
}: {
  id: string;
  onDismiss: () => void;
  mascotVideo?: RefObject<HTMLVideoElement>;
  startInVoiceMode?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { theme } = useTheme();
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // In-Memory Temporary Conversation State (No storage persistence)
  const [messages, setMessages] = useState<Message[]>([
    { id: "msg_welcome", sender: "assistant", text: welcomeBody },
  ]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // On mount: purge any legacy persistence keys from localStorage
  useEffect(() => {
    purgeLegacyStorage();
  }, []);

  useReplyAvatars(mascotVideo, feedRef, messages.length);

  // Native HTML Dialog accessibility and scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";

    const isMobile = checkIsMobile();

    try {
      if (!dialog.open) {
        dialog.showModal();
      }
    } catch {
      dialog.setAttribute("open", "");
    }

    let mobileTimer: ReturnType<typeof setTimeout> | null = null;
    if (isMobile) {
      // Prevent mobile virtual keyboard from automatically popping up on dialog open
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        document.activeElement.blur();
      }
      dialog.focus({ preventScroll: true });

      // Guard against delayed browser autofocus on mobile touch devices
      mobileTimer = setTimeout(() => {
        if (
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement
        ) {
          document.activeElement.blur();
          dialog.focus({ preventScroll: true });
        }
      }, 50);
    }

    return () => {
      if (mobileTimer) {
        clearTimeout(mobileTimer);
      }
      // Abort active stream and voice on unmount
      abortControllerRef.current?.abort();
      try {
        if (dialog.open) {
          dialog.close();
        }
      } catch {
        dialog.removeAttribute("open");
      }
      root.style.overflow = overflow;
      if (opener instanceof HTMLElement) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  // Instant scroll during streaming, smooth scroll when complete
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && messages.length > 1) {
      feed.scrollTo({
        top: feed.scrollHeight,
        behavior: isStreaming
          ? "auto"
          : window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [messages, isStreaming]);

  function stopStreaming() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }

  const voiceAssistant = useVoiceAssistant({ onSendMessage: (query, signal) => send(query, undefined, signal) });

  const hasAutoStartedVoice = useRef(false);

  // Auto-launch Voice Mode if requested (e.g. via double-click on mascot)
  useEffect(() => {
    if (startInVoiceMode && !hasAutoStartedVoice.current) {
      hasAutoStartedVoice.current = true;
      voiceAssistant.startVoiceMode();
    }
  }, [startInVoiceMode, voiceAssistant]);

  // Global escape key listener ensuring Voice Mode and dialog always close cleanly
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        voiceAssistant.stopVoiceMode();
        stopStreaming();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [voiceAssistant, onDismiss]);

  // Clean up all audio/stream/recognition resources on unmount
  useEffect(() => {
    return () => {
      voiceAssistant.stopVoiceMode();
      stopStreaming();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to a clean fresh in-memory session
  function handleNewConversation() {
    stopStreaming();
    voiceAssistant.stopVoiceMode();
    setMessages([
      { id: generateId("msg"), sender: "assistant", text: welcomeBody },
    ]);
    setDraft("");
    if (!checkIsMobile()) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  async function send(text: string, directPrompt?: string, voiceSignal?: AbortSignal) {
    const query = (directPrompt ?? text).trim();
    if (!query) return "";
    voiceSignal?.throwIfAborted();

    if (isStreaming) {
      stopStreaming();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessage: Message = {
      id: generateId("msg"),
      sender: "user",
      text: query,
      timestamp: Date.now(),
    };

    const initialAssistantMessage: Message = {
      id: generateId("msg"),
      sender: "assistant",
      text: "",
      isStreaming: true,
      timestamp: Date.now(),
    };

    // Capture recent in-memory history for this active temporary session (last 8 messages)
    const historyPayload = messagesRef.current.slice(-8).map(m => ({
      sender: m.sender,
      text: m.text,
    }));

    const currentMessagesBeforeStream = [...messagesRef.current, userMessage];
    const cancelVoice = () => {
      abortController.abort();
      if (abortControllerRef.current !== abortController) return;
      abortControllerRef.current = null;
      setIsStreaming(false);
      setMessages(prev => prev.filter(message => message.id !== initialAssistantMessage.id));
    };
    voiceSignal?.addEventListener("abort", cancelVoice, { once: true });
    setMessages([...currentMessagesBeforeStream, initialAssistantMessage]);
    setDraft("");
    setIsStreaming(true);

    let finalAssistantText = "";
    let finalSources: Array<{ title: string; url: string }> | undefined = undefined;
    let isFallbackResponse = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(voiceSignal && { "X-Friday-Voice": "1" }) },
        body: JSON.stringify({ message: query, history: historyPayload }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completed = false;
      let streamedText = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.text) {
                streamedText += data.text;
                const currentAccumulation = streamedText;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].id === initialAssistantMessage.id) {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      text: currentAccumulation,
                      isStreaming: true,
                    };
                  }
                  return updated;
                });
              }
              if (Array.isArray(data.sources) && data.sources.length > 0) {
                finalSources = data.sources;
              }
              if (data.done) {
                completed = true;
                break;
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        }
      }

      if (voiceSignal && (!completed || !streamedText.trim())) throw new Error("Friday returned an incomplete reply. Please retry.");
      finalAssistantText = streamedText || generateLocalFallback(query);
    } catch (err: unknown) {
      const error = err as Error;
      if (voiceSignal) {
        finalAssistantText = abortController.signal.aborted ? "(Response cancelled)" : "Friday could not complete the voice reply.";
        throw error;
      }
      if (error.name === "AbortError") {
        finalAssistantText = "(Response cancelled)";
      } else {
        // Fallback to grounded local portfolio response
        finalAssistantText = generateLocalFallback(query);
        isFallbackResponse = true;
      }
    } finally {
      voiceSignal?.removeEventListener("abort", cancelVoice);
      if (abortControllerRef.current === abortController || (!voiceSignal && !abortControllerRef.current)) {
        setIsStreaming(false);
        abortControllerRef.current = null;

        const finalAssistantMessage: Message = {
          id: generateId("msg"),
          sender: "assistant",
          text: finalAssistantText,
          isStreaming: false,
          sources: finalSources,
          isFallback: isFallbackResponse,
          timestamp: Date.now(),
        };

        const completedMessages = [...currentMessagesBeforeStream, finalAssistantMessage];
        setMessages(completedMessages);

        if (!checkIsMobile()) {
          inputRef.current?.focus({ preventScroll: true });
        }
      }
    }
    return finalAssistantText;
  }

  return (
    <dialog
      ref={dialogRef}
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={`${styles.dialog} ${theme === "dark" ? styles.dark : styles.light}`}
      data-theme={theme}
      data-lenis-prevent
      onCancel={event => {
        event.preventDefault();
        voiceAssistant.stopVoiceMode();
        stopStreaming();
        onDismiss();
      }}
      onClick={event => {
        if (event.target === event.currentTarget) {
          voiceAssistant.stopVoiceMode();
          stopStreaming();
          onDismiss();
          return;
        }
        const rect = dialogRef.current?.getBoundingClientRect();
        if (rect) {
          const isInside =
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width;
          if (!isInside) {
            voiceAssistant.stopVoiceMode();
            stopStreaming();
            onDismiss();
          }
        }
      }}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          voiceAssistant.stopVoiceMode();
          stopStreaming();
          onDismiss();
          return;
        }
        event.stopPropagation();
      }}
    >
      <div className={styles.panel}>
        <h2 id={`${id}-title`} className="sr-only">
          Friday
        </h2>

        {/* Top Floating Controls: New Chat & Close */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.utilityBtn}
            onClick={handleNewConversation}
            aria-label="New chat"
            title="Start new conversation"
          >
            <SquarePen size={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close Friday"
            onClick={() => {
              voiceAssistant.stopVoiceMode();
              stopStreaming();
              onDismiss();
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Voice Mode Animated Overlay */}
        {voiceAssistant.isActive && (
          <VoiceAssistantOverlay
            voiceState={voiceAssistant.voiceState}
            finalTranscript={voiceAssistant.finalTranscript}
            isMuted={voiceAssistant.isMuted}
            errorMessage={voiceAssistant.errorMessage}
            onInterrupt={voiceAssistant.interrupt}
            onToggleMute={voiceAssistant.toggleMute}
            onExit={voiceAssistant.stopVoiceMode}
            onClose={() => {
              voiceAssistant.stopVoiceMode();
              stopStreaming();
              onDismiss();
            }}
            onRetry={voiceAssistant.retryListening}
            audioLevel={voiceAssistant.audioLevel}
          />
        )}

        {/* Conversation Thread */}
        <div
          ref={feedRef}
          className={styles.conversation}
          role="log"
          aria-label="Conversation"
          aria-relevant="additions"
          tabIndex={0}
        >
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={message.sender === "assistant" ? styles.assistant : styles.user}
            >
              {message.sender === "assistant" && (
                <canvas
                  className={styles.avatar}
                  width={136}
                  height={136}
                  aria-hidden="true"
                />
              )}
              <div className={styles.content}>
                {index === 0 && message.sender === "assistant" ? (
                  <div className={styles.bubble}>
                    <p className={styles.greetingHeading}>{welcomeHeading}</p>
                    <p className={styles.greetingBody}>{message.text}</p>
                  </div>
                ) : (
                  <div>
                    <div className={styles.bubble}>
                      <span className="sr-only">
                        {message.sender === "user" ? "You" : "Friday"}:{" "}
                      </span>
                      <span>{renderFormattedText(message.text)}</span>
                      {message.isStreaming && (
                        <span className={styles.cursor} aria-hidden="true" />
                      )}
                      {message.isFallback && (
                        <span className={styles.fallbackNote}>
                          Offline Safe Response
                        </span>
                      )}
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-0.5 text-[11px]">
                        <span className="flex items-center gap-1 font-medium text-[#7A7A85] dark:text-[#8E8B82]">
                          <Globe size={11} aria-hidden="true" /> Sources:
                        </span>
                        {message.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-[#EEF1F6] dark:bg-[#1E1F1E] px-2 py-0.5 text-[11px] text-[#4A4843] dark:text-[#A0A0AA] hover:text-[#E63946] dark:hover:text-[#E63946] transition-colors"
                          >
                            <span className="max-w-[140px] truncate">{s.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Quick-action buttons in initial welcome state */}
          {messages.length === 1 && (
            <div className={styles.topics}>
              {topics.map(({ label, icon: Icon, question }) => (
                <button
                  type="button"
                  key={label}
                  disabled={isStreaming}
                  onClick={() => send(question)}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fixed Bottom Chat Composer */}
        <form
          className={styles.composer}
          onSubmit={event => {
            event.preventDefault();
            if (isStreaming) {
              stopStreaming();
            } else {
              send(draft);
            }
          }}
        >
          <div>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={isStreaming ? "Generating response..." : "Ask anything about Nitin..."}
              aria-label="Ask anything about Nitin"
              autoComplete="off"
            />
            <button
              type="button"
              className={`${styles.voiceBtn} ${voiceAssistant.isActive ? styles.voiceBtnActive : ""}`}
              onClick={() => {
                if (voiceAssistant.isActive) {
                  voiceAssistant.stopVoiceMode();
                } else {
                  voiceAssistant.startVoiceMode();
                }
              }}
              aria-label={voiceAssistant.isActive ? "Exit Voice Mode" : "Start Voice Mode"}
              title={voiceAssistant.isActive ? "Exit Voice Mode" : "Voice Mode"}
            >
              <AudioLines size={16} strokeWidth={2.4} className="text-white" />
            </button>
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!isStreaming && !draft.trim()}
              aria-label={isStreaming ? "Stop generating" : "Send message"}
              title={isStreaming ? "Stop generation" : "Send"}
            >
              {isStreaming ? (
                <Square size={12} fill="currentColor" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.4} />
              )}
            </button>
          </div>
          <p className={styles.sourceNote}>
            AI can make mistakes. Please verify important information.
          </p>
        </form>
      </div>
    </dialog>
  );
}
