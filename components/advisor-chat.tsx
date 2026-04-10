"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

const DEFAULT_CHIPS = [
  "What should I open tonight?",
  "What's missing from my shelf?",
  "Which bottle have I neglected the longest?",
  "Surprise me with an insight."
];

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

export function AdvisorChat() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState("");
  const [enableSearch, setEnableSearch] = useState(false);
  const enableSearchRef = useRef(false);

  const [transport] = useState(() => {
    const t = new DefaultChatTransport({ api: "/api/advisor/chat" });
    Object.defineProperty(t, "api", {
      get: () =>
        enableSearchRef.current
          ? "/api/advisor/chat?search=1"
          : "/api/advisor/chat",
      configurable: true
    });
    return t;
  });

  function toggleSearch() {
    const next = !enableSearch;
    setEnableSearch(next);
    enableSearchRef.current = next;
  }

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract suggestions from last assistant message
  useEffect(() => {
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
        const { suggestions } = extractSuggestions((textPart as { text: string }).text);
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

  return (
    <div className="advisor-chat stack">
      <div className="advisor-chat__messages">
        {messages.map((m) => {
          const textPart = m.parts.find((p) => p.type === "text");
          const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
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
            <p className="advisor-chat__thinking">{enableSearch ? "searching & thinking…" : "thinking…"}</p>
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
        <button
          type="button"
          className={`chat-search-toggle${enableSearch ? " chat-search-toggle--on" : ""}`}
          onClick={toggleSearch}
          title={enableSearch ? "Web search enabled — click to disable" : "Enable web search"}
          aria-pressed={enableSearch}
          aria-label="Toggle web search"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
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
