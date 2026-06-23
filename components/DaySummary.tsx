"use client";

import ReactMarkdown from "react-markdown";

interface Section {
  title: string;
  emoji: string;
  body: string;
}

function parseSections(text: string): { prose: string; sections: Section[] } {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let prose = "";
  let currentSection: Section | null = null;
  let bodyLines: string[] = [];

  for (const line of lines) {
    const h3 = line.match(/^#{2,3}\s+([\S]+)\s+(.+)/);
    if (h3) {
      if (currentSection) {
        currentSection.body = bodyLines.join("\n").trim();
        sections.push(currentSection);
        bodyLines = [];
      }
      currentSection = { emoji: h3[1], title: h3[2].trim(), body: "" };
    } else if (line.startsWith("# ")) {
      prose = "";
    } else if (!currentSection) {
      prose += line + "\n";
    } else {
      bodyLines.push(line);
    }
  }
  if (currentSection) {
    currentSection.body = bodyLines.join("\n").trim();
    sections.push(currentSection);
  }

  return { prose: prose.trim(), sections };
}

function parseTopSiteLine(line: string): { site: string; visits: string; desc: string } | null {
  if (!line.match(/^\d+\./)) return null;

  // 1. **site** (N visits) — desc
  let m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*\((\d+)\s*visits?\)\s*(?:—|–|-)+\s*(.+)/);
  if (m) return { site: m[1], visits: m[2], desc: m[3] };

  // 1. **site** — N visits — desc
  m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(?:—|–|-)+\s*(\d+)\s*visits?\s*(?:—|–|-)+\s*(.+)/);
  if (m) return { site: m[1], visits: m[2], desc: m[3] };

  // 1. **site** (N) — desc
  m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*\((\d+)\)\s*(?:—|–|-)+\s*(.+)/);
  if (m) return { site: m[1], visits: m[2], desc: m[3] };

  // 1. **site** — desc  (no visit count)
  m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(?:—|–|-)+\s*(.+)/);
  if (m) return { site: m[1], visits: "", desc: m[2] };

  // 1. site (N visits) — desc  (no bold)
  m = line.match(/^\d+\.\s+(.+?)\s*\((\d+)\s*visits?\)\s*(?:—|–|-)+\s*(.+)/);
  if (m) return { site: m[1], visits: m[2], desc: m[3] };

  // Fallback: grab whatever is there
  m = line.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*$/);
  if (m) return { site: m[1].trim(), visits: "", desc: "" };

  return null;
}

