export interface Briefing {
  tastingOrder: Array<{ bottleName: string; reason: string }>;
  bottleProfiles: Array<{
    bottleName: string;
    keyNotes: string[];
    watchFor: string;
    background: string;
  }>;
  tips: string[];
}

type ParsedBottleDescriptor = {
  name: string;
  producer?: string;
  specs?: string;
  tags?: string;
  extras: string[];
};

function normalizeDash(value: string) {
  return value.replace(/[–—]/g, "—").trim();
}

function parseBottleDescriptor(value: string): ParsedBottleDescriptor {
  const parts = value
    .split("|")
    .map((part) => normalizeDash(part))
    .filter(Boolean);

  const [name, ...rest] = parts;
  const extras: string[] = [];
  let producer: string | undefined;
  const specs: string[] = [];
  let tags: string | undefined;

  for (const part of rest) {
    if (/^tags?\s*:/i.test(part)) {
      tags = part.replace(/^tags?\s*:/i, "").trim();
      continue;
    }

    if (/%|yo\b|nas\b/i.test(part)) {
      specs.push(part);
      continue;
    }

    if (!producer) {
      producer = part;
      continue;
    }

    extras.push(part);
  }

  return {
    name: name || value.trim(),
    producer,
    specs: specs.length > 0 ? specs.join(" · ") : undefined,
    tags,
    extras
  };
}

function buildDescriptorLines(descriptor: ParsedBottleDescriptor) {
  const lines: string[] = [];

  if (descriptor.producer) lines.push(`**Producer:** ${descriptor.producer}`);
  if (descriptor.specs) lines.push(`**Specs:** ${descriptor.specs}`);
  if (descriptor.tags) lines.push(`**Tags:** ${descriptor.tags}`);
  for (const extra of descriptor.extras) {
    lines.push(`**Detail:** ${extra}`);
  }

  return lines;
}

export function formatBriefingAsMarkdown(briefing: Briefing): string {
  const blocks: string[] = [];

  if (briefing.tastingOrder.length > 0) {
    const tastingOrderLines = briefing.tastingOrder.flatMap((entry, index) => {
      const descriptor = parseBottleDescriptor(entry.bottleName);
      return [`${index + 1}. **${descriptor.name}**`, `   - **Why here:** ${normalizeDash(entry.reason)}`];
    });

    blocks.push(["## Tasting Order", "", ...tastingOrderLines].join("\n"));
  }

  if (briefing.bottleProfiles.length > 0) {
    const profileBlocks = briefing.bottleProfiles.map((profile) => {
      const descriptor = parseBottleDescriptor(profile.bottleName);
      const lines = [`### ${descriptor.name}`, ""];

      for (const detail of buildDescriptorLines(descriptor)) {
        lines.push(`- ${detail}`);
      }

      if (profile.keyNotes.length > 0) {
        lines.push(`- **Key notes:** ${profile.keyNotes.join(", ")}`);
      }
      if (profile.watchFor) {
        lines.push(`- **Watch for:** ${normalizeDash(profile.watchFor)}`);
      }
      if (profile.background) {
        lines.push(`- **Background:** ${normalizeDash(profile.background)}`);
      }

      return lines.join("\n");
    });

    blocks.push(["## Bottle Profiles", "", ...profileBlocks].join("\n\n"));
  }

  if (briefing.tips.length > 0) {
    blocks.push(["## Tips", "", ...briefing.tips.map((tip) => `- ${normalizeDash(tip)}`)].join("\n"));
  }

  return blocks.join("\n\n").trim();
}

export const formatBriefingAsText = formatBriefingAsMarkdown;
