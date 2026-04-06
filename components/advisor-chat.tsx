"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

const STORAGE_KEY = "advisor-messages";
const MAX_MESSAGES = 20;
const SESSION_KEY = "advisor-opening-done";

const DEFAULT_CHIPS = [
  "What should I open tonight?",
  "What's missing from my shelf?",
  "Which bottle have I neglected the longest?",
  "Surprise me with an insight."
];

interface SerializedMessage {
  id: string;
  role: string;
  parts: Array<{ type: string; text: string }>;
}

function loadMessages(): SerializedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SerializedMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: SerializedMessage[]) {
  const capped = messages.slice(-MAX_MESSAGES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

function extractSuggestions(content: string): { text: string; suggestions: string[] } {
  const match = content.match(/\{"suggestions":\s*\[([^\]]*)\]\}/);
  if (!match) return { text: content, suggestions: [] };
  try {
    const parsed = JSON.parse(match[0]) as { suggestions: string[] };
    const text = content.replace(match[0], "").trim();
    return { text, suggestions: parsed.suggestions };
  } catch {
    return { text: content, suggestions: [] };
  }
}

function serializeMessage(msg: UIMessage): SerializedMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: msg.parts.map((p: any) => ({
      type: p.type,
      text: p.type === "text" ? p.text : ""
    }))
  };
}

function deserializeMessage(msg: SerializedMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: msg.parts.map((p) => ({ type: p.type, text: p.text } as any))
  } as UIMessage;
}

export function AdvisorChat() {
  const savedMessages = loadMessages();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [isSessionOpened, setIsSessionOpened] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/advisor/chat"
    })
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Fire opening message once per session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (messages.length > 0 || isSessionOpened) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    setIsSessionOpened(true);

    sendMessage({
      parts: [{ type: "text", text: "__opening__" }]
    });
  }, [isSessionOpened, messages.length, sendMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage and extract suggestions
  useEffect(() => {
    const serialized = messages.map(serializeMessage);
    saveMessages(serialized);

    // Extract suggestions from last assistant message
    let lastAssistantMessage: UIMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistantMessage = messages[i];
        break;
      }
    }

    if (lastAssistantMessage) {
      const textPart = lastAssistantMessage.parts.find((p) => p.type === "text");
      if (textPart && "text" in textPart) {
        const { suggestions } = extractSuggestions((textPart as any).text);
        if (suggestions.length) setChips(suggestions);
      }
    }
  }, [messages]);

  function handleChip(chip: string) {
    sendMessage({
      parts: [{ type: "text", text: chip }]
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({
        parts: [{ type: "text", text: input }]
      });
      setInput("");
    }
  }

  const displayMessages = messages.filter((m) => {
    const textPart = m.parts.find((p) => p.type === "text");
    return textPart && "text" in textPart && (textPart as any).text !== "__opening__";
  });

  return (
    <div className="advisor-chat stack">
      <div className="advisor-chat__messages">
        {displayMessages.map((m) => {
          const textPart = m.parts.find((p) => p.type === "text");
          const text = textPart && "text" in textPart ? (textPart as any).text : "";
          const { text: cleanText } = extractSuggestions(text);
          return (
            <div
              key={m.id}
              className={`advisor-chat__message advisor-chat__message--${m.role}`}
            >
              <p>{cleanText}</p>
            </div>
          );
        })}
        {isLoading && (
          <div className="advisor-chat__message advisor-chat__message--assistant">
            <p className="advisor-chat__thinking">thinking…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="advisor-chat__chips">
        {chips.map((chip) => (
          <button
            key={chip}
            className="advisor-chat__chip"
            onClick={() => handleChip(chip)}
            disabled={isLoading}
          >
            {chip}
          </button>
        ))}
      </div>

      <form
        className="advisor-chat__input-row"
        onSubmit={handleSubmit}
      >
        <input
          className="advisor-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your collection…"
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="advisor-chat__send"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
        >
          ▶
        </button>
      </form>
    </div>
  );
}
