"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEntryAction } from "@/app/actions";
import DaySummaryView from "./DaySummary";

interface Props {
  text: string;
  date: string;
  index: number;
  timestamp?: string;
  insight?: string;
}

export default function EntryCard({ text, date, index, timestamp, insight }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    await deleteEntryAction(date, index);
    router.refresh();
  }

  return (
    <div className={`relative pr-6 ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      {timestamp && (
        <p className="text-xs text-gray-300 mb-4">{timestamp}</p>
      )}
      <button
        onClick={handleDelete}
        title="Delete entry"
        className="absolute top-0 right-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none p-1 -mt-1 -mr-1"
        aria-label="Delete entry"
      >
        ×
      </button>
      <DaySummaryView text={text} />
      {insight && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">AI Insight</p>
          <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-3">{insight}</p>
        </div>
      )}
    </div>
  );
}
