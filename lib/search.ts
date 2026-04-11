// lib/search.ts — uses Responses API so web_search_preview works with GPT-5.4
import { getServerEnv } from "@/lib/env";

export async function webSearch(query: string): Promise<string> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) return "";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: "web_search_preview" }],
        input: query
      })
    });

    if (!response.ok) return "";

    const data = await response.json() as {
      output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
    };

    if (!Array.isArray(data.output)) return "";
    for (let i = data.output.length - 1; i >= 0; i--) {
      const item = data.output[i];
      if (item.type === "message" && Array.isArray(item.content)) {
        const textPart = item.content.find((c) => c.type === "output_text");
        if (textPart?.text) return textPart.text;
      }
    }
    return "";
  } catch {
    return "";
  }
}
