// lib/search.ts
import { getServerEnv } from "@/lib/env";

export async function webSearch(query: string): Promise<string> {
  const { OPENAI_API_KEY } = getServerEnv();

  if (!OPENAI_API_KEY) return "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        messages: [{ role: "user", content: query }]
      })
    });

    if (!response.ok) return "";

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}
