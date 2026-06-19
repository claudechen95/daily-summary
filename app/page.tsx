import { getAllSummaries } from "@/lib/redis";
import DaySummaryView from "@/components/DaySummary";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function Home() {
  const summaries = await getAllSummaries();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Daily Summary</h1>
      <p className="text-gray-400 mb-12 text-sm">What I've been up to</p>

      {summaries.length === 0 ? (
        <p className="text-gray-400 text-sm">No entries yet.</p>
      ) : (
        <div className="space-y-16">
          {summaries.map((entry) => (
            <article key={entry.date}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6 pb-3 border-b border-gray-100">
                {formatDate(entry.date)}
              </h2>
              <DaySummaryView text={entry.text} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
