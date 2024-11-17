import Redis from "ioredis";
import config from "../config";

const redis = new Redis(config.REDIS_URL);

export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  expirationInSeconds: number
): Promise<void> {
  await redis.set(key, value, "EX", expirationInSeconds);
}
