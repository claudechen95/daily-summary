"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEntryAction, generateInsightAction } from "@/app/actions";
import { DEFAULT_INSIGHT_PROMPT } from "@/lib/insight";
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
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_INSIGHT_PROMPT);
  const [generating, setGenerating] = useState(false);
  const [liveInsight, setLiveInsight] = useState(insight);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    await deleteEntryAction(date, index);
    router.refresh();
  }

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateInsightAction(date, index, text, prompt);
    if (result) {
      setLiveInsight(result);
      setShowPromptEditor(false);
    }
    setGenerating(false);
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

      <div className="mt-8 pt-6 border-t border-gray-100">
        {liveInsight && !showPromptEditor && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">AI Insight</p>
              <button
                onClick={() => setShowPromptEditor(true)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Edit prompt
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-3">
              {liveInsight}
            </p>
          </>
        )}

        {(!liveInsight || showPromptEditor) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              {liveInsight ? "Edit prompt & regenerate" : "Generate AI Insight"}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {generating ? "Generating…" : "Generate"}
              </button>
              {showPromptEditor && (
                <button
                  onClick={() => setShowPromptEditor(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
