import { NextRequest, NextResponse } from "next/server";
import { saveSummary } from "@/lib/redis";
import { generateInsight } from "@/lib/insight";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.API_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text } = body;
  const date = body.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const insight = await generateInsight(text.trim());
  const entry = await saveSummary(date, text.trim(), insight);
  return NextResponse.json(entry, { status: 200 });
}