function TopSites({ body }: { body: string }) {
  const lines = body.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  const items = lines.map(parseTopSiteLine).filter(Boolean) as { site: string; visits: string; desc: string }[];

  if (!items.length) return <ReactMarkdown>{body}</ReactMarkdown>;

  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="text-xs font-mono text-gray-300 w-5 pt-0.5 shrink-0 text-right">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{item.site}</span>
              {item.visits && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                  {item.visits}
                </span>
              )}
            </div>
            {item.desc && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ body }: { body: string }) {
  const blocks = body.split(/\n(?=\*\*\d)/).filter(Boolean);
  return (
    <div className="relative">
      <div className="absolute left-[5.5rem] top-1.5 bottom-1.5 w-px bg-gray-100" />
      <div className="space-y-4">
        {blocks.map((block, i) => {
          const timeMatch = block.match(/^\*\*(.+?)\*\*/);
          const rest = block.replace(/^\*\*.+?\*\*\s*[—–\-]?\s*/, "").trim();
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="shrink-0 text-xs font-mono text-gray-400 w-20 text-right pt-0.5">
                {timeMatch?.[1]}
              </div>
              <div className="shrink-0 w-2 h-2 rounded-full bg-gray-200 mt-1.5 z-10" />
              <p className="text-sm text-gray-700 leading-relaxed flex-1">{rest}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseDurationToMinutes(duration: string): number {
  let total = 0;
  const hours = duration.match(/(\d+)h/);
  const mins = duration.match(/(\d+)m/);
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins) total += parseInt(mins[1]);
  return total;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const CATEGORY_PALETTE = [
  { bar: "bg-blue-500", track: "bg-blue-50", text: "text-blue-600" },
  { bar: "bg-violet-500", track: "bg-violet-50", text: "text-violet-600" },
  { bar: "bg-emerald-500", track: "bg-emerald-50", text: "text-emerald-600" },
  { bar: "bg-amber-500", track: "bg-amber-50", text: "text-amber-600" },
  { bar: "bg-rose-500", track: "bg-rose-50", text: "text-rose-600" },
  { bar: "bg-teal-500", track: "bg-teal-50", text: "text-teal-600" },
];

function Categories({ body }: { body: string }) {
  const lines = body.split("\n").filter((l) => l.startsWith("**") || l.startsWith("- **") || l.startsWith("- "));
  const items = lines.map((line) => {
    // Match label, optional duration (e.g. "67h 17m"), and percentage
    const m = line.match(/\*\*(.+?)\*\*.*?(?:(\d+h\s*\d*m?|\d+m).*?)?(\d+)%/);
    if (!m) return null;
    return { label: m[1], duration: m[2]?.trim() ?? null, pct: parseInt(m[3]) };
  }).filter(Boolean) as { label: string; duration: string | null; pct: number }[];

  if (!items.length) return <ReactMarkdown>{body}</ReactMarkdown>;

  const total = items.reduce((s, it) => s + it.pct, 0);
  const itemsWithDuration = items.filter((it) => it.duration !== null);
  const totalMinutes = itemsWithDuration.length > 0
    ? itemsWithDuration.reduce((sum, it) => sum + parseDurationToMinutes(it.duration!), 0)
    : null;

  return (
    <div className="space-y-1">
      {totalMinutes !== null && (
        <p className="text-xs text-gray-400 mb-3">
          Total: <span className="text-gray-700 font-medium">{formatMinutes(totalMinutes)}</span>
        </p>
      )}
      {/* Stacked bar summary */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px">
        {items.map((item, i) => {
          const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
          return (
            <div
              key={i}
              className={`${color.bar} transition-all`}
              style={{ width: `${(item.pct / Math.max(total, 100)) * 100}%` }}
            />
          );
        })}
        {total < 100 && (
          <div className="bg-gray-100 flex-1" />
        )}
      </div>

      {/* Per-category rows */}
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${color.bar} shrink-0`} />
                  <span className="text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.duration && (
                    <span className="text-gray-400 font-mono">{item.duration}</span>
                  )}
                  <span className={`font-medium ${color.text}`}>{item.pct}%</span>
                </div>
              </div>
              <div className={`h-1.5 ${color.track} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${color.bar} rounded-full`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DaySummaryView({ text }: { text: string }) {
  const { sections } = parseSections(text);

  const summary = sections.find((s) => s.title.includes("Day Summary") || s.title.includes("Summary"));
  const topSites = sections.find((s) => s.title.includes("Top Sites"));
  const timeline = sections.find((s) => s.title.includes("Timeline"));
  const categories = sections.find((s) => s.title.includes("Category"));
  const suggestions = sections.find((s) => s.title.includes("Suggestions"));
  const blindSpots = sections.find((s) => s.title.includes("Blind Spots") || s.title.includes("Blind"));

  return (
    <div className="space-y-8">
      {summary && (
        <p className="text-gray-700 leading-relaxed text-sm border-l-2 border-gray-200 pl-4">
          {summary.body}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {topSites && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Top Sites
            </h3>
            <TopSites body={topSites.body} />
          </div>
        )}
        {categories && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Categories
            </h3>
            <Categories body={categories.body} />
          </div>
        )}
      </div>

      {timeline && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Timeline
          </h3>
          <Timeline body={timeline.body} />
        </div>
      )}

      {(suggestions || blindSpots) && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {suggestions && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Suggestions
              </h3>
              <ReactMarkdown
                components={{
                  ol: ({ children }) => <ol className="space-y-3 list-none p-0">{children}</ol>,
                  li: ({ children }) => (
                    <li className="text-sm text-gray-700 leading-relaxed pl-4 border-l-2 border-gray-100">{children}</li>
                  ),
                  strong: ({ children }) => <strong className="text-gray-900">{children}</strong>,
                }}
              >
                {suggestions.body}
              </ReactMarkdown>
            </div>
          )}
          {blindSpots && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Blind Spots
              </h3>
              <ReactMarkdown
                components={{
                  ol: ({ children }) => <ol className="space-y-3 list-none p-0">{children}</ol>,
                  li: ({ children }) => (
                    <li className="text-sm text-gray-700 leading-relaxed pl-4 border-l-2 border-amber-100">{children}</li>
                  ),
                  strong: ({ children }) => <strong className="text-gray-900">{children}</strong>,
                }}
              >
                {blindSpots.body}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
