const TTL_MS = 4 * 60 * 60 * 1000;

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

export function hashData(data: unknown): string {
  return simpleHash(JSON.stringify(data));
}

export function getCachedAiResult(cacheKey: string, dataHash: string): string | null {
  try {
    const raw = localStorage.getItem(`ai_cache_${cacheKey}`);
    if (!raw) return null;
    const { hash, result, timestamp } = JSON.parse(raw) as { hash: string; result: string; timestamp: number };
    if (hash !== dataHash) return null;
    if (Date.now() - timestamp > TTL_MS) return null;
    return result;
  } catch {
    return null;
  }
}

export function setCachedAiResult(cacheKey: string, dataHash: string, result: string): void {
  try {
    localStorage.setItem(`ai_cache_${cacheKey}`, JSON.stringify({ hash: dataHash, result, timestamp: Date.now() }));
  } catch {
    // quota exceeded — ignore
  }
}
