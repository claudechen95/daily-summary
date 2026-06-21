"use server";

import { deleteEntry } from "@/lib/redis";
import { revalidatePath } from "next/cache";

export async function deleteEntryAction(date: string, index: number) {
  await deleteEntry(date, index);
  revalidatePath("/");
}
