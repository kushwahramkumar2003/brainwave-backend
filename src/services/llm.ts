import Anthropic from "@anthropic-ai/sdk";
import config from "../config";
import { decode, encode } from "gpt-3-encoder";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

type CacheEntry = {
  response: string;
  timestamp: number;
  tokenCount: number;
};

const responseCache: Map<string, CacheEntry> = new Map();

const DAILY_TOKEN_LIMIT: number = 100000;
const CACHE_DURATION: number = 1000 * 60 * 60 * 24; // 24 hours
let dailyTokenCount: number = 0;
let lastReset: number = new Date().setHours(0, 0, 0, 0);

interface ContentItem {
  metadata: {
    type: string;
    text: string;
  };
}

interface QueryOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string; // "claude-3-haiku-20240307";
  cacheEnabled?: boolean;
  maxContextTokens?: number;
  forceFresh?: boolean;
}

const DEFAULT_OPTIONS: Required<QueryOptions> = {
  maxTokens: 250,
  temperature: 0.7,
  model: "claude-3-haiku-20240307",
  cacheEnabled: true,
  maxContextTokens: 800,
  forceFresh: false,
};

function countTokens(text: string): number {
  return encode(text).length;
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const tokens: number[] = encode(text);
  if (tokens.length <= maxTokens) return text;
  return decode(tokens.slice(0, maxTokens));
}

function getCacheKey(query: string, context: string): string {
  return `${query}:${context}`.replace(/\s+/g, "");
}

function resetDailyTokenCount(): void {
  const now: number = new Date().setHours(0, 0, 0, 0);
  if (now > lastReset) {
    dailyTokenCount = 0;
    lastReset = now;
  }
}

const requestQueue: Promise<void>[] = [];
const MAX_CONCURRENT_REQUESTS: number = 1;
const MIN_TIME_BETWEEN_REQUESTS: number = 3000;

async function rateLimit(): Promise<void> {
  while (requestQueue.length >= MAX_CONCURRENT_REQUESTS) {
    await requestQueue[0];
    requestQueue.shift();
  }

  const request: Promise<void> = new Promise((resolve) =>
    setTimeout(resolve, MIN_TIME_BETWEEN_REQUESTS)
  );
  requestQueue.push(request);
  return request;
}

export async function queryLLM(
  query: string,
  relevantContent: ContentItem[],
  options: QueryOptions = {},
  retries: number = 2
): Promise<string> {
  try {
    resetDailyTokenCount();

    const {
      maxTokens,
      temperature,
      model,
      cacheEnabled,
      maxContextTokens,
      forceFresh,
    }: Required<QueryOptions> = { ...DEFAULT_OPTIONS, ...options };

    const optimizedContent: ContentItem[] = relevantContent
      .filter((content) => content.metadata.text.trim().length > 0)
      .reduce((acc: ContentItem[], content: ContentItem) => {
        const exists: boolean = acc.some(
          (c) => c.metadata.text === content.metadata.text
        );
        if (!exists) acc.push(content);
        return acc;
      }, []);

    const context: string = optimizedContent
      .map(({ metadata: { type, text } }) => `${type}: ${text}`)
      .join("\n\n");

    const truncatedContext: string = truncateToTokenLimit(
      context,
      maxContextTokens
    );

    if (cacheEnabled && !forceFresh) {
      const cacheKey: string = getCacheKey(query, truncatedContext);
      const cachedResult: CacheEntry | undefined = responseCache.get(cacheKey);

      if (
        cachedResult &&
        Date.now() - cachedResult.timestamp < CACHE_DURATION
      ) {
        return cachedResult.response;
      }
    }

    const estimatedTokens: number =
      countTokens(truncatedContext) + countTokens(query) + maxTokens;
    if (dailyTokenCount + estimatedTokens > DAILY_TOKEN_LIMIT) {
      return "Daily API quota limit reached. Please try again tomorrow or use cached responses only.";
    }

    await rateLimit();

    const systemPrompt: string =
      "Provide very concise answers based on the context provided. Keep responses brief and focused.";

    const completion = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\nContext:\n${truncatedContext}\n\nQuestion: ${query}\n\nProvide a brief response.`,
        },
      ],
    });

    const response: string =
      //@ts-ignore
      completion.content?.[0]?.text || "Sorry, I couldn't generate a response.";

    const responseTokens: number = countTokens(response);
    dailyTokenCount += estimatedTokens;

    if (cacheEnabled) {
      const cacheKey: string = getCacheKey(query, truncatedContext);
      responseCache.set(cacheKey, {
        response,
        timestamp: Date.now(),
        tokenCount: responseTokens,
      });
    }

    return response;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("status" in error || "error" in error)
    ) {
      const err = error as any;
      if (err.status === 429 || err.error?.type === "rate_limit_exceeded") {
        if (retries > 0) {
          console.warn(
            `Rate/quota limit hit. Retrying with more aggressive caching...`
          );

          return queryLLM(
            query,
            relevantContent,
            {
              ...options,
              maxTokens: Math.floor(options.maxTokens! * 0.7),
              maxContextTokens: Math.floor(options.maxContextTokens! * 0.7),
              cacheEnabled: true,
            },
            retries - 1
          );
        }

        const similarResponse: string | null = findSimilarCachedResponse(query);
        if (similarResponse) {
          return `(Cached similar response due to API limits): ${similarResponse}`;
        }
      }
    }

    console.error("Error querying Claude:", error);
    throw new Error(
      `Failed to generate response: ${
        (error as any)?.error?.message || (error as Error).message
      }`
    );
  }
}

function findSimilarCachedResponse(query: string): string | null {
  const queryWords: Set<string> = new Set(query.toLowerCase().split(/\W+/));
  let bestMatch: string | null = null;
  let highestOverlap: number = 0;

  for (const key of responseCache.keys()) {
    const cacheWords: Set<string> = new Set(key.toLowerCase().split(/\W+/));
    const overlap: number = [...queryWords].filter((word) =>
      cacheWords.has(word)
    ).length;
    if (overlap > highestOverlap) {
      highestOverlap = overlap;
      bestMatch = key;
    }
  }

  if (bestMatch && highestOverlap >= 2) {
    return responseCache.get(bestMatch)?.response || null;
  }
  return null;
}

export function cleanupCache(): void {
  const now: number = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      responseCache.delete(key);
    }
  }
}

setInterval(cleanupCache, CACHE_DURATION);
