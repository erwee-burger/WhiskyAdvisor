export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
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
  } catch {
    return "";
  }
}
