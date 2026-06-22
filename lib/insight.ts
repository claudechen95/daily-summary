export async function generateInsight(text: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.Z_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-5.2",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Based on this day's web browsing activity summary, provide a holistic 2-3 sentence suggestion about habits, balance, or how to improve tomorrow. Be specific and actionable.\n\n${text}`,
        }],
      }),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    // glm-5.2 is a reasoning model — content may be empty, answer falls into reasoning_content
    return (msg?.content || msg?.reasoning_content || "").trim() || undefined;
  } catch {
    return undefined;
  }
}
