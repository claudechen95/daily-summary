"use client";

import { useState } from "react";
import { deleteEntryAction } from "@/app/actions";
import DaySummaryView from "./DaySummary";

interface Props {
  text: string;
  date: string;
  index: number;
  timestamp?: string;
}

export default function EntryCard({ text, date, index, timestamp }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    await deleteEntryAction(date, index);
  }

  return (
    <div className={`relative group ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      {timestamp && (
        <p className="text-xs text-gray-300 mb-4">{timestamp}</p>
      )}
      <button
        onClick={handleDelete}
        title="Delete entry"
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 text-sm leading-none p-1 -mt-1 -mr-1"
        aria-label="Delete entry"
      >
        ×
      </button>
      <DaySummaryView text={text} />
    </div>
  );
}
