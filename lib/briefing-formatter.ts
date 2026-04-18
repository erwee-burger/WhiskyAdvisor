interface Briefing {
  tastingOrder: Array<{ bottleName: string; reason: string }>;
  bottleProfiles: Array<{
    bottleName: string;
    keyNotes: string[];
    watchFor: string;
    background: string;
  }>;
  tips: string[];
}

export function formatBriefingAsText(briefing: Briefing): string {
  const sections: string[] = [];

  if (briefing.tastingOrder.length > 0) {
    sections.push("## Tasting Order");
    briefing.tastingOrder.forEach((entry, index) => {
      sections.push(`${index + 1}. ${entry.bottleName} — ${entry.reason}`);
    });
  }

  if (briefing.bottleProfiles.length > 0) {
    sections.push("\n## Bottle Profiles");
    for (const profile of briefing.bottleProfiles) {
      sections.push(`### ${profile.bottleName}`);
      if (profile.keyNotes.length > 0) {
        sections.push(`Key notes: ${profile.keyNotes.join(", ")}`);
      }
      if (profile.watchFor) {
        sections.push(`Watch for: ${profile.watchFor}`);
      }
      if (profile.background) {
        sections.push(`Background: ${profile.background}`);
      }
    }
  }

  if (briefing.tips.length > 0) {
    sections.push("\n## Tips");
    for (const tip of briefing.tips) {
      sections.push(`- ${tip}`);
    }
  }

  return sections.join("\n");
}
