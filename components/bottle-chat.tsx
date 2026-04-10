"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

const DEFAULT_CHIPS = [
  "What food pairs well with this?",
  "How does this compare to my other bottles?",
  "Tell me about this distillery",
  "What's the ideal way to drink this?"
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

interface BottleChatProps {
  bottleId: string;
  bottleName: string;
}

export function BottleChat({ bottleId, bottleName }: BottleChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState("");
  const [enableSearch, setEnableSearch] = useState(false);
  const enableSearchRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [transport] = useState(() => {
    const t = new DefaultChatTransport({
      api: "/api/advisor/chat",
      body: { bottleId }
    });
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

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
    sendMessage({ parts: [{ type: "text", text: chip }] });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ parts: [{ type: "text", text: input }] });
      setInput("");
    }
  }

  const displayMessages = messages.filter((m) => {
    const textPart = m.parts.find((p) => p.type === "text");
    return textPart && "text" in textPart;
  });

  const shortName = bottleName.length > 28 ? bottleName.slice(0, 26) + "…" : bottleName;

  return (
    <>
      {/* FAB */}
      <button
        className="bottle-chat__fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close advisor chat" : "Ask your advisor about this bottle"}
        title={isOpen ? "Close" : "Ask your advisor"}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`bottle-chat__panel${isOpen ? " bottle-chat__panel--open" : ""}`}
        role="dialog"
        aria-label="Bottle advisor chat"
        aria-modal="false"
      >
        <div className="bottle-chat__header">
          <span className="bottle-chat__header-title">
            <span className="bottle-chat__header-eyebrow">Advisor</span>
            <span className="bottle-chat__header-name">{shortName}</span>
          </span>
          <div className="bottle-chat__header-actions">
            <button
              type="button"
              className={`chat-search-toggle${enableSearch ? " chat-search-toggle--on" : ""}`}
              onClick={toggleSearch}
              title={enableSearch ? "Web search enabled — click to disable" : "Enable web search"}
              aria-pressed={enableSearch}
              aria-label="Toggle web search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="bottle-chat__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="bottle-chat__messages">
          {displayMessages.length === 0 && (
            <div className="bottle-chat__empty">
              Ask me anything about this bottle — tasting notes, food pairings, how it fits your palate…
            </div>
          )}
          {displayMessages.map((m) => {
            const textPart = m.parts.find((p) => p.type === "text");
            const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
            const { text: cleanText } = extractSuggestions(text);
            return (
              <div
                key={m.id}
                className={`bottle-chat__message bottle-chat__message--${m.role}`}
              >
                {cleanText}
              </div>
            );
          })}
          {isLoading && (
            <div className="bottle-chat__message bottle-chat__message--assistant">
              <span className="bottle-chat__thinking">{enableSearch ? "searching & thinking…" : "thinking…"}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="bottle-chat__chips">
          {chips.map((chip) => (
            <button
              key={chip}
              className="bottle-chat__chip"
              onClick={() => handleChip(chip)}
              disabled={isLoading}
            >
              {chip}
            </button>
          ))}
        </div>

        <form className="bottle-chat__input-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="bottle-chat__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this bottle…"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            className="bottle-chat__send"
            disabled={isLoading || !input.trim()}
            aria-label="Send"
          >
            ▶
          </button>
        </form>
      </div>
    </>
  );
}
