import { NextRequest, NextResponse } from "next/server";
import { getAllSummaries, updateEntryInsight } from "@/lib/redis";
import { generateInsight } from "@/lib/insight";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.API_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summaries = await getAllSummaries();
  const results: { date: string; index: number; ok: boolean }[] = [];

  for (const day of summaries) {
    for (let i = 0; i < day.entries.length; i++) {
      const entry = day.entries[i];
      if (entry.insight) continue;
      const insight = await generateInsight(entry.text);
      if (insight) {
        await updateEntryInsight(day.date, i, insight);
        results.push({ date: day.date, index: i, ok: true });
      } else {
        results.push({ date: day.date, index: i, ok: false });
      }
    }
  }

  return NextResponse.json({ backfilled: results });
}
