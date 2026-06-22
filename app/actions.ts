"use server";

import { deleteEntry } from "@/lib/redis";
import { revalidatePath } from "next/cache";

export async function deleteEntryAction(date: string, index: number) {
  await deleteEntry(date, index);
  revalidatePath("/");
}

export async function generateSuggestionAction(text: string): Promise<string> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.Z_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Based on this day's web browsing activity summary, provide a holistic 2-3 sentence suggestion about habits, balance, or how to improve tomorrow. Be specific and actionable.\n\n${text}`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`Kimi API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
