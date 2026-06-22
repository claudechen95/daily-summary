"use client";

import { useState } from "react";
import { deleteEntryAction, generateSuggestionAction } from "@/app/actions";
import DaySummaryView from "./DaySummary";

interface Props {
  text: string;
  date: string;
  index: number;
  timestamp?: string;
}

export default function EntryCard({ text, date, index, timestamp }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    await deleteEntryAction(date, index);
  }

  async function handleSuggest() {
    setGenerating(true);
    try {
      const result = await generateSuggestionAction(text);
      setSuggestion(result);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={`relative ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      {timestamp && (
        <p className="text-xs text-gray-300 mb-4">{timestamp}</p>
      )}
      <button
        onClick={handleDelete}
        title="Delete entry"
        className="absolute top-0 right-0 opacity-30 hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 text-lg leading-none p-1 -mt-1 -mr-1"
        aria-label="Delete entry"
      >
        ×
      </button>
      <DaySummaryView text={text} />
      <div className="mt-8 pt-6 border-t border-gray-100">
        {suggestion ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">AI Insight</p>
            <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-3">{suggestion}</p>
          </div>
        ) : (
          <button
            onClick={handleSuggest}
            disabled={generating}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:cursor-not-allowed"
          >
            {generating ? "Thinking…" : "✦ Get AI insight"}
          </button>
        )}
      </div>
    </div>
  );
}
