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

export interface DaySummary {
  date: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

const INDEX_KEY = "summary:index";

export async function saveSummary(date: string, text: string): Promise<DaySummary> {
  const redis = getRedis();
  const key = `summary:${date}`;

  const existing = await redis.get<DaySummary>(key);
  const createdAt = existing ? existing.createdAt : new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const entry: DaySummary = { date, text, createdAt, updatedAt };
  const score = new Date(date).getTime();

  await redis.set(key, entry);
  await redis.zadd(INDEX_KEY, { score, member: date });

  return entry;
}

export async function getAllSummaries(): Promise<DaySummary[]> {
  const redis = getRedis();
  const dates = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!dates.length) return [];

  const entries = await Promise.all(
    dates.map((d) => redis.get<DaySummary>(`summary:${d}`))
  );

  return entries.filter((e): e is DaySummary => e !== null);
}
