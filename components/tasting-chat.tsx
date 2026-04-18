"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

import { ChatMessageContent } from "@/components/chat-message-content";

const DEFAULT_CHIPS = [
  "Suggest bottles for a casual evening",
  "What would work for whisky newcomers?",
  "Plan a peaty session",
  "What pairs well for a dinner tasting?"
];

export interface BottleSuggestion {
  id: string;
  name: string;
}

export function extractBottleSuggestions(content: string): {
  text: string;
  bottles: BottleSuggestion[];
} {
  const match = content.match(/\{"bottleSuggestions":\s*\[[\s\S]*?\]\}/);
  if (!match) return { text: content, bottles: [] };
  try {
    const parsed = JSON.parse(match[0]) as { bottleSuggestions: BottleSuggestion[] };
    const text = content.replace(match[0], "").trim();
    return { text, bottles: parsed.bottleSuggestions };
  } catch {
    return { text: content, bottles: [] };
  }
}

function extractChips(content: string): string[] {
  const match = content.match(/\{"suggestions":\s*\[([^\]]*)\]\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { suggestions: string[] };
    return parsed.suggestions;
  } catch {
    return [];
  }
}

function stripJsonBlocks(content: string): string {
  return content
    .replace(/\{"bottleSuggestions":\s*\[[\s\S]*?\]\}/, "")
    .replace(/\{"suggestions":\s*\[[^\]]*\]\}/, "")
    .trim();
}

interface TastingChatProps {
  onApply: (bottleIds: string[]) => void;
}

export function TastingChat({ onApply }: TastingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/tastings/advisor" })
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    let last: UIMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") { last = messages[i]; break; }
    }
    if (!last) return;
    const textPart = last.parts.find((p) => p.type === "text");
    if (!textPart || !("text" in textPart)) return;
    const text = (textPart as { text: string }).text;
    const newChips = extractChips(text);
    if (newChips.length) setChips(newChips);
  }, [messages]);

  function handleChip(chip: string) {
    sendMessage({ parts: [{ type: "text", text: chip }] });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ parts: [{ type: "text", text: input }] });
    setInput("");
  }

  const displayMessages = messages.filter((m) => {
    const t = m.parts.find((p) => p.type === "text");
    return t && "text" in t;
  });

  return (
    <>
      <button
        aria-label={isOpen ? "Close tasting advisor" : "Ask for tasting suggestions"}
        className="bottle-chat__fab tasting-chat__fab"
        onClick={() => setIsOpen((v) => !v)}
        title={isOpen ? "Close" : "Tasting suggestions"}
      >
        <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
          <path
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      <div
        aria-label="Tasting suggestion advisor"
        aria-modal="false"
        className={`bottle-chat__panel tasting-chat__panel${isOpen ? " bottle-chat__panel--open" : ""}`}
        role="dialog"
      >
        <div className="bottle-chat__header">
          <span className="bottle-chat__header-title">
            <span className="bottle-chat__header-eyebrow">Advisor</span>
            <span className="bottle-chat__header-name">Tasting Suggestions</span>
          </span>
          <button
            aria-label="Close chat"
            className="bottle-chat__close"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="bottle-chat__messages">
          {displayMessages.length === 0 && (
            <div className="bottle-chat__empty">
              Ask me what to pour tonight — I'll suggest bottles from your collection and explain the order.
            </div>
          )}

          {displayMessages.map((message) => {
            const textPart = message.parts.find((p) => p.type === "text");
            const raw = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
            const { text: cleanText, bottles } = extractBottleSuggestions(raw);
            const displayText = stripJsonBlocks(cleanText);

            return (
              <div
                className={`bottle-chat__message bottle-chat__message--${message.role}`}
                key={message.id}
              >
                <ChatMessageContent content={displayText} />
                {message.role === "assistant" && bottles.length > 0 && (
                  <button
                    className="button tasting-chat__apply"
                    onClick={() => {
                      onApply(bottles.map((b) => b.id));
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    Apply to session ({bottles.length} bottles)
                  </button>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="bottle-chat__message bottle-chat__message--assistant">
              <span className="bottle-chat__thinking">thinking...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="bottle-chat__chips">
          {chips.map((chip) => (
            <button
              className="bottle-chat__chip"
              disabled={isLoading}
              key={chip}
              onClick={() => handleChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <form className="bottle-chat__input-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            autoComplete="off"
            className="bottle-chat__input"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about what to pour..."
            value={input}
          />
          <button
            aria-label="Send"
            className="bottle-chat__send"
            disabled={isLoading || !input.trim()}
            type="submit"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}
