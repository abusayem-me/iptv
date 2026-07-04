export type StreamHealth = "live" | "dead" | "checking";

export type HealthCheckStats = {
  done: number;
  total: number;
  live: number;
  dead: number;
};

type ChannelRef = { streamUrl: string };

const BATCH_SIZE = 30;
const BATCH_CONCURRENCY = 3;

type BatchResponse = {
  results?: Record<string, { live?: boolean }>;
};

async function checkBatch(
  origin: string,
  urls: string[],
  signal?: AbortSignal
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (urls.length === 0) return out;

  const res = await fetch(`${origin}/api/check-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    for (const url of urls) out.set(url, false);
    return out;
  }

  const j = (await res.json()) as BatchResponse;
  for (const url of urls) {
    out.set(url, !!j.results?.[url]?.live);
  }
  return out;
}

/** Check many streams via batched API calls; calls onUpdate per channel. */
export async function runChannelHealthCheck(
  origin: string,
  channels: ChannelRef[],
  opts: {
    signal?: AbortSignal;
    onUpdate: (streamUrl: string, health: StreamHealth, stats: HealthCheckStats) => void;
    onBatchComplete?: (results: Map<string, StreamHealth>) => void;
  }
): Promise<Map<string, StreamHealth>> {
  const total = channels.length;
  const results = new Map<string, StreamHealth>();
  let done = 0;
  let live = 0;
  let dead = 0;

  const stats = (): HealthCheckStats => ({ done, total, live, dead });

  const batches: string[][] = [];
  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    batches.push(channels.slice(i, i + BATCH_SIZE).map((c) => c.streamUrl));
  }

  let batchIdx = 0;

  const worker = async () => {
    while (batchIdx < batches.length) {
      if (opts.signal?.aborted) return;
      const i = batchIdx++;
      const urls = batches[i];
      if (!urls?.length) return;

      for (const url of urls) {
        if (opts.signal?.aborted) return;
        opts.onUpdate(url, "checking", stats());
      }

      let batchResults: Map<string, boolean>;
      try {
        batchResults = await checkBatch(origin, urls, opts.signal);
      } catch {
        batchResults = new Map(urls.map((url) => [url, false]));
      }

      if (opts.signal?.aborted) return;

      const batchHealth = new Map<string, StreamHealth>();
      for (const url of urls) {
        const isLive = batchResults.get(url) ?? false;
        done++;
        if (isLive) live++;
        else dead++;
        const health: StreamHealth = isLive ? "live" : "dead";
        results.set(url, health);
        batchHealth.set(url, health);
        opts.onUpdate(url, health, stats());
      }
      opts.onBatchComplete?.(batchHealth);
    }
  };

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, batches.length || 1) }, () => worker()));
  return results;
}
