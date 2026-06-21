import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

export interface DayEntry {
  text: string;
  createdAt: string;
}

export interface DaySummary {
  date: string;
  entries: DayEntry[];
  updatedAt: string;
}

// handles old single-text format transparently
type StoredValue =
  | DaySummary
  | { date: string; text: string; createdAt: string; updatedAt: string };

function normalize(raw: StoredValue): DaySummary {
  if ("entries" in raw) return raw;
  return {
    date: raw.date,
    entries: [{ text: raw.text, createdAt: raw.createdAt }],
    updatedAt: raw.updatedAt,
  };
}

const INDEX_KEY = "summary:index";

export async function saveSummary(date: string, text: string): Promise<DaySummary> {
  const redis = getRedis();
  const key = `summary:${date}`;

  const raw = await redis.get<StoredValue>(key);
  const existing = raw ? normalize(raw) : null;
  const now = new Date().toISOString();

  const updated: DaySummary = {
    date,
    entries: [...(existing?.entries ?? []), { text, createdAt: now }],
    updatedAt: now,
  };

  await redis.set(key, updated);
  await redis.zadd(INDEX_KEY, { score: new Date(date).getTime(), member: date });

  return updated;
}

export async function getAllSummaries(): Promise<DaySummary[]> {
  const redis = getRedis();
  const dates = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!dates.length) return [];

  const raws = await Promise.all(dates.map((d) => redis.get<StoredValue>(`summary:${d}`)));

  return raws
    .filter((r): r is StoredValue => r !== null)
    .map(normalize);
}

export async function deleteEntry(date: string, index: number): Promise<void> {
  const redis = getRedis();
  const key = `summary:${date}`;
  const raw = await redis.get<StoredValue>(key);
  if (!raw) return;

  const existing = normalize(raw);
  const entries = existing.entries.filter((_, i) => i !== index);

  if (entries.length === 0) {
    await redis.del(key);
    await redis.zrem(INDEX_KEY, date);
    return;
  }

  const now = new Date().toISOString();
  await redis.set(key, { date, entries, updatedAt: now });
}
