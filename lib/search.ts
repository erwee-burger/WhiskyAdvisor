async function tavilySearch(query: string): Promise<string> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true
    })
  });

  if (!response.ok) return "";

  const data = await response.json() as {
    answer?: string;
    results: Array<{ title: string; content: string; url: string }>;
  };

  const parts: string[] = [];
  if (data.answer) parts.push(`Summary: ${data.answer}`);
  for (const r of data.results.slice(0, 5)) {
    parts.push(`${r.title}\n${r.content}`);
  }

  return parts.join("\n\n---\n\n");
}

async function openAiSearch(query: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
}

export async function webSearch(query: string): Promise<string> {
  try {
    if (process.env.TAVILY_API_KEY) {
      return await tavilySearch(query);
    }
    if (process.env.OPENAI_API_KEY) {
      return await openAiSearch(query);
    }
    return "";
  } catch {
    return "";
  }
}
