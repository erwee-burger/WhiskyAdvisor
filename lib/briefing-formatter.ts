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

export function formatBriefingAsMarkdown(briefing: Briefing): string {
  const blocks: string[] = [];

  if (briefing.tastingOrder.length > 0) {
    blocks.push(
      [
        "## Tasting Order",
        "",
        ...briefing.tastingOrder.map((entry, index) => `${index + 1}. ${entry.bottleName} — ${entry.reason}`)
      ].join("\n")
    );
  }

  if (briefing.bottleProfiles.length > 0) {
    const profileBlocks = briefing.bottleProfiles.map((profile) => {
      const lines = [`### ${profile.bottleName}`, ""];

      if (profile.keyNotes.length > 0) {
        lines.push(`**Key notes:** ${profile.keyNotes.join(", ")}`);
      }
      if (profile.watchFor) {
        lines.push(`**Watch for:** ${profile.watchFor}`);
      }
      if (profile.background) {
        lines.push(`**Background:** ${profile.background}`);
      }

      return lines.join("\n");
    });

    blocks.push(["## Bottle Profiles", "", ...profileBlocks].join("\n\n"));
  }

  if (briefing.tips.length > 0) {
    blocks.push(["## Tips", "", ...briefing.tips.map((tip) => `- ${tip}`)].join("\n"));
  }

  return blocks.join("\n\n").trim();
}

export const formatBriefingAsText = formatBriefingAsMarkdown;
