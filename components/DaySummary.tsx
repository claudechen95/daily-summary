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
      prose = ""; // skip h1 title
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

function TopSites({ body }: { body: string }) {
  const lines = body.split("\n").filter((l) => l.match(/^\d+\./));
  return (
    <ol className="space-y-2">
      {lines.map((line, i) => {
        const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s+\((\d+) visits?\)\s+[—–-]\s+(.+)/);
        if (!match) return null;
        const [, site, visits, desc] = match;
        return (
          <li key={i} className="flex items-start gap-3">
            <span className="text-xs font-mono text-gray-300 w-5 pt-0.5 shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{site}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                  {visits}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Timeline({ body }: { body: string }) {
  const blocks = body.split(/\n(?=\*\*\d)/).filter(Boolean);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const timeMatch = block.match(/^\*\*(.+?)\*\*/);
        const rest = block.replace(/^\*\*.+?\*\*\s*[—–-]?\s*/, "").trim();
        return (
          <div key={i} className="flex gap-3">
            <div className="shrink-0 text-xs font-mono text-gray-400 w-20 pt-0.5">
              {timeMatch?.[1]}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed flex-1">{rest}</p>
          </div>
        );
      })}
    </div>
  );
}

function Categories({ body }: { body: string }) {
  const lines = body.split("\n").filter((l) => l.startsWith("**") || l.startsWith("- **"));
  const items = lines.map((line) => {
    const match = line.match(/\*\*(.+?)\*\*.*?(\d+)%/);
    if (!match) return null;
    return { label: match[1], pct: parseInt(match[2]) };
  }).filter(Boolean) as { label: string; pct: number }[];

  if (!items.length) {
    return <ReactMarkdown>{body}</ReactMarkdown>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700">{item.label}</span>
            <span className="text-gray-400">{item.pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-800 rounded-full"
              style={{ width: `${item.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DaySummaryView({ text }: { text: string }) {
  const { sections } = parseSections(text);

  const summary = sections.find((s) => s.title.includes("Day Summary") || s.title.includes("Summary"));
  const topSites = sections.find((s) => s.title.includes("Top Sites"));
  const timeline = sections.find((s) => s.title.includes("Timeline"));
  const categories = sections.find((s) => s.title.includes("Category"));

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
    </div>
  );
}
