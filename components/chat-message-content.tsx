import type { ReactNode } from "react";

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

function normalizeChatText(content: string): string {
  let normalized = content.replace(/\r\n?/g, "\n").trim();

  if (!normalized) {
    return normalized;
  }

  normalized = normalized
    .replace(/([:!?])\s+-\s+\*\*/g, "$1\n\n- **")
    .replace(/\*\*\s+-\s+Age:/g, "**\n- Age:")
    .replace(/\*\*\s+-\s+Cask:/g, "**\n- Cask:")
    .replace(/\*\*\s+-\s+ABV:/g, "**\n- ABV:")
    .replace(/\*\*\s+-\s+Notes:/g, "**\n- Notes:")
    .replace(/\*\*\s+-\s+Why it fits:/g, "**\n- Why it fits:")
    .replace(/\*\*\s+-\s+Score:/g, "**\n- Score:")
    .replace(/\*\*\s+-\s+\*\*/g, "**\n\n- **")
    .replace(
      /(^|\n)-\s+\*\*(.+?)\*\*(?=\n- (Age|Cask|ABV|Notes|Why it fits|Score):)/gm,
      "$1### $2"
    );

  return normalized;
}

function parseBlocks(content: string): Block[] {
  const lines = normalizeChatText(content).split("\n");
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ").trim()
    });
    paragraphLines = [];
  }

  function flushLists() {
    if (unorderedItems.length > 0) {
      blocks.push({
        type: "unordered-list",
        items: unorderedItems
      });
      unorderedItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push({
        type: "ordered-list",
        items: orderedItems
      });
      orderedItems = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        text: headingMatch[1].trim()
      });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (orderedItems.length > 0) {
        flushLists();
      }
      unorderedItems.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (unorderedItems.length > 0) {
        flushLists();
      }
      orderedItems.push(orderedMatch[1].trim());
      continue;
    }

    flushLists();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushLists();

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return <strong key={index}>{segment.slice(2, -2)}</strong>;
      }

      if (segment.startsWith("`") && segment.endsWith("`")) {
        return <code key={index}>{segment.slice(1, -1)}</code>;
      }

      return segment;
    });
}

export function ChatMessageContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="chat-message-body">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return <h4 key={index}>{renderInline(block.text)}</h4>;

          case "unordered-list":
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ol>
            );

          default:
            return <p key={index}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
