"use server";

import { deleteEntry, updateEntryInsight } from "@/lib/redis";
import { generateInsight } from "@/lib/insight";
import { revalidatePath } from "next/cache";

export async function deleteEntryAction(date: string, index: number) {
  await deleteEntry(date, index);
  revalidatePath("/");
}

export async function generateInsightAction(
  date: string,
  index: number,
  text: string,
  prompt: string,
): Promise<string | undefined> {
  const insight = await generateInsight(text, prompt);
  if (insight) {
    await updateEntryInsight(date, index, insight);
    revalidatePath("/");
  }
  return insight;
}
