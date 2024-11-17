import { HfInference } from "@huggingface/inference";
import config from "../config";
import { decode, encode } from "gpt-3-encoder";

const hf = new HfInference(config.HUGGINGFACE_API_KEY);

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
  model?: string;
  cacheEnabled?: boolean;
  maxContextTokens?: number;
  forceFresh?: boolean;
}

const DEFAULT_OPTIONS: Required<QueryOptions> = {
  maxTokens: 250,
  temperature: 0.7,
  model: "gpt2",
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
  options: QueryOptions = {}
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

    const contextItems: string[] = optimizedContent.map(
      ({ metadata: { type, text } }) => `[${type.toUpperCase()}]: ${text}`
    );

    const truncatedContext: string = truncateToTokenLimit(
      contextItems.join("\n\n"),
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

    const inputTokens: number =
      countTokens(truncatedContext) + countTokens(query);
    const estimatedTokens: number = inputTokens + maxTokens;
    if (inputTokens + maxTokens > 1024) {
      return `Input validation error: inputs tokens + max_new_tokens must be <= 1024. Given: ${inputTokens} inputs tokens and ${maxTokens} max_new_tokens`;
    }
    if (dailyTokenCount + estimatedTokens > DAILY_TOKEN_LIMIT) {
      return "Daily API quota limit reached. Please try again tomorrow or use cached responses only.";
    }

    await rateLimit();

    const prompt: string = `You are an AI assistant with access to a knowledge base containing various types of content such as documents, tweets, YouTube videos, and web links. Your task is to provide a comprehensive and accurate response to the user's question based on the following context:

${truncatedContext}

Please consider the following guidelines:
1. Analyze the provided context carefully and identify the most relevant information.
2. If the context contains multiple content types, synthesize information from different sources.
3. Provide a clear and concise answer that directly addresses the user's question.
4. If the context doesn't contain enough information to fully answer the question, state this clearly and provide the best possible response based on available information.
5. If appropriate, mention the types of sources you're using (e.g., "According to a tweet in the context..." or "Based on a document in the knowledge base...").

User's Question: ${query}

Response:`;

    const response = await hf.textGeneration({
      model,
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        return_full_text: false,
      },
    });

    const responseText: string =
      response.generated_text || "Sorry, I couldn't generate a response.";

    const responseTokens: number = countTokens(responseText);
    dailyTokenCount += estimatedTokens;

    if (cacheEnabled) {
      const cacheKey: string = getCacheKey(query, truncatedContext);
      responseCache.set(cacheKey, {
        response: responseText,
        timestamp: Date.now(),
        tokenCount: responseTokens,
      });
    }

    return responseText;
  } catch (error: unknown) {
    console.error("Error querying Hugging Face LLM:", error);
    throw new Error(
      `Failed to generate response: ${
        (error as any)?.error?.message || (error as Error).message
      }`
    );
  }
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
